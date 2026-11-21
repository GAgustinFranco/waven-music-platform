import { Module } from '@nestjs/common';
import { AuthModule } from '../auth.module.js';
import { TestAuthController } from './test-auth.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [TestAuthController],
})
export class TestAuthModule {}
