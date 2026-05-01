import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditAction {
  // Tier 1 — Authentication
  SIGNUP = 'SIGNUP',
  SIGNIN_SUCCESS = 'SIGNIN_SUCCESS',
  SIGNIN_FAILED = 'SIGNIN_FAILED',
  SIGNOUT = 'SIGNOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',

  // Tier 2 — Sensitive (PDPA + admin)
  STUDENT_CREATED = 'STUDENT_CREATED',
  STUDENT_UPDATED = 'STUDENT_UPDATED',
  STUDENT_DELETED = 'STUDENT_DELETED',
  STUDENT_BULK_IMPORTED = 'STUDENT_BULK_IMPORTED',
  ASSESSMENT_SUBMITTED = 'ASSESSMENT_SUBMITTED',
  ASSESSMENT_DELETED = 'ASSESSMENT_DELETED',
  ADMIN_USER_ROLE_CHANGED = 'ADMIN_USER_ROLE_CHANGED',
  ADMIN_USER_ACTIVATED = 'ADMIN_USER_ACTIVATED',
  ADMIN_USER_DEACTIVATED = 'ADMIN_USER_DEACTIVATED',
}

@Entity('audit_logs')
@Index(['actorUserId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // Nullable for failed signin (no user yet)
  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  // Denormalized — preserved even if user is deleted
  @Column({ type: 'varchar', length: 255, nullable: true })
  actorEmail: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resourceType: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resourceId: string | null;

  // Free-form context: { changes: {...}, count: 5, reason: "...", etc. }
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;
}
