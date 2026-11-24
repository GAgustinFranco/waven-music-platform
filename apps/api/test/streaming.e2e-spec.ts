import request from 'supertest';
import { DataSource } from 'typeorm';
import { type StorageDriver, STORAGE_DRIVER } from '../src/modules/storage/storage.types.js';
import { StreamTokenService } from '../src/modules/streaming/stream-token.service.js';
import { StreamQuality } from '../src/modules/users/plan.js';
import { createReadyTrack, makeTone, type SeededTrack } from './fixtures.js';
import { createTestApp, resetDatabase, type TestApp, testLogin } from './utils.js';

describe('Streaming (e2e)', () => {
  let ctx: TestApp;
  let fan: { Authorization: string };
  let fanId: string;
  let seeded: SeededTrack;
  let other: SeededTrack;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.app);
    const adminLogin = await testLogin(ctx.server, { email: 'admin@waven.test', admin: true });
    const tone = await makeTone('stream-tone.wav', 3);
    seeded = await createReadyTrack(ctx.app, ctx.server, adminLogin.accessToken, {
      artist: 'Stream Artist',
      album: 'Stream Album',
      title: 'Stream Me',
      audioPath: tone,
    });
    other = await createReadyTrack(ctx.app, ctx.server, adminLogin.accessToken, {
      artist: 'Other Artist',
      album: 'Other Album',
      title: 'Other Track',
      audioPath: tone,
    });
    const fanLogin = await testLogin(ctx.server, { email: 'fan@waven.test' });
    fan = { Authorization: `Bearer ${fanLogin.accessToken}` };
    const me = await request(ctx.server).get('/me').set(fan).expect(200);
    fanId = me.body.id as string;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  async function issue(trackId = seeded.trackId) {
    const response = await request(ctx.server)
      .post(`/tracks/${trackId}/stream`)
      .set(fan)
      .expect(200);
    const url = new URL(response.body.url as string);
    return {
      body: response.body as { url: string; quality: string; expiresAt: string },
      path: `${url.pathname.replace(/^\/api/, '')}${url.search}`,
      token: url.searchParams.get('token') ?? '',
    };
  }

  async function storedSize(quality: 'std' | 'high'): Promise<number> {
    const rows: { audio_key_std: string; audio_key_high: string }[] = await ctx.app
      .get(DataSource)
      .query('SELECT audio_key_std, audio_key_high FROM tracks WHERE id = $1', [seeded.trackId]);
    const row = rows[0];
    if (!row) {
      throw new Error('track row missing');
    }
    const key = quality === 'std' ? row.audio_key_std : row.audio_key_high;
    const object = await ctx.app.get<StorageDriver>(STORAGE_DRIVER).stat(key);
    return object?.size ?? -1;
  }

  it('gives a Free user a high-quality URL that serves the 320 kbps file', async () => {
    const { body, path } = await issue();

    expect(body.quality).toBe('high');
    expect(body.url).toMatch(/^http:\/\/localhost:3000\/api\/stream\/[0-9a-f-]{36}\?token=/);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 3500_000);

    const response = await request(ctx.server).get(path).buffer(true).expect(200);
    const highSize = await storedSize('high');
    expect(Number(response.headers['content-length'])).toBe(highSize);
    expect(highSize).toBeGreaterThan(await storedSize('std'));
    expect(response.headers['content-type']).toBe('audio/mpeg');
    expect(response.headers['accept-ranges']).toBe('bytes');
  });

  it('answers a Range request with 206 and a correct Content-Range', async () => {
    const { path } = await issue();
    const size = await storedSize('high');

    const first = await request(ctx.server)
      .get(path)
      .set('Range', 'bytes=0-99')
      .buffer(true)
      .expect(206);
    expect(first.headers['content-range']).toBe(`bytes 0-99/${size}`);
    expect(first.headers['content-length']).toBe('100');

    const tail = await request(ctx.server)
      .get(path)
      .set('Range', 'bytes=-50')
      .buffer(true)
      .expect(206);
    expect(tail.headers['content-range']).toBe(`bytes ${size - 50}-${size - 1}/${size}`);

    const open = await request(ctx.server)
      .get(path)
      .set('Range', `bytes=${size - 10}-`)
      .buffer(true)
      .expect(206);
    expect(open.headers['content-range']).toBe(`bytes ${size - 10}-${size - 1}/${size}`);
    expect(open.headers['content-length']).toBe('10');
  });

  it('answers 416 for a range outside the file', async () => {
    const { path } = await issue();
    const size = await storedSize('high');

    const response = await request(ctx.server).get(path).set('Range', `bytes=${size}-`).expect(416);
    expect(response.headers['content-range']).toBe(`bytes */${size}`);
    expect(response.body).toMatchObject({ statusCode: 416, code: 'RANGE_NOT_SATISFIABLE' });
  });

  it('answers 401 for an expired token', async () => {
    const tokens = ctx.app.get(StreamTokenService);
    const past = new Date(Date.now() - 2 * tokens.ttlSeconds * 1000);
    const { token } = tokens.sign(
      { userId: fanId, trackId: seeded.trackId, quality: StreamQuality.Standard },
      past,
    );

    const response = await request(ctx.server)
      .get(`/stream/${seeded.trackId}?token=${encodeURIComponent(token)}`)
      .expect(401);
    expect(response.body.code).toBe('STREAM_TOKEN_EXPIRED');
  });

  it("answers 401 for another user's token that was tampered with", async () => {
    const { token } = await issue();
    const [encoded, signature] = token.split('.') as [string, string];
    const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as object;
    const forged = Buffer.from(
      JSON.stringify({
        ...claims,
        userId: '99999999-9999-4999-8999-999999999999',
        quality: 'high',
      }),
    ).toString('base64url');

    const response = await request(ctx.server)
      .get(`/stream/${seeded.trackId}?token=${encodeURIComponent(`${forged}.${signature}`)}`)
      .expect(401);
    expect(response.body.code).toBe('STREAM_TOKEN_INVALID');
  });

  it('answers 401 for a token issued for another track, or no token at all', async () => {
    const { token } = await issue(other.trackId);

    await request(ctx.server)
      .get(`/stream/${seeded.trackId}?token=${encodeURIComponent(token)}`)
      .expect(401);
    await request(ctx.server).get(`/stream/${seeded.trackId}`).expect(401);
  });

  it('requires a JWT to issue a stream URL and 404s on unknown tracks', async () => {
    await request(ctx.server).post(`/tracks/${seeded.trackId}/stream`).expect(401);
    await request(ctx.server)
      .post('/tracks/00000000-0000-4000-8000-000000000000/stream')
      .set(fan)
      .expect(404);
  });
});
