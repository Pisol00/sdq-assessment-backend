import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const url = config.get<string>('DATABASE_URL');
    const useSsl = config.get<string>('DB_SSL') === 'true';
    const common = {
      type: 'postgres' as const,
      autoLoadEntities: true,
      synchronize: config.get<string>('DB_SYNC') === 'true',
      logging: config.get<string>('DB_LOGGING') === 'true',
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    };
    if (url) {
      return { ...common, url };
    }
    return {
      ...common,
      host: config.get<string>('DB_HOST'),
      port: config.get<number>('DB_PORT'),
      username: config.get<string>('DB_USER'),
      password: config.get<string>('DB_PASSWORD'),
      database: config.get<string>('DB_NAME'),
    };
  },
};
