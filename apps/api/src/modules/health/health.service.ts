import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type HealthResponseDto } from './health.dto.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<HealthResponseDto> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error: unknown) {
      this.logger.warn(
        `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database is unreachable',
      });
    }

    return { status: 'ok', database: 'up', uptime: Math.round(process.uptime()) };
  }
}
