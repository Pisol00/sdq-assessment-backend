import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import type { Request } from 'express';
import { AuditAction, AuditLog } from './audit-log.entity';

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_USER_AGENT_LEN = 512;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const REDACTED_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'code',
  'pass',
  'authorization',
]);

export interface AuditContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry {
  action: AuditAction;
  actorUserId?: string | null;
  actorEmail?: string | null;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  context?: AuditContext;
}

export interface AuditQuery {
  actorUserId?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
  ) {}

  /** Fire-and-forget. Never throws — audit must not break business logic. */
  log(entry: AuditEntry): void {
    void this.persist(entry).catch((err) => {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Audit write failed for action=${entry.action}: ${reason}`,
      );
    });
  }

  private async persist(entry: AuditEntry): Promise<void> {
    const row = this.logs.create({
      action: entry.action,
      actorUserId: entry.actorUserId ?? null,
      actorEmail: entry.actorEmail ?? null,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ? redact(entry.metadata) : null,
      ip: entry.context?.ip ?? null,
      userAgent: entry.context?.userAgent ?? null,
    });
    await this.logs.save(row);
  }

  static contextFromRequest(req: Request): AuditContext {
    return {
      ip: extractClientIp(req),
      userAgent:
        req.headers['user-agent']?.slice(0, MAX_USER_AGENT_LEN) ?? null,
    };
  }

  async query(filters: AuditQuery) {
    const qb = this.logs
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (filters.actorUserId) {
      qb.andWhere('log.actorUserId = :uid', { uid: filters.actorUserId });
    }
    if (filters.action) {
      qb.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.from) {
      qb.andWhere('log.createdAt >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('log.createdAt <= :to', { to: filters.to });
    }

    qb.take(Math.min(filters.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
    qb.skip(filters.offset ?? 0);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldLogs(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    try {
      const result = await this.logs.delete({ createdAt: LessThan(cutoff) });
      if ((result.affected ?? 0) > 0) {
        this.logger.log(`Cleaned ${result.affected} audit logs > 90 days`);
      }
    } catch (err) {
      this.logger.error(
        'Failed to clean old audit logs',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}

function extractClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || null;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0] ?? null;
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

function redact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = REDACTED_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redactValue(v);
  }
  return out;
}

function redactValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(redactValue);
  if (v && typeof v === 'object') return redact(v as Record<string, unknown>);
  return v;
}
