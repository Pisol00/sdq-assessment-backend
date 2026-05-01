import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AuthToken } from './auth-token.entity';
import { User } from '../users/user.entity';

const USED_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const UNVERIFIED_USER_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Periodically removes data that's no longer useful:
 *  - Auth tokens that are expired or were consumed long ago
 *  - User accounts that signed up but never verified within 7 days
 */
@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(
    @InjectRepository(AuthToken)
    private readonly tokens: Repository<AuthToken>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
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

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupUnverifiedAccounts(): Promise<void> {
    const cutoff = new Date(Date.now() - UNVERIFIED_USER_GRACE_MS);
    try {
      const result = await this.users
        .createQueryBuilder()
        .delete()
        .where('emailVerified = false')
        .andWhere('createdAt < :cutoff', { cutoff })
        .execute();
      if ((result.affected ?? 0) > 0) {
        this.logger.log(
          `Removed ${result.affected} unverified accounts older than 7 days`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to clean unverified accounts',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
