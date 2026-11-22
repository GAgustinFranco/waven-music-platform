import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SearchPageQueryDto } from '../../common/dto/pagination.dto.js';
import { PlanLimitsDto } from '../users/dto/user.dto.js';
import { Plan } from '../users/plan.js';
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

export class SubscriptionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: PaymentMode, enumName: 'PaymentMode' })
  mode: PaymentMode;

  @ApiProperty({ enum: SubscriptionStatus, enumName: 'SubscriptionStatus' })
  status: SubscriptionStatus;

  @ApiProperty({ description: 'In major units (for example, 2999.00 ARS).' })
  amount: number;

  @ApiProperty({ example: 'ARS' })
  currency: string;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    nullable: true,
    description: 'End of the paid period: the next charge (preapproval) or the pass end (onetime).',
  })
  currentPeriodEnd: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  cancelledAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static from(subscription: Subscription): SubscriptionDto {
    return {
      id: subscription.id,
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

export class BillingStatusDto {
  @ApiProperty({ enum: Plan, enumName: 'Plan', description: 'Effective plan (business rule 1).' })
  plan: Plan;

  @ApiProperty({
    type: SubscriptionDto,
    nullable: true,
    description: 'The newest subscription, whatever its status.',
  })
  subscription: SubscriptionDto | null;
}

export class PlanOfferDto {
  @ApiProperty({ enum: Plan, enumName: 'Plan' })
  id: Plan;

  @ApiProperty({ example: 'Premium' })
  name: string;

  @ApiProperty({ description: 'In major units; 0 for Free.' })
  amount: number;

  @ApiProperty({ example: 'ARS' })
  currency: string;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    description: 'Days paid by one charge; `null` for Free.',
  })
  periodDays: number | null;

  @ApiProperty({ type: PlanLimitsDto })
  limits: PlanLimitsDto;
}

export class PlansDto {
  @ApiProperty({
    enum: PaymentMode,
    enumName: 'PaymentMode',
    description: '`preapproval` renews every month; `onetime` buys 30 days per payment.',
  })
  mode: PaymentMode;

  @ApiProperty({ type: [PlanOfferDto] })
  items: PlanOfferDto[];
}

export class CheckoutDto {
  @ApiProperty({ format: 'uri', description: 'Mercado Pago checkout to send the browser to.' })
  redirectUrl: string;
}

export class WebhookAckDto {
  @ApiProperty({ enum: ['processed', 'duplicate', 'ignored'] })
  result: 'processed' | 'duplicate' | 'ignored';
}
