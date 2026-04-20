import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Classroom } from './classroom.entity';
import {
  CreateClassroomDto,
  UpdateClassroomDto,
} from './dto/classroom.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class ClassroomsService {
  constructor(
    @InjectRepository(Classroom)
    private readonly repo: Repository<Classroom>,
    private readonly subs: SubscriptionsService,
  ) {}

  findAllByUser(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneForUser(id: string, userId: string) {
    const c = await this.repo.findOne({ where: { id, userId } });
    if (!c) throw new NotFoundException('Classroom not found');
    return c;
  }

  async create(userId: string, dto: CreateClassroomDto) {
    await this.subs.assertCanCreateClassroom(userId);
    const classroom = this.repo.create({ ...dto, userId });
    return this.repo.save(classroom);
  }

  async update(id: string, userId: string, dto: UpdateClassroomDto) {
    const c = await this.findOneForUser(id, userId);
    Object.assign(c, dto);
    return this.repo.save(c);
  }

  async remove(id: string, userId: string) {
    const c = await this.findOneForUser(id, userId);
    await this.repo.remove(c);
    return { success: true };
  }
}
