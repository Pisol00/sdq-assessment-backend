import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Student } from './student.entity';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { ClassroomsService } from '../classrooms/classrooms.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Gender } from '../common/enums';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student) private readonly repo: Repository<Student>,
    private readonly classrooms: ClassroomsService,
    private readonly subs: SubscriptionsService,
  ) {}

  async findAllByClassroom(classroomId: string, userId: string) {
    await this.classrooms.findOneForUser(classroomId, userId);
    return this.repo.find({
      where: { classroomId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneForUser(id: string, userId: string) {
    const student = await this.repo.findOne({
      where: { id },
      relations: { classroom: true },
    });
    if (!student || student.classroom.userId !== userId) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  async create(userId: string, dto: CreateStudentDto) {
    await this.classrooms.findOneForUser(dto.classroomId, userId);
    await this.subs.assertCanCreateStudent(userId);

    const existing = await this.repo.findOne({
      where: { classroomId: dto.classroomId, studentCode: dto.studentCode },
    });
    if (existing) {
      throw new ConflictException('Student code already exists in this classroom');
    }

    const student = this.repo.create(dto);
    return this.repo.save(student);
  }

  async update(id: string, userId: string, dto: UpdateStudentDto) {
    const student = await this.findOneForUser(id, userId);
    if (dto.classroomId && dto.classroomId !== student.classroomId) {
      await this.classrooms.findOneForUser(dto.classroomId, userId);
    }
    Object.assign(student, dto);
    return this.repo.save(student);
  }

  async remove(id: string, userId: string) {
    const student = await this.findOneForUser(id, userId);
    await this.repo.remove(student);
    return { success: true };
  }

  async importFromExcel(
    classroomId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const classroom = await this.classrooms.findOneForUser(classroomId, userId);

    if (!file) throw new BadRequestException('File is required');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Empty workbook');

    const existing = await this.repo.find({
      where: { classroomId },
      select: { studentCode: true },
    });
    const existingCodes = new Set(existing.map((s) => s.studentCode));

    const toCreate: Partial<Student>[] = [];
    const errors: { row: number; reason: string }[] = [];
    const seenInFile = new Set<string>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber < 4) return;
      const studentCode = String(row.getCell(1).value ?? '').trim();
      const name = String(row.getCell(2).value ?? '').trim();
      const ageRaw = row.getCell(3).value;
      const genderRaw = String(row.getCell(4).value ?? '').trim();

      if (!studentCode || !name) return;

      if (seenInFile.has(studentCode) || existingCodes.has(studentCode)) {
        errors.push({ row: rowNumber, reason: `Duplicate student code: ${studentCode}` });
        return;
      }

      const age = Number(ageRaw);
      if (!Number.isFinite(age) || age < 3 || age > 25) {
        errors.push({ row: rowNumber, reason: 'Invalid age' });
        return;
      }

      const gender = mapGender(genderRaw);
      if (!gender) {
        errors.push({ row: rowNumber, reason: 'Invalid gender' });
        return;
      }

      seenInFile.add(studentCode);
      toCreate.push({
        classroomId,
        studentCode,
        name,
        grade: classroom.grade,
        age,
        gender,
      });
    });

    const plan = await this.subs.getEffectivePlan(userId);
    if (plan === 'FREE') {
      const currentCount = await this.repo
        .createQueryBuilder('s')
        .innerJoin('s.classroom', 'c')
        .where('c.userId = :userId', { userId })
        .getCount();
      const max = Number(process.env.FREE_PLAN_MAX_STUDENTS ?? 10);
      const remaining = Math.max(0, max - currentCount);
      if (toCreate.length > remaining) {
        throw new BadRequestException(
          `Free plan limit: only ${remaining} more students can be added.`,
        );
      }
    }

    const saved = toCreate.length
      ? await this.repo.save(this.repo.create(toCreate as Student[]))
      : [];

    return { imported: saved.length, skipped: errors.length, errors };
  }
}

function mapGender(raw: string): Gender | null {
  const s = raw.toLowerCase();
  if (['m', 'male', 'ชาย'].includes(s)) return Gender.MALE;
  if (['f', 'female', 'หญิง'].includes(s)) return Gender.FEMALE;
  if (['o', 'other', 'อื่นๆ', 'อื่น ๆ'].includes(s)) return Gender.OTHER;
  return null;
}
