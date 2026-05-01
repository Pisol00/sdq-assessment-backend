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
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { User } from '../users/user.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { AuthToken, AuthTokenPurpose } from './auth-token.entity';
import { EmailService } from './email.service';
import { AuditLogService, AuditContext } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-log.entity';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from '../common/enums';
import { JwtPayload } from './jwt.strategy';

const PASSWORD_RESET_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PASSWORD_RESET_SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CHECK_EMAIL_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
    private readonly audit: AuditLogService,
  ) {}

  async signup(dto: SignupDto, ctx?: AuditContext) {
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

    const checkEmailToken = await this.createCheckEmailSession(user.id);
    await this.issueEmailVerificationCode(user.id, user.email);
    const auth = this.issueToken(user);

    this.audit.log({
      action: AuditAction.SIGNUP,
      actorUserId: user.id,
      actorEmail: user.email,
      context: ctx,
    });

    return { ...auth, checkEmailToken };
  }

  private async issueEmailVerificationCode(
    userId: string,
    email: string,
  ): Promise<void> {
    // Invalidate prior unused codes
    await this.tokens
      .delete({
        userId,
        purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
      })
      .catch(() => undefined);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = createHash('sha256').update(code).digest('hex');
    await this.tokens.save(
      this.tokens.create({
        userId,
        tokenHash: codeHash,
        purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      }),
    );
    await this.email.sendEmailVerificationCode(email, code);
  }

  private async createCheckEmailSession(userId: string): Promise<string> {
    // Always invalidate prior sessions so old URLs stop working
    await this.tokens
      .delete({
        userId,
        purpose: AuthTokenPurpose.CHECK_EMAIL_SESSION,
      })
      .catch(() => undefined);
    const { rawToken, tokenHash } = this.generateToken();
    await this.tokens.save(
      this.tokens.create({
        userId,
        tokenHash,
        purpose: AuthTokenPurpose.CHECK_EMAIL_SESSION,
        expiresAt: new Date(Date.now() + CHECK_EMAIL_SESSION_TTL_MS),
      }),
    );
    return rawToken;
  }

  async issueCheckEmailSession(userId: string): Promise<{ token: string }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }
    const token = await this.createCheckEmailSession(user.id);
    return { token };
  }

  async getCheckEmailSession(
    rawToken: string,
    requestingUserId?: string,
  ): Promise<{ email: string }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const token = await this.tokens.findOne({
      where: { tokenHash, purpose: AuthTokenPurpose.CHECK_EMAIL_SESSION },
    });
    if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('Invalid or expired check-email session');
    }
    if (requestingUserId && requestingUserId !== token.userId) {
      throw new NotFoundException('Invalid or expired check-email session');
    }
    const user = await this.users.findOne({ where: { id: token.userId } });
    if (!user) throw new NotFoundException('User not found');
    return { email: user.email };
  }

  async signin(dto: SigninDto, ctx?: AuditContext) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.email = :email', { email: dto.email })
      .getOne();

    if (!user || !user.isActive) {
      this.audit.log({
        action: AuditAction.SIGNIN_FAILED,
        actorEmail: dto.email,
        metadata: { reason: !user ? 'unknown_email' : 'inactive' },
        context: ctx,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      this.audit.log({
        action: AuditAction.SIGNIN_FAILED,
        actorUserId: user.id,
        actorEmail: user.email,
        metadata: { reason: 'wrong_password' },
        context: ctx,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    this.audit.log({
      action: AuditAction.SIGNIN_SUCCESS,
      actorUserId: user.id,
      actorEmail: user.email,
      context: ctx,
    });
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
    ctx?: AuditContext,
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

    this.audit.log({
      action: AuditAction.PASSWORD_CHANGED,
      actorUserId: user.id,
      actorEmail: user.email,
      context: ctx,
    });
    return { success: true };
  }

  async requestPasswordReset(
    email: string,
    ctx?: AuditContext,
  ): Promise<{ sessionToken: string }> {
    const user = await this.users.findOne({ where: { email } });
    // Always return a session token (even when user doesn't exist) to avoid
    // email enumeration. The next step will fail uniformly with "Invalid code".
    const sessionToken = await this.createPasswordResetSession(user?.id ?? null);
    if (user && user.isActive) {
      await this.issuePasswordResetCode(user.id, user.email);
      this.audit.log({
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        actorUserId: user.id,
        actorEmail: user.email,
        context: ctx,
      });
    }
    return { sessionToken };
  }

  private async createPasswordResetSession(
    userId: string | null,
  ): Promise<string> {
    const effectiveUserId = userId ?? '00000000-0000-0000-0000-000000000000';
    // Invalidate prior reset sessions so old URLs stop working
    if (userId) {
      await this.tokens
        .delete({
          userId: effectiveUserId,
          purpose: AuthTokenPurpose.PASSWORD_RESET_SESSION,
        })
        .catch(() => undefined);
    }
    const { rawToken, tokenHash } = this.generateToken();
    await this.tokens.save(
      this.tokens.create({
        userId: effectiveUserId,
        tokenHash,
        purpose: AuthTokenPurpose.PASSWORD_RESET_SESSION,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_SESSION_TTL_MS),
      }),
    );
    return rawToken;
  }

  private async issuePasswordResetCode(
    userId: string,
    email: string,
  ): Promise<void> {
    await this.tokens
      .delete({ userId, purpose: AuthTokenPurpose.PASSWORD_RESET })
      .catch(() => undefined);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = createHash('sha256').update(code).digest('hex');
    await this.tokens.save(
      this.tokens.create({
        userId,
        tokenHash: codeHash,
        purpose: AuthTokenPurpose.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      }),
    );
    await this.email.sendPasswordResetCode(email, code);
  }

  async getPasswordResetSession(
    rawToken: string,
  ): Promise<{ email: string | null }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const token = await this.tokens.findOne({
      where: { tokenHash, purpose: AuthTokenPurpose.PASSWORD_RESET_SESSION },
    });
    if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('Invalid or expired session');
    }
    const user = await this.users.findOne({ where: { id: token.userId } });
    // Mask email partially for privacy: a***@example.com
    if (!user) return { email: null };
    return { email: this.maskEmail(user.email) };
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const visible = local.slice(0, 1);
    return `${visible}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
  }

  async verifyPasswordResetCode(
    sessionToken: string,
    code: string,
  ): Promise<{ valid: true }> {
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('รหัสไม่ถูกต้อง');
    }
    const sessionHash = createHash('sha256').update(sessionToken).digest('hex');
    const session = await this.tokens.findOne({
      where: {
        tokenHash: sessionHash,
        purpose: AuthTokenPurpose.PASSWORD_RESET_SESSION,
      },
    });
    if (
      !session ||
      session.usedAt ||
      session.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Session หมดอายุ กรุณาเริ่มใหม่');
    }
    const codeToken = await this.tokens.findOne({
      where: {
        userId: session.userId,
        purpose: AuthTokenPurpose.PASSWORD_RESET,
      },
      order: { createdAt: 'DESC' },
    });
    if (!codeToken || codeToken.usedAt) {
      throw new BadRequestException('รหัสไม่ถูกต้อง');
    }
    if (codeToken.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('รหัสหมดอายุแล้ว');
    }
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expected = Buffer.from(codeToken.tokenHash, 'hex');
    const provided = Buffer.from(codeHash, 'hex');
    const matches =
      expected.length === provided.length &&
      timingSafeEqual(expected, provided);
    if (!matches) {
      throw new BadRequestException('รหัสไม่ถูกต้อง');
    }
    return { valid: true };
  }

  async resetPassword(
    sessionToken: string,
    code: string,
    newPassword: string,
    ctx?: AuditContext,
  ): Promise<{ success: true }> {
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('รหัสไม่ถูกต้อง');
    }
    // Validate session token
    const sessionHash = createHash('sha256').update(sessionToken).digest('hex');
    const session = await this.tokens.findOne({
      where: {
        tokenHash: sessionHash,
        purpose: AuthTokenPurpose.PASSWORD_RESET_SESSION,
      },
    });
    if (
      !session ||
      session.usedAt ||
      session.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Session หมดอายุ กรุณาเริ่มใหม่');
    }

    // Validate code (most recent for this user)
    const codeToken = await this.tokens.findOne({
      where: {
        userId: session.userId,
        purpose: AuthTokenPurpose.PASSWORD_RESET,
      },
      order: { createdAt: 'DESC' },
    });
    if (!codeToken || codeToken.usedAt) {
      throw new BadRequestException('รหัสไม่ถูกต้อง');
    }
    if (codeToken.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('รหัสหมดอายุแล้ว');
    }
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expected = Buffer.from(codeToken.tokenHash, 'hex');
    const provided = Buffer.from(codeHash, 'hex');
    const matches =
      expected.length === provided.length &&
      timingSafeEqual(expected, provided);
    if (!matches) {
      throw new BadRequestException('รหัสไม่ถูกต้อง');
    }

    const user = await this.users.findOne({ where: { id: session.userId } });
    if (!user) throw new BadRequestException('Invalid session');

    user.password = await bcrypt.hash(newPassword, 10);
    await this.users.save(user);

    codeToken.usedAt = new Date();
    session.usedAt = new Date();
    await this.tokens.save([codeToken, session]);

    this.audit.log({
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      actorUserId: user.id,
      actorEmail: user.email,
      context: ctx,
    });

    return { success: true };
  }

  async requestEmailVerification(userId: string): Promise<{ success: true }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) return { success: true };
    await this.issueEmailVerificationCode(user.id, user.email);
    return { success: true };
  }

  async verifyEmail(userId: string, code: string, ctx?: AuditContext) {
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('รหัสไม่ถูกต้อง');
    }
    // Look up the most recent verification token for this user
    const token = await this.tokens.findOne({
      where: {
        userId,
        purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
      },
      order: { createdAt: 'DESC' },
    });
    if (!token || token.usedAt) {
      throw new BadRequestException('รหัสไม่ถูกต้อง');
    }
    if (token.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('รหัสหมดอายุแล้ว');
    }

    const codeHash = createHash('sha256').update(code).digest('hex');
    const expected = Buffer.from(token.tokenHash, 'hex');
    const provided = Buffer.from(codeHash, 'hex');
    const matches =
      expected.length === provided.length &&
      timingSafeEqual(expected, provided);
    if (!matches) {
      throw new BadRequestException('รหัสไม่ถูกต้อง');
    }

    token.usedAt = new Date();
    await this.tokens.save(token);

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    const wasUnverified = !user.emailVerified;
    if (wasUnverified) {
      user.emailVerified = true;
      await this.users.save(user);
    }
    await this.tokens
      .delete({
        userId: user.id,
        purpose: AuthTokenPurpose.CHECK_EMAIL_SESSION,
      })
      .catch(() => undefined);
    if (wasUnverified) {
      this.audit.log({
        action: AuditAction.EMAIL_VERIFIED,
        actorUserId: user.id,
        actorEmail: user.email,
        context: ctx,
      });
    }
    // Re-issue JWT so the new emailVerified=true claim takes effect
    return this.issueToken(user);
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
      emailVerified: user.emailVerified,
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
