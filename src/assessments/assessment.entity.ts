import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Student } from '../students/student.entity';

export interface SdqScores {
  emotional: number;
  conduct: number;
  hyperactivity: number;
  peer: number;
  prosocial: number;
  totalDifficulties: number;
}

export interface SdqInterpretations {
  emotional: string;
  conduct: string;
  hyperactivity: string;
  peer: string;
  prosocial: string;
  totalDifficulties: string;
}

export interface ImpactResponses {
  hasProblems?: boolean;
  duration?: string;
  distress?: string;
  homeImpact?: string;
  friendImpact?: string;
  classroomImpact?: string;
  leisureImpact?: string;
  burdenOnOthers?: string;
}

@Entity('assessments')
@Index(['studentId'])
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentId: string;

  @ManyToOne(() => Student, (s) => s.assessments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'timestamptz' })
  date: Date;

  @Column({ type: 'jsonb' })
  responses: Record<number, 0 | 1 | 2>;

  @Column({ type: 'jsonb', nullable: true })
  impactResponses: ImpactResponses | null;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'jsonb', nullable: true })
  scores: SdqScores | null;

  @Column({ type: 'jsonb', nullable: true })
  interpretations: SdqInterpretations | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
