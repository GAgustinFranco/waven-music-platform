import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module.js';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';
import { PlayHistory } from './play-history.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([PlayHistory]), CatalogModule],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
