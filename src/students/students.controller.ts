import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';
import { AuditCtx } from '../audit/audit-context.decorator';
import type { AuditContext } from '../audit/audit-log.service';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  findByClassroom(
    @Query('classroomId', ParseUUIDPipe) classroomId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.findAllByClassroom(classroomId, user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.findOneForUser(id, user.id);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateStudentDto,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.service.create(user.id, dto, ctx);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateStudentDto,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.service.update(id, user.id, dto, ctx);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.service.remove(id, user.id, ctx);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(
    @Query('classroomId', ParseUUIDPipe) classroomId: string,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.service.importFromExcel(classroomId, user.id, file, ctx);
  }
}
