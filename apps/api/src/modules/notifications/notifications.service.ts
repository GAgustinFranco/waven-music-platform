import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, IsNull, Repository } from 'typeorm';
import { User } from '../users/user.entity.js';
import { Notification, NotificationType } from './notification.entity.js';
import {
  NotificationDto,
  type NotificationsPageDto,
  type ReminderDto,
  ReminderType,
} from './notifications.dto.js';

export interface NewNotification {
  userId: string;
  type: NotificationType;
  /** Names the event; the same key for the same user is stored once. */
  dedupKey: string;
  data?: Record<string, string> | null;
}

/** Dedup keys, one per event a notification reports. */
export const dedupKeys = {
  welcome: () => 'welcome',
  premiumActivated: (subscriptionId: string) => `premium-activated:${subscriptionId}`,
};

const notFound = () =>
  new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' });

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * Stores a notification unless one with the same (user, dedupKey) exists,
   * so retries and races are no-ops. Pass `manager` to write it in the
   * caller's transaction. Returns whether a row was inserted.
   */
  async notify(input: NewNotification, manager?: EntityManager): Promise<boolean> {
    const result = await (manager ?? this.notifications.manager)
      .createQueryBuilder()
      .insert()
      .into(Notification)
      .values({
        userId: input.userId,
        type: input.type,
        dedupKey: input.dedupKey,
        data: input.data ?? null,
      })
      .orIgnore()
      .returning(['id'])
      .execute();
    return (result.raw as unknown[]).length > 0;
  }

  /**
   * Newest first, keyset pagination on (createdAt, id) like the play history;
   * an unknown cursor yields an empty page. The unread count and the
   * reminders cover the whole account, not only this page.
   */
  async list(userId: string, limit: number, cursor?: string): Promise<NotificationsPageDto> {
    const query = this.notifications
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .limit(limit + 1);
    if (cursor) {
      query.andWhere(
        `("n"."created_at", "n"."id") < (
          SELECT "c"."created_at", "c"."id" FROM "notifications" "c"
           WHERE "c"."id" = :cursor AND "c"."user_id" = :userId)`,
        { cursor },
      );
    }
    const [rows, unreadCount, reminders] = await Promise.all([
      query.getMany(),
      this.notifications.countBy({ userId, readAt: IsNull() }),
      this.reminders(userId),
    ]);
    const page = rows.slice(0, limit);
    return {
      items: page.map((notification) => NotificationDto.from(notification)),
      nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
      unreadCount,
      reminders,
    };
  }

  /** Marks one of the user's notifications read; someone else's is a 404. Idempotent. */
  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const notification = await this.notifications.findOneBy({ id, userId });
    if (!notification) {
      throw notFound();
    }
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notifications.update({ id, userId }, { readAt: notification.readAt });
    }
    return NotificationDto.from(notification);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifications.update({ userId, readAt: IsNull() }, { readAt: new Date() });
  }

  /**
   * Reminders are derived from the account on every read, so verifying the
   * email resolves "verify your email" with nothing else to update.
   */
  private async reminders(userId: string): Promise<ReminderDto[]> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, passwordHash: true, emailVerifiedAt: true },
    });
    const reminders: ReminderDto[] = [];
    if (user?.passwordHash && !user.emailVerifiedAt) {
      reminders.push({ type: ReminderType.VerifyEmail });
    }
    return reminders;
  }
}
