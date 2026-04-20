import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PaymentStatus,
  SubscriptionPlan,
} from '../common/enums';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.MONTHLY]: 299,
  [SubscriptionPlan.LIFETIME]: 2990,
};

const PLAN_DURATION_DAYS: Partial<Record<SubscriptionPlan, number>> = {
  [SubscriptionPlan.MONTHLY]: 30,
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly repo: Repository<Payment>,
    private readonly subs: SubscriptionsService,
  ) {}

  findAll(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    const payment = await this.repo.findOne({ where: { id, userId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async create(userId: string, dto: CreatePaymentDto) {
    if (dto.plan === SubscriptionPlan.FREE) {
      throw new BadRequestException('Cannot purchase FREE plan');
    }
    const amount = PLAN_PRICES[dto.plan];
    const payment = this.repo.create({
      userId,
      plan: dto.plan,
      amount: amount.toFixed(2),
      currency: 'THB',
      method: dto.method,
      status: PaymentStatus.PENDING,
    });
    return this.repo.save(payment);
  }

  async markSuccessful(id: string, userId: string, omiseChargeId?: string) {
    const payment = await this.findOne(id, userId);
    if (payment.status === PaymentStatus.SUCCESSFUL) return payment;
    payment.status = PaymentStatus.SUCCESSFUL;
    if (omiseChargeId) payment.omiseChargeId = omiseChargeId;
    await this.repo.save(payment);

    await this.subs.upgrade(
      userId,
      payment.plan,
      PLAN_DURATION_DAYS[payment.plan],
    );
    return payment;
  }
}
