import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { LessThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { User } from '../users/user.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { AuthToken, AuthTokenPurpose } from './auth-token.entity';
import { EmailService } from './email.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from '../common/enums';
import { JwtPayload } from './jwt.strategy';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
    @InjectRepository(AuthToken)
    private readonly tokens: Repository<AuthToken>,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.users.create({
      email: dto.email,
      password: hashed,
      name: dto.name,
      role: UserRole.TEACHER,
    });
    await this.users.save(user);

    const sub = this.subs.create({
      userId: user.id,
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
    });
    await this.subs.save(sub);

    return this.issueToken(user);
  }

  async signin(dto: SigninDto) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.email = :email', { email: dto.email })
      .getOne();

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueToken(user);
  }

  async updateMe(userId: string, updates: { name?: string }) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (updates.name !== undefined) user.name = updates.name;
    await this.users.save(user);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id: userId })
      .getOne();
    if (!user) throw new NotFoundException('User not found');

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    user.password = await bcrypt.hash(newPassword, 10);
    await this.users.save(user);
    return { success: true };
  }

  async requestPasswordReset(email: string): Promise<{ success: true }> {
    const user = await this.users.findOne({ where: { email } });
    if (user && user.isActive) {
      const { rawToken, tokenHash } = this.generateToken();
      await this.tokens.save(
        this.tokens.create({
          userId: user.id,
          tokenHash,
          purpose: AuthTokenPurpose.PASSWORD_RESET,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        }),
      );
      await this.email.sendPasswordResetEmail(user.email, rawToken);
    }
    // Always return success to avoid email enumeration
    return { success: true };
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const token = await this.consumeToken(
      rawToken,
      AuthTokenPurpose.PASSWORD_RESET,
    );
    const user = await this.users.findOne({ where: { id: token.userId } });
    if (!user) throw new BadRequestException('Invalid or expired token');
    user.password = await bcrypt.hash(newPassword, 10);
    await this.users.save(user);
    return { success: true };
  }

  async requestEmailVerification(userId: string): Promise<{ success: true }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) return { success: true };
    const { rawToken, tokenHash } = this.generateToken();
    await this.tokens.save(
      this.tokens.create({
        userId: user.id,
        tokenHash,
        purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      }),
    );
    await this.email.sendEmailVerification(user.email, rawToken);
    return { success: true };
  }

  async verifyEmail(rawToken: string): Promise<{ success: true }> {
    const token = await this.consumeToken(
      rawToken,
      AuthTokenPurpose.EMAIL_VERIFICATION,
    );
    const user = await this.users.findOne({ where: { id: token.userId } });
    if (!user) throw new BadRequestException('Invalid or expired token');
    if (!user.emailVerified) {
      user.emailVerified = true;
      await this.users.save(user);
    }
    return { success: true };
  }

  private generateToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash };
  }

  private async consumeToken(
    rawToken: string,
    purpose: AuthTokenPurpose,
  ): Promise<AuthToken> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const token = await this.tokens.findOne({ where: { tokenHash, purpose } });
    if (!token) throw new BadRequestException('Invalid or expired token');
    if (token.usedAt) throw new BadRequestException('Token already used');
    if (token.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token expired');
    }
    token.usedAt = new Date();
    await this.tokens.save(token);
    // Best-effort cleanup of this user's stale tokens
    await this.tokens
      .delete({ userId: token.userId, purpose, expiresAt: LessThan(new Date()) })
      .catch(() => undefined);
    return token;
  }

  private issueToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }
}
