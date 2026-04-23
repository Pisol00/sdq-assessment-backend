import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Payment } from './payment.entity';
import { User } from '../users/user.entity';
import { PaymentStatus, SubscriptionPlan } from '../common/enums';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StripeService } from './stripe.service';

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.MONTHLY]: 299,
  [SubscriptionPlan.LIFETIME]: 2990,
};

const PLAN_DURATION_DAYS: Partial<Record<SubscriptionPlan, number>> = {
  [SubscriptionPlan.MONTHLY]: 30,
};

export interface CheckoutSessionResponse {
  sessionId: string;
  checkoutUrl: string;
  expiresAt: string;
}

export interface PaymentStatusResponse {
  id: string;
  status: PaymentStatus;
  plan: SubscriptionPlan;
  amount: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment) private readonly repo: Repository<Payment>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly subs: SubscriptionsService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  findAll(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Payment> {
    const payment = await this.repo.findOne({ where: { id, userId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async createCheckoutSession(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<CheckoutSessionResponse> {
    if (plan === SubscriptionPlan.FREE) {
      throw new BadRequestException('Cannot purchase FREE plan');
    }

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const customerId = await this.ensureStripeCustomer(user);

    const priceId = this.resolvePriceId(plan);
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';

    const mode: Stripe.Checkout.SessionCreateParams.Mode =
      plan === SubscriptionPlan.MONTHLY ? 'subscription' : 'payment';

    const session = await this.stripe.client.checkout.sessions.create({
      mode,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/payment/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?canceled=1`,
      client_reference_id: userId,
      metadata: { userId, plan },
      ...(mode === 'subscription' && {
        subscription_data: { metadata: { userId, plan } },
      }),
      ...(mode === 'payment' && {
        payment_intent_data: { metadata: { userId, plan } },
      }),
    });

    if (!session.url) {
      throw new InternalServerErrorException('Stripe did not return a checkout URL');
    }

    const payment = this.repo.create({
      userId,
      plan,
      amount: PLAN_PRICES[plan].toFixed(2),
      currency: 'THB',
      status: PaymentStatus.PENDING,
      stripeSessionId: session.id,
      stripeCustomerId: customerId,
      metadata: { mode },
    });
    await this.repo.save(payment);

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString(),
    };
  }

  async getBySessionId(
    sessionId: string,
    userId: string,
  ): Promise<PaymentStatusResponse> {
    const payment = await this.repo.findOne({
      where: { stripeSessionId: sessionId, userId },
    });
    if (!payment) throw new NotFoundException('Session not found');
    return {
      id: payment.id,
      status: payment.status,
      plan: payment.plan,
      amount: payment.amount,
      currency: payment.currency,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Received Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await this.handleCheckoutCompleted(event.data.object);
        break;

      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        await this.handleCheckoutFailed(event.data.object);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object);
        break;

      case 'customer.subscription.deleted':
      case 'customer.subscription.updated':
        await this.handleSubscriptionChange(event.data.object);
        break;

      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const payment = await this.repo.findOne({
      where: { stripeSessionId: session.id },
    });
    if (!payment) {
      this.logger.warn(`No payment row for session ${session.id}`);
      return;
    }
    if (payment.status === PaymentStatus.SUCCESSFUL) return;

    if (session.payment_intent) {
      payment.stripePaymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent.id;
    }
    if (session.subscription) {
      payment.stripeSubscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;
    }

    const paid =
      session.payment_status === 'paid' ||
      session.payment_status === 'no_payment_required';

    if (paid) {
      payment.status = PaymentStatus.SUCCESSFUL;
      await this.repo.save(payment);
      await this.subs.upgrade(
        payment.userId,
        payment.plan,
        PLAN_DURATION_DAYS[payment.plan],
      );
    } else {
      await this.repo.save(payment);
    }
  }

  private async handleCheckoutFailed(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const payment = await this.repo.findOne({
      where: { stripeSessionId: session.id },
    });
    if (!payment) return;
    if (payment.status === PaymentStatus.SUCCESSFUL) return;
    payment.status =
      session.status === 'expired'
        ? PaymentStatus.EXPIRED
        : PaymentStatus.FAILED;
    await this.repo.save(payment);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const sub = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null })
      .subscription;
    const subscriptionId = typeof sub === 'string' ? sub : sub?.id;
    if (!subscriptionId) return;
    const payment = await this.repo.findOne({
      where: { stripeSubscriptionId: subscriptionId },
      order: { createdAt: 'DESC' },
    });
    if (!payment) return;
    await this.subs.upgrade(
      payment.userId,
      payment.plan,
      PLAN_DURATION_DAYS[payment.plan],
    );
  }

  private async handleSubscriptionChange(
    sub: Stripe.Subscription,
  ): Promise<void> {
    const userId = sub.metadata?.userId;
    if (!userId) return;
    if (sub.status === 'canceled' || sub.status === 'unpaid') {
      await this.subs.downgradeToFree(userId);
    }
  }

  private async ensureStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await this.stripe.client.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    user.stripeCustomerId = customer.id;
    await this.users.save(user);
    return customer.id;
  }

  private resolvePriceId(plan: SubscriptionPlan): string {
    const key =
      plan === SubscriptionPlan.MONTHLY
        ? 'STRIPE_PRICE_MONTHLY'
        : 'STRIPE_PRICE_LIFETIME';
    const priceId = this.config.get<string>(key);
    if (!priceId) {
      throw new InternalServerErrorException(
        `${key} is not configured`,
      );
    }
    return priceId;
  }
}
