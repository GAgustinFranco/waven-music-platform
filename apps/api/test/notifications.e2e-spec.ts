import request from 'supertest';
import { DataSource } from 'typeorm';
import { MAIL_DRIVER } from '../src/modules/mail/mail.types.js';
import { type MemoryMailDriver } from '../src/modules/mail/memory-mail.driver.js';
import { NotificationType } from '../src/modules/notifications/notification.entity.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';
import { createTestApp, resetDatabase, type TestApp, testLogin, TRUSTED_HEADERS } from './utils.js';

interface NotificationsPage {
  items: { id: string; type: string; data: Record<string, string> | null; readAt: string | null }[];
  nextCursor: string | null;
  unreadCount: number;
  reminders: { type: string }[];
}

describe('Notifications (e2e)', () => {
  let ctx: TestApp;
  let mail: MemoryMailDriver;

  beforeAll(async () => {
    ctx = await createTestApp();
    mail = ctx.app.get<MemoryMailDriver>(MAIL_DRIVER);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.app);
    mail.clear();
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const list = async (auth: { Authorization: string }, query = ''): Promise<NotificationsPage> =>
    (await request(ctx.server).get(`/notifications${query}`).set(auth).expect(200))
      .body as NotificationsPage;

  const userId = async (email: string): Promise<string> => {
    const rows: { id: string }[] = await ctx.app
      .get(DataSource)
      .query('SELECT "id" FROM "users" WHERE "email" = $1', [email]);
    return rows[0]?.id ?? '';
  };

  it('requires a session', async () => {
    await request(ctx.server).get('/notifications').expect(401);
  });

  it('welcomes a password account and reminds it to verify until it does', async () => {
    const registered = await request(ctx.server)
      .post('/auth/register')
      .set(TRUSTED_HEADERS)
      .send({ email: 'new@waven.test', password: 'correct horse battery', displayName: 'New' })
      .expect(201);
    const auth = bearer((registered.body as { accessToken: string }).accessToken);

    const before = await list(auth);
    expect(before).toMatchObject({
      items: [{ type: NotificationType.Welcome, data: null, readAt: null }],
      nextCursor: null,
      unreadCount: 1,
      reminders: [{ type: 'verify-email' }],
    });

    const url = /http:\/\/localhost:3000\/verify-email\?token=\S+/.exec(
      mail.to('new@waven.test')[0]?.text ?? '',
    )?.[0];
    const token = new URL(url ?? 'http://invalid').searchParams.get('token') ?? '';
    await request(ctx.server).post('/auth/verify-email').send({ token }).expect(204);

    const after = await list(auth);
    expect(after.reminders).toEqual([]);
    expect(after.items).toHaveLength(1);
  });

  it('welcomes a Google account once and never asks it to verify', async () => {
    await testLogin(ctx.server, { email: 'google@waven.test' });
    const again = await testLogin(ctx.server, { email: 'google@waven.test' });

    const page = await list(bearer(again.accessToken));
    expect(page.items.map((item) => item.type)).toEqual([NotificationType.Welcome]);
    expect(page.reminders).toEqual([]);
  });

  it('stores one notification per dedup key, even under concurrent writes', async () => {
    const login = await testLogin(ctx.server, { email: 'racer@waven.test' });
    const id = await userId('racer@waven.test');
    const notifications = ctx.app.get(NotificationsService);

    const inserted = await Promise.all(
      Array.from({ length: 5 }, () =>
        notifications.notify({
          userId: id,
          type: NotificationType.PremiumActivated,
          dedupKey: 'premium-activated:same-subscription',
          data: { subscriptionId: 'same-subscription' },
        }),
      ),
    );

    expect(inserted.filter(Boolean)).toHaveLength(1);
    const page = await list(bearer(login.accessToken));
    expect(page.items.filter((item) => item.type === NotificationType.PremiumActivated)).toEqual([
      expect.objectContaining({ data: { subscriptionId: 'same-subscription' } }),
    ]);
  });

  it('marks one read, then all, and keeps the unread count in step', async () => {
    const login = await testLogin(ctx.server, { email: 'reader@waven.test' });
    const auth = bearer(login.accessToken);
    const id = await userId('reader@waven.test');
    const notifications = ctx.app.get(NotificationsService);
    for (const key of ['a', 'b']) {
      await notifications.notify({
        userId: id,
        type: NotificationType.PremiumActivated,
        dedupKey: `premium-activated:${key}`,
        data: { subscriptionId: key },
      });
    }
    const [first] = (await list(auth)).items;

    const read = await request(ctx.server)
      .patch(`/notifications/${first?.id ?? ''}/read`)
      .set(auth)
      .expect(200);
    expect(read.body).toMatchObject({ id: first?.id, readAt: expect.any(String) });
    expect((await list(auth)).unreadCount).toBe(2);

    // Marking it again is a no-op that keeps the first read time.
    const again = await request(ctx.server)
      .patch(`/notifications/${first?.id ?? ''}/read`)
      .set(auth)
      .expect(200);
    expect(again.body.readAt).toBe(read.body.readAt);

    await request(ctx.server).post('/notifications/read-all').set(auth).expect(204);
    const page = await list(auth);
    expect(page.unreadCount).toBe(0);
    expect(page.items.every((item) => item.readAt !== null)).toBe(true);
  });

  it("answers 404 for someone else's notification and 400 for an invalid id", async () => {
    const owner = await testLogin(ctx.server, { email: 'owner@waven.test' });
    const intruder = await testLogin(ctx.server, { email: 'intruder@waven.test' });
    const [notification] = (await list(bearer(owner.accessToken))).items;

    const response = await request(ctx.server)
      .patch(`/notifications/${notification?.id ?? ''}/read`)
      .set(bearer(intruder.accessToken))
      .expect(404);
    expect(response.body).toMatchObject({ statusCode: 404, code: 'NOTIFICATION_NOT_FOUND' });
    expect((await list(bearer(owner.accessToken))).unreadCount).toBe(1);

    // read-all only touches the caller's own notifications.
    await request(ctx.server)
      .post('/notifications/read-all')
      .set(bearer(intruder.accessToken))
      .expect(204);
    expect((await list(bearer(owner.accessToken))).unreadCount).toBe(1);

    await request(ctx.server)
      .patch('/notifications/not-a-uuid/read')
      .set(bearer(owner.accessToken))
      .expect(400);
  });

  it('pages newest first with a cursor', async () => {
    const login = await testLogin(ctx.server, { email: 'pager@waven.test' });
    const auth = bearer(login.accessToken);
    const id = await userId('pager@waven.test');
    const notifications = ctx.app.get(NotificationsService);
    for (const key of ['1', '2', '3']) {
      await notifications.notify({
        userId: id,
        type: NotificationType.PremiumActivated,
        dedupKey: `premium-activated:${key}`,
        data: { subscriptionId: key },
      });
    }

    const first = await list(auth, '?limit=2');
    expect(first.items.map((item) => item.data?.subscriptionId)).toEqual(['3', '2']);
    expect(first.unreadCount).toBe(4);

    const second = await list(auth, `?limit=2&cursor=${first.nextCursor ?? ''}`);
    expect(second.items.map((item) => item.data?.subscriptionId ?? 'welcome')).toEqual([
      '1',
      'welcome',
    ]);
    expect(second.nextCursor).toBeNull();

    await request(ctx.server).get('/notifications?limit=0').set(auth).expect(400);
    await request(ctx.server).get('/notifications?cursor=nope').set(auth).expect(400);
  });
});
