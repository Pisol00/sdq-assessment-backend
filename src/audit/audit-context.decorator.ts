import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuditLogService, AuditContext } from './audit-log.service';

/**
 * Inject `{ ip, userAgent }` into a controller method.
 *
 * @example
 *   foo(@AuditCtx() ctx: AuditContext) { ... }
 */
export const AuditCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuditContext => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return AuditLogService.contextFromRequest(req);
  },
);
