import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/user.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { Assessment } from '../assessments/assessment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Subscription, Assessment])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
