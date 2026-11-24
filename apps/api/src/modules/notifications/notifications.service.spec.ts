import { NotFoundException } from '@nestjs/common';
import { type Repository } from 'typeorm';
import { type User } from '../users/user.entity.js';
import { type Notification, NotificationType } from './notification.entity.js';
import { ReminderType } from './notifications.dto.js';
import { dedupKeys, NotificationsService } from './notifications.service.js';

function setup(user: Partial<User> | null = null, stored: Notification | null = null) {
  const query = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue([]),
  };
  const notifications = {
    createQueryBuilder: vi.fn(() => query),
    countBy: vi.fn().mockResolvedValue(0),
    findOneBy: vi.fn().mockResolvedValue(stored),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const users = { findOne: vi.fn().mockResolvedValue(user) };
  const service = new NotificationsService(
    notifications as unknown as Repository<Notification>,
    users as unknown as Repository<User>,
  );
  return { service, notifications, users };
}

const notification = (readAt: Date | null): Notification =>
  ({
    id: 'n-1',
    userId: 'user-1',
    type: NotificationType.Welcome,
    data: null,
    dedupKey: 'welcome',
    readAt,
    createdAt: new Date('2026-11-01T00:00:00Z'),
  }) as Notification;

describe('NotificationsService', () => {
  it('names one dedup key per event', () => {
    expect(dedupKeys.welcome()).toBe('welcome');
    expect(dedupKeys.premiumActivated('sub-1')).toBe('premium-activated:sub-1');
  });

  describe('reminders', () => {
    it('reminds an unverified password account to verify its email', async () => {
      const { service } = setup({ passwordHash: 'hash', emailVerifiedAt: null });

      const page = await service.list('user-1', 20);

      expect(page.reminders).toEqual([{ type: ReminderType.VerifyEmail }]);
    });

    it.each([
      ['a verified password account', { passwordHash: 'hash', emailVerifiedAt: new Date() }],
      ['a Google-only account', { passwordHash: null, emailVerifiedAt: null }],
    ])('has no reminder for %s', async (_name, user) => {
      const { service } = setup(user);

      expect((await service.list('user-1', 20)).reminders).toEqual([]);
    });
  });

  describe('markRead', () => {
    it('looks the notification up by id and owner, and 404s otherwise', async () => {
      const { service, notifications } = setup();

      await expect(service.markRead('user-2', 'n-1')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.markRead('user-2', 'n-1')).rejects.toMatchObject({
        response: { code: 'NOTIFICATION_NOT_FOUND' },
      });
      expect(notifications.findOneBy).toHaveBeenCalledWith({ id: 'n-1', userId: 'user-2' });
      expect(notifications.update).not.toHaveBeenCalled();
    });

    it('sets readAt once and keeps it on later calls', async () => {
      const unread = setup(null, notification(null));
      const read = await unread.service.markRead('user-1', 'n-1');
      expect(read.readAt).toEqual(expect.any(String));
      expect(unread.notifications.update).toHaveBeenCalledOnce();

      const earlier = new Date('2026-11-02T00:00:00Z');
      const already = setup(null, notification(earlier));
      const again = await already.service.markRead('user-1', 'n-1');
      expect(again.readAt).toBe(earlier.toISOString());
      expect(already.notifications.update).not.toHaveBeenCalled();
    });
  });
});
