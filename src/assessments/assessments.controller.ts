import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import {
  CreateAssessmentDto,
  SubmitResponsesDto,
} from './dto/assessment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';
import { AuditCtx } from '../audit/audit-context.decorator';
import type { AuditContext } from '../audit/audit-log.service';

@ApiTags('assessments')
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}

  @Get('questions')
  getQuestions() {
    return this.service.getQuestions();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('classroomId') classroomId?: string,
  ) {
    return this.service.findAllForUser(user.id, classroomId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('reports')
  reports(
    @CurrentUser() user: User,
    @Query('classroomId') classroomId?: string,
  ) {
    return this.service.reports(user.id, classroomId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('by-student/:studentId')
  findByStudent(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.findByStudent(studentId, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.findOneForUser(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id/submit')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: SubmitResponsesDto,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.service.submit(id, user.id, dto, ctx);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.service.remove(id, user.id, ctx);
  }
}
