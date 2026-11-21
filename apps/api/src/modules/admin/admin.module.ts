import { Module } from '@nestjs/common';
import { AdminStatsController } from './admin-stats.controller.js';
import { AdminStatsService } from './admin-stats.service.js';

/** Cross-domain admin views. Per-domain admin CRUD lives in its own module. */
@Module({
  controllers: [AdminStatsController],
  providers: [AdminStatsService],
})
export class AdminModule {}
