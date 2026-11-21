import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { requiredPlayMs } from '../src/modules/history/history.service.js';
import { createReadyTrack, insertCatalog, makeTone, type SeededTrack } from './fixtures.js';
import { createTestApp, resetDatabase, type TestApp, testLogin } from './utils.js';

describe('History (e2e)', () => {
  let ctx: TestApp;
  let fan: { Authorization: string };
  let seeded: SeededTrack;
  /** The fixture tone lasts about 3 s, so a full play is the threshold. */
  let threshold: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.app);
    const admin = await testLogin(ctx.server, { email: 'admin@waven.test', admin: true });
    seeded = await createReadyTrack(ctx.app, ctx.server, admin.accessToken, {
      artist: 'History Artist',
      album: 'History Album',
      title: 'Count Me',
      audioPath: await makeTone('history-tone.wav', 3),
    });
    const fanLogin = await testLogin(ctx.server, { email: 'fan@waven.test' });
    fan = { Authorization: `Bearer ${fanLogin.accessToken}` };
    const [row]: { duration_ms: number }[] = await ctx.app
      .get(DataSource)
      .query('SELECT duration_ms FROM tracks WHERE id = $1', [seeded.trackId]);
    threshold = requiredPlayMs(row?.duration_ms ?? null);
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  async function stats(): Promise<{ playCount: number; rows: number }> {
    const db = ctx.app.get(DataSource);
    const [track]: { play_count: number }[] = await db.query(
      'SELECT play_count FROM tracks WHERE id = $1',
      [seeded.trackId],
    );
    const [history]: { count: string }[] = await db.query(
      'SELECT count(*) FROM play_history WHERE track_id = $1',
      [seeded.trackId],
    );
    return { playCount: track?.play_count ?? -1, rows: Number(history?.count ?? -1) };
  }

  const report = (body: Record<string, unknown>) =>
    request(ctx.server).post('/me/history').set(fan).send(body);

  const validPlay = () => ({
    playId: randomUUID(),
    trackId: seeded.trackId,
    msPlayed: threshold,
    context: 'album',
  });

  it('records a full play of a short track and increments playCount', async () => {
    const before = await stats();

    await report(validPlay()).expect(204);

    expect(await stats()).toEqual({ playCount: before.playCount + 1, rows: before.rows + 1 });
  });

  it('ignores a repeated playId', async () => {
    const body = validPlay();
    await report(body).expect(204);
    const after = await stats();

    await report(body).expect(204);

    expect(await stats()).toEqual(after);
  });

  it('rejects a play shorter than the threshold with PLAY_TOO_SHORT', async () => {
    const before = await stats();

    const response = await report({ ...validPlay(), msPlayed: threshold - 1 }).expect(422);

    expect(response.body).toMatchObject({ statusCode: 422, code: 'PLAY_TOO_SHORT' });
    expect(await stats()).toEqual(before);
  });

  it('returns 404 for an unknown track', async () => {
    const response = await report({ ...validPlay(), trackId: randomUUID() }).expect(404);

    expect(response.body.code).toBe('TRACK_NOT_FOUND');
  });

  it('validates the body', async () => {
    const response = await report({
      playId: 'not-a-uuid',
      trackId: seeded.trackId,
      msPlayed: -1,
      context: 'radio',
    }).expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  it('requires authentication', async () => {
    await request(ctx.server).post('/me/history').send(validPlay()).expect(401);
  });

  describe('listing and recently played', () => {
    let listener: { Authorization: string };
    let trackIds: string[];

    const play = (trackId: string, auth = listener) =>
      request(ctx.server)
        .post('/me/history')
        .set(auth)
        .send({ playId: randomUUID(), trackId, msPlayed: 60_000, context: 'search' })
        .expect(204);

    const page = async (query: Record<string, string | number> = {}) =>
      (await request(ctx.server).get('/me/history').query(query).set(listener).expect(200))
        .body as {
        items: { id: string; available: boolean; context: string; track: { title: string } }[];
        nextCursor: string | null;
      };

    beforeAll(async () => {
      const login = await testLogin(ctx.server, { email: 'listener@waven.test' });
      listener = { Authorization: `Bearer ${login.accessToken}` };
      ({ trackIds } = await insertCatalog(ctx.app, {
        artist: 'Listen Artist',
        album: 'Listen Album',
        tracks: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }],
      }));
      const [one = '', two = '', three = ''] = trackIds;
      // Played in this order, so the newest is "One" again.
      for (const id of [one, two, three, two, one]) {
        await play(id);
      }
    });

    it('pages through every play, newest first, without duplicates', async () => {
      const first = await page({ limit: 2 });
      expect(first.items.map((item) => item.track.title)).toEqual(['One', 'Two']);
      expect(first.items[0]).toMatchObject({ available: true, context: 'search' });
      expect(first.nextCursor).toBe(first.items[1]?.id);

      // A play arriving between pages must not shift the next one.
      await play(trackIds[2] ?? '');

      const second = await page({ limit: 2, cursor: first.nextCursor ?? '' });
      const third = await page({ limit: 2, cursor: second.nextCursor ?? '' });
      expect(second.items.map((item) => item.track.title)).toEqual(['Three', 'Two']);
      expect(third.items.map((item) => item.track.title)).toEqual(['One']);
      expect(third.nextCursor).toBeNull();

      const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id);
      expect(new Set(ids).size).toBe(5);
    });

    it("never shows someone else's plays, even with their cursor", async () => {
      const own = await page();
      const fanPage = await request(ctx.server)
        .get('/me/history')
        .query({ cursor: own.items[0]?.id ?? '' })
        .set(fan)
        .expect(200);

      expect(fanPage.body).toEqual({ items: [], nextCursor: null });
      expect(
        (await request(ctx.server).get('/me/history').set(fan).expect(200)).body.items,
      ).not.toHaveLength(0);
    });

    it('validates the query and requires authentication', async () => {
      await request(ctx.server)
        .get('/me/history')
        .query({ cursor: 'nope' })
        .set(listener)
        .expect(400);
      await request(ctx.server).get('/me/history').query({ limit: 51 }).set(listener).expect(400);
      await request(ctx.server).get('/me/history').expect(401);
    });

    it('shows recently played tracks on Home without repeats, hiding deleted ones', async () => {
      const home = async () =>
        (await request(ctx.server).get('/browse/home').set(listener).expect(200)).body as {
          recentlyPlayed: { title: string }[];
        };

      expect((await home()).recentlyPlayed.map((track) => track.title)).toEqual([
        'Three',
        'One',
        'Two',
      ]);

      await ctx.app
        .get(DataSource)
        .query('UPDATE tracks SET deleted_at = now() WHERE id = $1', [trackIds[2]]);
      expect((await home()).recentlyPlayed.map((track) => track.title)).toEqual(['One', 'Two']);

      // The deleted track stays in the history, as unavailable.
      expect((await page()).items[0]).toMatchObject({
        available: false,
        track: { title: 'Three' },
      });
    });
  });
});
