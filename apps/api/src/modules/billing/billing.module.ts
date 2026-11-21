import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSubscriptionsController } from './admin-subscriptions.controller.js';
import { Subscription } from './subscription.entity.js';
import { SubscriptionsService } from './subscriptions.service.js';

/** Phase 8 only stores and lists subscriptions; checkout and webhooks arrive in phase 9. */
@Module({
  imports: [TypeOrmModule.forFeature([Subscription])],
  controllers: [AdminSubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class BillingModule {}
