import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';
import { UserRole } from '../common/enums';
import { AuditCtx } from '../audit/audit-context.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import type { AuditContext } from '../audit/audit-log.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly audit: AuditLogService,
  ) {}

  @Get('users')
  listUsers() {
    return this.service.listUsers();
  }

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Patch('users/:id/status')
  setUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: User,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.service.setUserStatus(id, dto.isActive, actor.id, ctx);
  }

  @Get('audit-logs')
  getAuditLogs(@Query() query: AuditLogsQueryDto) {
    return this.audit.query({
      actorUserId: query.actorUserId,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
