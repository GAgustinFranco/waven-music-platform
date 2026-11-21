import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { StreamTokenService } from './stream-token.service.js';
import { StreamingController } from './streaming.controller.js';
import { StreamingService } from './streaming.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [StreamingController],
  providers: [StreamingService, StreamTokenService],
  exports: [StreamTokenService],
})
export class StreamingModule {}
