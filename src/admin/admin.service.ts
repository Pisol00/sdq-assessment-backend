import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { Assessment } from '../assessments/assessment.entity';
import { SubscriptionPlan } from '../common/enums';

export interface AdminUserView {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: SubscriptionPlan;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface AdminStatsView {
  totalUsers: number;
  activeUsers: number;
  premiumUsers: number;
  totalAssessments: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
    @InjectRepository(Assessment)
    private readonly assessments: Repository<Assessment>,
  ) {}

  async listUsers(): Promise<AdminUserView[]> {
    const users = await this.users.find({
      relations: ['subscription'],
      order: { createdAt: 'DESC' },
    });
    return users.map((u) => this.toView(u));
  }

  async getStats(): Promise<AdminStatsView> {
    const [totalUsers, activeUsers, premiumSubs, totalAssessments] =
      await Promise.all([
        this.users.count(),
        this.users.count({ where: { isActive: true } }),
        this.subs
          .createQueryBuilder('s')
          .where('s.plan != :free', { free: SubscriptionPlan.FREE })
          .getCount(),
        this.assessments.count(),
      ]);
    return {
      totalUsers,
      activeUsers,
      premiumUsers: premiumSubs,
      totalAssessments,
    };
  }

  async setUserStatus(id: string, isActive: boolean): Promise<AdminUserView> {
    const user = await this.users.findOne({
      where: { id },
      relations: ['subscription'],
    });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = isActive;
    await this.users.save(user);
    return this.toView(user);
  }

  private toView(u: User): AdminUserView {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      plan: u.subscription?.plan ?? SubscriptionPlan.FREE,
      isActive: u.isActive,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
