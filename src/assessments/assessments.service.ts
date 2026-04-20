import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment } from './assessment.entity';
import {
  CreateAssessmentDto,
  SubmitResponsesDto,
} from './dto/assessment.dto';
import { StudentsService } from '../students/students.service';
import {
  calculateSdqScores,
  interpretSdqScores,
} from './sdq-calculator';
import { SDQ_QUESTIONS } from './sdq-questions';

@Injectable()
export class AssessmentsService {
  constructor(
    @InjectRepository(Assessment)
    private readonly repo: Repository<Assessment>,
    private readonly students: StudentsService,
  ) {}

  getQuestions() {
    return SDQ_QUESTIONS;
  }

  async findAllForUser(userId: string, classroomId?: string) {
    const qb = this.repo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.student', 's')
      .innerJoin('s.classroom', 'c')
      .where('c.userId = :userId', { userId })
      .orderBy('a.createdAt', 'DESC');
    if (classroomId) qb.andWhere('s.classroomId = :classroomId', { classroomId });
    return qb.getMany();
  }

  async findByStudent(studentId: string, userId: string) {
    await this.students.findOneForUser(studentId, userId);
    return this.repo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneForUser(id: string, userId: string) {
    const assessment = await this.repo.findOne({
      where: { id },
      relations: { student: { classroom: true } },
    });
    if (!assessment || assessment.student.classroom.userId !== userId) {
      throw new NotFoundException('Assessment not found');
    }
    return assessment;
  }

  async create(userId: string, dto: CreateAssessmentDto) {
    await this.students.findOneForUser(dto.studentId, userId);
    const assessment = this.repo.create({
      studentId: dto.studentId,
      date: new Date(),
      responses: {},
      completed: false,
    });
    return this.repo.save(assessment);
  }

  async submit(id: string, userId: string, dto: SubmitResponsesDto) {
    const assessment = await this.findOneForUser(id, userId);
    const responses: Record<number, 0 | 1 | 2> = {};
    for (const [k, v] of Object.entries(dto.responses)) {
      responses[Number(k)] = v;
    }
    assessment.responses = responses;
    assessment.impactResponses = dto.impactResponses ?? null;
    assessment.completed = dto.completed;

    if (dto.completed) {
      const scores = calculateSdqScores(responses);
      assessment.scores = scores;
      assessment.interpretations = interpretSdqScores(scores);
      assessment.date = new Date();
    }
    return this.repo.save(assessment);
  }

  async remove(id: string, userId: string) {
    const a = await this.findOneForUser(id, userId);
    await this.repo.remove(a);
    return { success: true };
  }

  async reports(userId: string, classroomId?: string) {
    const assessments = await this.findAllForUser(userId, classroomId);
    const completed = assessments.filter((a) => a.completed && a.scores);

    const buckets = {
      emotional: { ปกติ: 0, เสี่ยง: 0, มีปัญหา: 0 },
      conduct: { ปกติ: 0, เสี่ยง: 0, มีปัญหา: 0 },
      hyperactivity: { ปกติ: 0, เสี่ยง: 0, มีปัญหา: 0 },
      peer: { ปกติ: 0, เสี่ยง: 0, มีปัญหา: 0 },
      prosocial: { ปกติ: 0, เสี่ยง: 0, มีปัญหา: 0 },
      totalDifficulties: { ปกติ: 0, เสี่ยง: 0, มีปัญหา: 0 },
    } as Record<string, Record<string, number>>;

    for (const a of completed) {
      if (!a.interpretations) continue;
      for (const key of Object.keys(buckets)) {
        const label = a.interpretations[key as keyof typeof a.interpretations];
        if (label && buckets[key][label] !== undefined) {
          buckets[key][label]++;
        }
      }
    }

    return {
      total: assessments.length,
      completed: completed.length,
      buckets,
    };
  }
}
