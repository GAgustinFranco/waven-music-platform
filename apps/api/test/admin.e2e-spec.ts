import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TrackStatus } from '../src/modules/catalog/entities/track.entity.js';
import { insertCatalog } from './fixtures.js';
import { createTestApp, refresh, resetDatabase, type TestApp, testLogin } from './utils.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Admin panel API (e2e)', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };
  let adminId: string;
  let fanToken: string;
  let fanRefresh: string;
  let fanId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.app);
    const adminLogin = await testLogin(ctx.server, {
      email: 'boss@waven.test',
      admin: true,
      displayName: 'Boss',
    });
    admin = { Authorization: `Bearer ${adminLogin.accessToken}` };
    const fan = await testLogin(ctx.server, { email: 'fan@waven.test', displayName: 'Fan 100%' });
    fanToken = fan.accessToken;
    fanRefresh = fan.refreshToken;
    await testLogin(ctx.server, { email: 'listener@waven.test', displayName: 'Listener' });

    const db = ctx.app.get(DataSource);
    const ids: { id: string; email: string }[] = await db.query('SELECT id, email FROM users');
    adminId = ids.find((row) => row.email === 'boss@waven.test')?.id ?? '';
    fanId = ids.find((row) => row.email === 'fan@waven.test')?.id ?? '';
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  describe('access', () => {
    it.each([
      '/admin/users',
      '/admin/subscriptions',
      '/admin/stats',
      '/admin/artists',
      '/admin/albums',
      '/admin/tracks',
    ])('GET %s returns 403 to a regular user', async (path) => {
      const response = await request(ctx.server)
        .get(path)
        .auth(fanToken, { type: 'bearer' })
        .expect(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('PATCH /admin/users/:id returns 403 to a regular user', async () => {
      await request(ctx.server)
        .patch(`/admin/users/${fanId}`)
        .auth(fanToken, { type: 'bearer' })
        .send({ role: 'admin' })
        .expect(403);
    });

    it('returns 401 without a token', async () => {
      await request(ctx.server).get('/admin/stats').expect(401);
    });
  });

  describe('users', () => {
    it('searches by email or display name, escaping wildcards', async () => {
      const byEmail = await request(ctx.server)
        .get('/admin/users?q=LISTENER')
        .set(admin)
        .expect(200);
      expect(byEmail.body.items.map((user: { email: string }) => user.email)).toEqual([
        'listener@waven.test',
      ]);

      const byName = await request(ctx.server)
        .get(`/admin/users?q=${encodeURIComponent('100%')}`)
        .set(admin)
        .expect(200);
      expect(byName.body).toMatchObject({ total: 1, items: [{ email: 'fan@waven.test' }] });

      const literalPercent = await request(ctx.server)
        .get(`/admin/users?q=${encodeURIComponent('%')}`)
        .set(admin)
        .expect(200);
      expect(literalPercent.body.total).toBe(1);
    });

    it('filters by role', async () => {
      const response = await request(ctx.server)
        .get('/admin/users?role=admin')
        .set(admin)
        .expect(200);
      expect(response.body).toMatchObject({ total: 1, items: [{ id: adminId, role: 'admin' }] });
    });

    it('rejects an unknown role filter', async () => {
      await request(ctx.server).get('/admin/users?role=owner').set(admin).expect(400);
    });

    it('gets one user and 404s an unknown one', async () => {
      await request(ctx.server)
        .get(`/admin/users/${fanId}`)
        .set(admin)
        .expect(200)
        .expect(({ body }) => expect(body).toMatchObject({ id: fanId, role: 'user' }));
      await request(ctx.server).get(`/admin/users/${randomUUID()}`).set(admin).expect(404);
      await request(ctx.server).get('/admin/users/not-a-uuid').set(admin).expect(400);
    });

    it('does not let an admin remove their own role', async () => {
      const response = await request(ctx.server)
        .patch(`/admin/users/${adminId}`)
        .set(admin)
        .send({ role: 'user' })
        .expect(409);
      expect(response.body).toMatchObject({ statusCode: 409, code: 'CANNOT_DEMOTE_SELF' });

      const [row]: { role: string }[] = await ctx.app
        .get(DataSource)
        .query('SELECT role FROM users WHERE id = $1', [adminId]);
      expect(row?.role).toBe('admin');
    });

    it('validates the body', async () => {
      await request(ctx.server)
        .patch(`/admin/users/${fanId}`)
        .set(admin)
        .send({ role: 'owner' })
        .expect(400);
    });

    it('promotes a user, who gets admin access at the next refresh', async () => {
      await request(ctx.server)
        .patch(`/admin/users/${fanId}`)
        .set(admin)
        .send({ role: 'admin' })
        .expect(200)
        .expect(({ body }) => expect(body).toMatchObject({ id: fanId, role: 'admin' }));

      const refreshed = await refresh(ctx.server, fanRefresh).expect(200);
      const promotedToken = (refreshed.body as { accessToken: string }).accessToken;
      await request(ctx.server)
        .get('/admin/stats')
        .auth(promotedToken, { type: 'bearer' })
        .expect(200);

      // Demoting another admin is allowed.
      await request(ctx.server)
        .patch(`/admin/users/${fanId}`)
        .set(admin)
        .send({ role: 'user' })
        .expect(200)
        .expect(({ body }) => expect(body.role).toBe('user'));
    });
  });

  describe('subscriptions and stats', () => {
    beforeAll(async () => {
      const db = ctx.app.get(DataSource);
      const users: { id: string; email: string }[] = await db.query('SELECT id, email FROM users');
      const idOf = (email: string) => users.find((row) => row.email === email)?.id;
      const future = new Date(Date.now() + 10 * DAY_MS);
      const insert = (userId: string | undefined, status: string, end: Date | null) =>
        db.query(
          `INSERT INTO subscriptions (user_id, provider, mode, status, amount, currency, current_period_end)
           VALUES ($1, 'mercadopago', 'preapproval', $2, 2999, 'ARS', $3)`,
          [userId, status, end],
        );
      await insert(idOf('fan@waven.test'), 'authorized', future);
      // Cancelled but paid until the future: still Premium (business rule 1).
      await insert(idOf('listener@waven.test'), 'cancelled', future);
      await insert(idOf('boss@waven.test'), 'paused', future);

      const { trackIds } = await insertCatalog(ctx.app, {
        artist: 'Stats Artist',
        album: 'Stats Album',
        tracks: [
          { title: 'Hit', playCount: 9 },
          { title: 'B-side', playCount: 2 },
          { title: 'Silent', playCount: 0 },
          { title: 'Waiting', status: TrackStatus.Pending },
          { title: 'Gone', playCount: 50, deleted: true },
        ],
      });
      const fan = idOf('fan@waven.test');
      const play = (trackId: string | undefined, playedAt: Date) =>
        db.query(
          `INSERT INTO play_history (user_id, track_id, play_id, ms_played, context, played_at)
           VALUES ($1, $2, $3, 60000, 'album', $4)`,
          [fan, trackId, randomUUID(), playedAt],
        );
      await play(trackIds[0], new Date());
      await play(trackIds[0], new Date());
      await play(trackIds[1], new Date(Date.now() - 2 * DAY_MS));
      await play(trackIds[1], new Date(Date.now() - 40 * DAY_MS));
    });

    it('lists subscriptions filtered by status, with their owner', async () => {
      const all = await request(ctx.server).get('/admin/subscriptions').set(admin).expect(200);
      expect(all.body.total).toBe(3);
      expect(all.body.items[0]).toMatchObject({
        amount: 2999,
        currency: 'ARS',
        mode: 'preapproval',
      });

      const cancelled = await request(ctx.server)
        .get('/admin/subscriptions?status=cancelled')
        .set(admin)
        .expect(200);
      expect(cancelled.body).toMatchObject({
        total: 1,
        items: [{ status: 'cancelled', user: { email: 'listener@waven.test' } }],
      });

      const byUser = await request(ctx.server)
        .get('/admin/subscriptions?q=boss')
        .set(admin)
        .expect(200);
      expect(byUser.body.items.map((item: { status: string }) => item.status)).toEqual(['paused']);

      await request(ctx.server).get('/admin/subscriptions?status=nope').set(admin).expect(400);
    });

    it('returns dashboard metrics', async () => {
      const response = await request(ctx.server).get('/admin/stats?days=7').set(admin).expect(200);
      const body = response.body as {
        users: Record<string, number>;
        tracks: Record<string, number>;
        playsPerDay: { date: string; plays: number }[];
        topTracks: { title: string; playCount: number; artist: { name: string } }[];
      };

      expect(body.users).toEqual({ total: 3, admins: 1, premium: 2, newLast7Days: 3 });
      expect(body.tracks).toEqual({ total: 4, pending: 1, processing: 0, ready: 3, failed: 0 });

      expect(body.playsPerDay).toHaveLength(7);
      const today = new Date().toISOString().slice(0, 10);
      expect(body.playsPerDay.at(-1)).toEqual({ date: today, plays: 2 });
      expect(body.playsPerDay.reduce((sum, day) => sum + day.plays, 0)).toBe(3);

      expect(body.topTracks).toEqual([
        expect.objectContaining({
          title: 'Hit',
          playCount: 9,
          artist: expect.objectContaining({ name: 'Stats Artist' }),
        }),
        expect.objectContaining({ title: 'B-side', playCount: 2 }),
      ]);
    });

    it('validates the day window', async () => {
      await request(ctx.server).get('/admin/stats?days=0').set(admin).expect(400);
      await request(ctx.server).get('/admin/stats?days=91').set(admin).expect(400);
    });

    it('searches catalog tables by name or title', async () => {
      const tracks = await request(ctx.server).get('/admin/tracks?q=sid').set(admin).expect(200);
      expect(tracks.body.items.map((track: { title: string }) => track.title)).toEqual(['B-side']);

      const albums = await request(ctx.server).get('/admin/albums?q=stats').set(admin).expect(200);
      expect(albums.body.total).toBe(1);

      const artists = await request(ctx.server)
        .get('/admin/artists?q=nobody')
        .set(admin)
        .expect(200);
      expect(artists.body).toMatchObject({ total: 0, items: [] });
    });
  });
});
