import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity';
import { Classroom } from '../classrooms/classroom.entity';
import { Student } from '../students/student.entity';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../common/enums';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
    @InjectRepository(Classroom)
    private readonly classrooms: Repository<Classroom>,
    @InjectRepository(Student)
    private readonly students: Repository<Student>,
    private readonly config: ConfigService,
  ) {}

  async getByUser(userId: string): Promise<Subscription> {
    const sub = await this.subs.findOne({ where: { userId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async getEffectivePlan(userId: string): Promise<SubscriptionPlan> {
    const sub = await this.getByUser(userId);
    if (sub.status !== SubscriptionStatus.ACTIVE) return SubscriptionPlan.FREE;
    if (sub.endDate && sub.endDate < new Date()) return SubscriptionPlan.FREE;
    return sub.plan;
  }

  async assertCanCreateClassroom(userId: string): Promise<void> {
    const plan = await this.getEffectivePlan(userId);
    if (plan !== SubscriptionPlan.FREE) return;
    const max = this.config.get<number>('FREE_PLAN_MAX_CLASSROOMS') ?? 1;
    const count = await this.classrooms.count({ where: { userId } });
    if (count >= Number(max)) {
      throw new ForbiddenException(
        `Free plan allows up to ${max} classroom(s). Please upgrade.`,
      );
    }
  }

  async assertCanCreateStudent(userId: string): Promise<void> {
    const plan = await this.getEffectivePlan(userId);
    if (plan !== SubscriptionPlan.FREE) return;
    const max = this.config.get<number>('FREE_PLAN_MAX_STUDENTS') ?? 10;
    const count = await this.students
      .createQueryBuilder('s')
      .innerJoin('s.classroom', 'c')
      .where('c.userId = :userId', { userId })
      .getCount();
    if (count >= Number(max)) {
      throw new ForbiddenException(
        `Free plan allows up to ${max} students. Please upgrade.`,
      );
    }
  }

  async upgrade(
    userId: string,
    plan: SubscriptionPlan,
    durationDays?: number,
  ): Promise<Subscription> {
    const sub = await this.getByUser(userId);
    sub.plan = plan;
    sub.status = SubscriptionStatus.ACTIVE;
    sub.startDate = new Date();
    sub.endDate =
      plan === SubscriptionPlan.LIFETIME || !durationDays
        ? null
        : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    return this.subs.save(sub);
  }

  async downgradeToFree(userId: string): Promise<Subscription> {
    const sub = await this.getByUser(userId);
    sub.plan = SubscriptionPlan.FREE;
    sub.status = SubscriptionStatus.CANCELLED;
    sub.endDate = new Date();
    return this.subs.save(sub);
  }
}
