import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AuthToken } from './auth-token.entity';

const USED_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Periodically removes auth tokens that are no longer useful:
 *  - Expired but never consumed (security: don't keep stale credentials around)
 *  - Consumed tokens older than the retention window (audit trail kept short)
 */
@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(
    @InjectRepository(AuthToken)
    private readonly tokens: Repository<AuthToken>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    try {
      const expired = await this.tokens.delete({ expiresAt: LessThan(now) });
      const oldUsedCutoff = new Date(Date.now() - USED_TOKEN_RETENTION_MS);
      const oldUsed = await this.tokens.delete({
        usedAt: LessThan(oldUsedCutoff),
      });
      const total = (expired.affected ?? 0) + (oldUsed.affected ?? 0);
      if (total > 0) {
        this.logger.log(
          `Cleaned ${total} auth tokens (expired=${expired.affected ?? 0}, used=${oldUsed.affected ?? 0})`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to clean expired auth tokens',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
