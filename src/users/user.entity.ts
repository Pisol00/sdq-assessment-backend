import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../common/enums';
import { Classroom } from '../classrooms/classroom.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { Payment } from '../payments/payment.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ select: false })
  password: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.TEACHER })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  emailVerified: boolean;

  @Index({ unique: true, where: '"stripeCustomerId" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  stripeCustomerId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Classroom, (classroom) => classroom.user)
  classrooms: Classroom[];

  @OneToOne(() => Subscription, (sub) => sub.user)
  subscription: Subscription;

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];
}
