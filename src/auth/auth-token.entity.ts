import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuthTokenPurpose {
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_RESET_SESSION = 'PASSWORD_RESET_SESSION',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  CHECK_EMAIL_SESSION = 'CHECK_EMAIL_SESSION',
}

@Entity('auth_tokens')
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Index({ unique: true })
  @Column()
  tokenHash: string;

  @Column({ type: 'enum', enum: AuthTokenPurpose })
  purpose: AuthTokenPurpose;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
