import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findAll() {
    return this.users.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setActive(id: string, isActive: boolean) {
    const user = await this.findOne(id);
    user.isActive = isActive;
    return this.users.save(user);
  }
}
