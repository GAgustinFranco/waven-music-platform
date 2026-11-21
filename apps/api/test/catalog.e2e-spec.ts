import request from 'supertest';
import { TrackAudioService } from '../src/modules/catalog/track-audio.service.js';
import { createReadyTrack, makePng, makeTone, writeFixture } from './fixtures.js';
import { createTestApp, resetDatabase, type TestApp, testLogin } from './utils.js';

describe('Catalog and admin CRUD (e2e)', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };
  let user: { Authorization: string };
  let adminToken: string;
  let tone: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    tone = await makeTone('catalog-tone.wav', 2);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.app);
    const adminLogin = await testLogin(ctx.server, { email: 'admin@waven.test', admin: true });
    const userLogin = await testLogin(ctx.server, { email: 'fan@waven.test' });
    adminToken = adminLogin.accessToken;
    admin = { Authorization: `Bearer ${adminToken}` };
    user = { Authorization: `Bearer ${userLogin.accessToken}` };
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  describe('admin uploads', () => {
    it('transcodes an uploaded track into both qualities and exposes it publicly', async () => {
      const { artistId, albumId, trackId } = await createReadyTrack(
        ctx.app,
        ctx.server,
        adminToken,
        {
          artist: 'Café Sónico',
          album: 'Night Drive',
          title: 'First Light',
          audioPath: tone,
        },
      );

      const adminTrack = await request(ctx.server)
        .get(`/admin/tracks/${trackId}`)
        .set(admin)
        .expect(200);
      expect(adminTrack.body).toMatchObject({ status: 'ready', source: 'upload' });
      expect(adminTrack.body.durationMs).toBeGreaterThan(1500);

      const artist = await request(ctx.server).get(`/artists/${artistId}`).set(user).expect(200);
      expect(artist.body).toMatchObject({ name: 'Café Sónico', slug: 'cafe-sonico' });
      expect(artist.body.albums).toHaveLength(1);
      expect(artist.body.popularTracks[0]).toMatchObject({ id: trackId, title: 'First Light' });

      const album = await request(ctx.server).get(`/albums/${albumId}`).set(user).expect(200);
      expect(album.body).toMatchObject({ slug: 'night-drive', releaseDate: '2026-01-15' });
      expect(album.body.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(album.body.cover.md).toMatch(
        /^http:\/\/localhost:3000\/api\/media\/images\/.+\/300\.webp$/,
      );
      expect(album.body.tracks).toHaveLength(1);

      const coverPath = new URL(album.body.cover.sm as string).pathname.replace('/api', '');
      const cover = await request(ctx.server).get(coverPath).expect(200);
      expect(cover.headers['content-type']).toBe('image/webp');
      expect(cover.headers['cache-control']).toContain('immutable');
    });

    it('rejects audio uploads with an invalid type, whatever the extension says', async () => {
      const { trackId } = await createDraftTrack();
      const fakeMp3 = await writeFixture('not-audio.mp3', 'definitely not audio');

      const text = await request(ctx.server)
        .post(`/admin/tracks/${trackId}/audio`)
        .set(admin)
        .attach('file', fakeMp3)
        .expect(415);
      expect(text.body).toMatchObject({ statusCode: 415, code: 'INVALID_FILE_TYPE' });

      await request(ctx.server)
        .post(`/admin/tracks/${trackId}/audio`)
        .set(admin)
        .attach('file', await makePng(), 'cover.mp3')
        .expect(415);

      const track = await request(ctx.server)
        .get(`/admin/tracks/${trackId}`)
        .set(admin)
        .expect(200);
      expect(track.body.status).toBe('pending');
    });

    it('rejects covers that are not jpg, png or webp, and requests without a file', async () => {
      const { albumId } = await createDraftTrack();

      const response = await request(ctx.server)
        .post(`/admin/albums/${albumId}/cover`)
        .set(admin)
        .attach('file', Buffer.from('GIF89a........'), 'cover.png')
        .expect(415);
      expect(response.body.code).toBe('INVALID_FILE_TYPE');

      const missing = await request(ctx.server)
        .post(`/admin/albums/${albumId}/cover`)
        .set(admin)
        .expect(400);
      expect(missing.body.code).toBe('FILE_REQUIRED');
    });

    it('rejects covers over 5 MB', async () => {
      const { albumId } = await createDraftTrack();

      await request(ctx.server)
        .post(`/admin/albums/${albumId}/cover`)
        .set(admin)
        .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1, 0xff), 'huge.jpg')
        .expect(413);
    });

    it('marks undecodable audio as failed', async () => {
      const { trackId } = await createDraftTrack();
      const corrupt = await writeFixture(
        'corrupt.mp3',
        Buffer.concat([Buffer.from('ID3'), Buffer.alloc(512)]),
      );

      await request(ctx.server)
        .post(`/admin/tracks/${trackId}/audio`)
        .set(admin)
        .attach('file', corrupt)
        .expect(202);
      await ctx.app.get(TrackAudioService).onIdle();

      const track = await request(ctx.server)
        .get(`/admin/tracks/${trackId}`)
        .set(admin)
        .expect(200);
      expect(track.body.status).toBe('failed');
    });
  });

  describe('admin CRUD', () => {
    it('is admin-only', async () => {
      await request(ctx.server).get('/admin/artists').set(user).expect(403);
      await request(ctx.server).post('/admin/artists').set(user).send({ name: 'X' }).expect(403);
      await request(ctx.server).get('/admin/tracks').expect(401);
    });

    it('validates input and generates unique slugs', async () => {
      await request(ctx.server).post('/admin/artists').set(admin).send({ name: '   ' }).expect(400);
      await request(ctx.server)
        .post('/admin/albums')
        .set(admin)
        .send({ artistId: 'not-a-uuid', title: 'X' })
        .expect(400);

      const first = await request(ctx.server)
        .post('/admin/artists')
        .set(admin)
        .send({ name: 'Echo' })
        .expect(201);
      const second = await request(ctx.server)
        .post('/admin/artists')
        .set(admin)
        .send({ name: 'ECHO!' })
        .expect(201);
      expect([first.body.slug, second.body.slug]).toEqual(['echo', 'echo-2']);

      const renamed = await request(ctx.server)
        .patch(`/admin/artists/${first.body.id}`)
        .set(admin)
        .send({ name: 'Echo Chamber', bio: 'Ambient duo' })
        .expect(200);
      expect(renamed.body).toMatchObject({
        name: 'Echo Chamber',
        slug: 'echo',
        bio: 'Ambient duo',
      });
    });

    it('protects referenced rows and soft-deletes tracks', async () => {
      const { artistId, albumId, trackId } = await createReadyTrack(
        ctx.app,
        ctx.server,
        adminToken,
        {
          artist: 'Delete Me',
          album: 'Gone',
          title: 'Soon',
          audioPath: tone,
        },
      );

      const conflict = await request(ctx.server)
        .delete(`/admin/artists/${artistId}`)
        .set(admin)
        .expect(409);
      expect(conflict.body.code).toBe('ARTIST_HAS_ALBUMS');

      await request(ctx.server).delete(`/admin/tracks/${trackId}`).set(admin).expect(204);
      await request(ctx.server).get(`/tracks/${trackId}`).set(user).expect(404);
      await request(ctx.server).get(`/albums/${albumId}`).set(user).expect(404);
      await request(ctx.server).get(`/admin/tracks/${trackId}`).set(admin).expect(404);

      const albumConflict = await request(ctx.server)
        .delete(`/admin/albums/${albumId}`)
        .set(admin)
        .expect(409);
      expect(albumConflict.body.code).toBe('ALBUM_HAS_TRACKS');
    });

    it('returns 404 for unknown ids', async () => {
      const unknown = '00000000-0000-4000-8000-000000000000';
      await request(ctx.server).get(`/admin/artists/${unknown}`).set(admin).expect(404);
      await request(ctx.server)
        .post('/admin/albums')
        .set(admin)
        .send({ artistId: unknown, title: 'Orphan' })
        .expect(404);
    });
  });

  describe('public catalog', () => {
    it('hides albums and tracks that are not ready', async () => {
      const { artistId, albumId, trackId } = await createDraftTrack();

      await request(ctx.server).get(`/tracks/${trackId}`).set(user).expect(404);
      await request(ctx.server).get(`/albums/${albumId}`).set(user).expect(404);
      await request(ctx.server).get(`/artists/${artistId}`).set(user).expect(404);
      const artists = await request(ctx.server).get('/artists').set(user).expect(200);
      expect(artists.body).toMatchObject({ items: [], total: 0, limit: 20, offset: 0 });
    });

    it('serves the home sections, newest releases first', async () => {
      await createReadyTrack(ctx.app, ctx.server, adminToken, {
        artist: 'Alpha',
        album: 'Old',
        title: 'One',
        audioPath: tone,
      });
      const newer = await createReadyTrack(ctx.app, ctx.server, adminToken, {
        artist: 'Beta',
        album: 'New',
        title: 'Two',
        audioPath: tone,
      });
      await request(ctx.server)
        .patch(`/admin/albums/${newer.albumId}`)
        .set(admin)
        .send({ releaseDate: '2026-10-01' })
        .expect(200);

      const home = await request(ctx.server).get('/browse/home').set(user).expect(200);
      expect(home.body.newReleases.map((album: { title: string }) => album.title)).toEqual([
        'New',
        'Old',
      ]);
      expect(home.body.popularTracks).toHaveLength(2);
      expect(home.body.recentlyPlayed).toEqual([]);

      const albums = await request(ctx.server).get('/albums?limit=1').set(user).expect(200);
      expect(albums.body).toMatchObject({ total: 2, limit: 1 });
      expect(albums.body.items[0].artist).toMatchObject({ name: 'Beta' });
    });

    it('requires a valid access token', async () => {
      await request(ctx.server).get('/browse/home').expect(401);
      await request(ctx.server).get('/artists').expect(401);
    });

    it('never serves audio or unknown keys from /media', async () => {
      await request(ctx.server).get('/media/audio/x/std.mp3').expect(404);
      await request(ctx.server).get('/media/images/../../etc/passwd').expect(404);
    });
  });

  async function createDraftTrack(): Promise<{
    artistId: string;
    albumId: string;
    trackId: string;
  }> {
    const artist = await request(ctx.server)
      .post('/admin/artists')
      .set(admin)
      .send({ name: 'Draft' })
      .expect(201);
    const album = await request(ctx.server)
      .post('/admin/albums')
      .set(admin)
      .send({ artistId: artist.body.id, title: 'Draft Album' })
      .expect(201);
    const track = await request(ctx.server)
      .post('/admin/tracks')
      .set(admin)
      .send({ albumId: album.body.id, title: 'Draft Track', trackNumber: 1 })
      .expect(201);
    expect(track.body.status).toBe('pending');
    return { artistId: artist.body.id, albumId: album.body.id, trackId: track.body.id };
  }
});
