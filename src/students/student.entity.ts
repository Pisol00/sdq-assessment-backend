import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Gender } from '../common/enums';
import { Classroom } from '../classrooms/classroom.entity';
import { Assessment } from '../assessments/assessment.entity';

@Entity('students')
@Unique(['classroomId', 'studentCode'])
@Index(['classroomId'])
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentCode: string;

  @Column()
  name: string;

  @Column()
  grade: string;

  @Column({ type: 'int' })
  age: number;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column()
  classroomId: string;

  @ManyToOne(() => Classroom, (c) => c.students, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classroomId' })
  classroom: Classroom;

  @OneToMany(() => Assessment, (a) => a.student)
  assessments: Assessment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
