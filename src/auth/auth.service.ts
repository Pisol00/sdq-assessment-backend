import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from '../common/enums';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
    private readonly jwt: JwtService,
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
      },
    };
  }
}
