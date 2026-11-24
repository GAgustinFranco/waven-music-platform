import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MAX_PAGE_SIZE } from '../../common/dto/pagination.dto.js';
import { type Notification, NotificationType } from './notification.entity.js';

/** Derived from the account's state, never stored; it goes away on its own. */
export enum ReminderType {
  VerifyEmail = 'verify-email',
}

export class NotificationsQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit = 20;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The `nextCursor` of the previous page; omit it for the newest notifications.',
  })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type: NotificationType;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    nullable: true,
    description: 'Type-specific values; the web renders the copy.',
  })
  data: Record<string, string> | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  readAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static from(notification: Notification): NotificationDto {
    return {
      id: notification.id,
      type: notification.type,
      data: notification.data,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}

export class ReminderDto {
  @ApiProperty({ enum: ReminderType, enumName: 'ReminderType' })
  type: ReminderType;
}

export class NotificationsPageDto {
  @ApiProperty({ type: [NotificationDto], description: 'Newest first.' })
  items: NotificationDto[];

  @ApiProperty({
    type: 'string',
    format: 'uuid',
    nullable: true,
    description: 'Pass it as `cursor` for the next page; `null` on the last one.',
  })
  nextCursor: string | null;

  @ApiProperty({ type: 'integer', description: 'Unread stored notifications, across all pages.' })
  unreadCount: number;

  @ApiProperty({
    type: [ReminderDto],
    description: 'Active reminders; they cannot be marked read and leave once resolved.',
  })
  reminders: ReminderDto[];
}
