import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SearchPageQueryDto } from '../../common/dto/pagination.dto.js';
import { PaymentMode, type Subscription, SubscriptionStatus } from './subscription.entity.js';

export class AdminSubscriptionQueryDto extends SearchPageQueryDto {
  @ApiPropertyOptional({ enum: SubscriptionStatus, enumName: 'SubscriptionStatus' })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}

export class SubscriptionUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  displayName: string;
}

export class AdminSubscriptionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: SubscriptionUserDto })
  user: SubscriptionUserDto;

  @ApiProperty()
  provider: string;

  @ApiProperty({ enum: PaymentMode, enumName: 'PaymentMode' })
  mode: PaymentMode;

  @ApiProperty({ enum: SubscriptionStatus, enumName: 'SubscriptionStatus' })
  status: SubscriptionStatus;

  @ApiProperty({ description: 'In major units (for example, 2999.00 ARS).' })
  amount: number;

  @ApiProperty({ example: 'ARS' })
  currency: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  currentPeriodEnd: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  cancelledAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static from(subscription: Subscription): AdminSubscriptionDto {
    return {
      id: subscription.id,
      user: {
        id: subscription.user.id,
        email: subscription.user.email,
        displayName: subscription.user.displayName,
      },
      provider: subscription.provider,
      mode: subscription.mode,
      status: subscription.status,
      amount: subscription.amount,
      currency: subscription.currency,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
      createdAt: subscription.createdAt.toISOString(),
    };
  }
}

export class AdminSubscriptionPageDto {
  @ApiProperty({ type: [AdminSubscriptionDto] })
  items: AdminSubscriptionDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}
