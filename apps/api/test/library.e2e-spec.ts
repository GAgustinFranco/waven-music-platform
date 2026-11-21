import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createReadyTrack, makeTone } from './fixtures.js';
import { createTestApp, resetDatabase, type TestApp, testLogin } from './utils.js';

interface Entry {
  id: string;
  position: number;
  available: boolean;
  track: { id: string };
}

interface Detail {
  id: string;
  name: string;
  description: string | null;
  trackCount: number;
  covers: unknown[];
  durationMs: number;
  entries: Entry[];
}

describe('Playlists and favorites (e2e)', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };
  let owner: { Authorization: string };
  let stranger: { Authorization: string };
  /** Three distinct playable tracks: a, b and c. */
  let a: string;
  let b: string;
  let c: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.app);
    const adminLogin = await testLogin(ctx.server, { email: 'admin@waven.test', admin: true });
    admin = { Authorization: `Bearer ${adminLogin.accessToken}` };
    const tone = await makeTone('library-tone.wav', 1);
    const tracks = [];
    for (const name of ['Alpha', 'Bravo', 'Charlie']) {
      tracks.push(
        await createReadyTrack(ctx.app, ctx.server, adminLogin.accessToken, {
          artist: `${name} Artist`,
          album: `${name} Album`,
          title: `${name} Song`,
          audioPath: tone,
        }),
      );
    }
    [a, b, c] = tracks.map((track) => track.trackId) as [string, string, string];
    const ownerLogin = await testLogin(ctx.server, { email: 'owner@waven.test' });
    owner = { Authorization: `Bearer ${ownerLogin.accessToken}` };
    const strangerLogin = await testLogin(ctx.server, { email: 'stranger@waven.test' });
    stranger = { Authorization: `Bearer ${strangerLogin.accessToken}` };
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  beforeEach(async () => {
    await ctx.app.get(DataSource).query('TRUNCATE TABLE "playlists", "favorites" CASCADE');
  });

  const api = () => request(ctx.server);

  async function createPlaylist(body: Record<string, unknown> = {}): Promise<Detail> {
    const response = await api().post('/playlists').set(owner).send(body).expect(201);
    return response.body as Detail;
  }

  async function addTracks(id: string, trackIds: string[], position?: number): Promise<Detail> {
    const response = await api()
      .post(`/playlists/${id}/tracks`)
      .set(owner)
      .send({ trackIds, position })
      .expect(200);
    return response.body as Detail;
  }

  const order = (detail: Detail) => detail.entries.map((entry) => entry.track.id);
  const positions = (detail: Detail) => detail.entries.map((entry) => entry.position);

  describe('CRUD', () => {
    it('creates, lists, renames, describes and deletes a playlist', async () => {
      const created = await createPlaylist();
      expect(created).toMatchObject({
        name: 'My Playlist #1',
        description: null,
        trackCount: 0,
        entries: [],
      });

      const named = await createPlaylist({ name: '  Road trip  ', description: 'Loud' });
      expect(named.name).toBe('Road trip');

      const list = await api().get('/me/playlists').set(owner).expect(200);
      expect(list.body).toMatchObject({ total: 2, limit: 20, offset: 0 });
      expect((list.body as { items: { id: string }[] }).items.map((item) => item.id)).toEqual([
        named.id,
        created.id,
      ]);

      const updated = await api()
        .patch(`/playlists/${created.id}`)
        .set(owner)
        .send({ name: 'Focus', description: 'Deep work' })
        .expect(200);
      expect(updated.body).toMatchObject({ name: 'Focus', description: 'Deep work' });

      const cleared = await api()
        .patch(`/playlists/${created.id}`)
        .set(owner)
        .send({ description: '' })
        .expect(200);
      expect(cleared.body).toMatchObject({ name: 'Focus', description: null });

      await api().delete(`/playlists/${created.id}`).set(owner).expect(204);
      await api().get(`/playlists/${created.id}`).set(owner).expect(404);
    });

    it('validates the body and the ids', async () => {
      await api().post('/playlists').set(owner).send({ name: '' }).expect(400);
      await api()
        .post('/playlists')
        .set(owner)
        .send({ name: 'x'.repeat(101) })
        .expect(400);
      await api().post('/playlists').set(owner).send({ isPublic: true }).expect(400);
      const playlist = await createPlaylist();
      await api().patch(`/playlists/${playlist.id}`).set(owner).send({ name: null }).expect(400);
      await api().get('/playlists/not-a-uuid').set(owner).expect(400);
    });

    it('requires authentication', async () => {
      await api().get('/me/playlists').expect(401);
      await api().post('/playlists').send({}).expect(401);
    });
  });

  describe('plan limit', () => {
    it('rejects the sixth Free playlist with 403 PLAN_LIMIT_REACHED', async () => {
      for (let i = 0; i < 5; i += 1) {
        await createPlaylist();
      }
      const response = await api().post('/playlists').set(owner).send({}).expect(403);
      expect(response.body).toMatchObject({ statusCode: 403, code: 'PLAN_LIMIT_REACHED' });

      // Other users have their own quota.
      await api().post('/playlists').set(stranger).send({}).expect(201);
    });

    it('cannot be bypassed with parallel requests', async () => {
      for (let i = 0; i < 3; i += 1) {
        await createPlaylist();
      }
      const statuses = await Promise.all(
        Array.from({ length: 4 }, () =>
          api()
            .post('/playlists')
            .set(owner)
            .send({})
            .then((response) => response.status),
        ),
      );
      expect(statuses.filter((status) => status === 201)).toHaveLength(2);
      expect(statuses.filter((status) => status === 403)).toHaveLength(2);
    });
  });

  describe('ownership', () => {
    it("returns 404 for someone else's playlist on every route", async () => {
      const playlist = await addTracks((await createPlaylist()).id, [a]);
      const entryId = playlist.entries[0]?.id ?? '';
      const expectNotFound = async (response: request.Test) => {
        const { body } = await response.expect(404);
        expect(body).toMatchObject({ statusCode: 404, code: 'PLAYLIST_NOT_FOUND' });
      };

      await expectNotFound(api().get(`/playlists/${playlist.id}`).set(stranger));
      await expectNotFound(
        api().patch(`/playlists/${playlist.id}`).set(stranger).send({ name: 'Mine now' }),
      );
      await expectNotFound(
        api()
          .post(`/playlists/${playlist.id}/tracks`)
          .set(stranger)
          .send({ trackIds: [b] }),
      );
      await expectNotFound(
        api().delete(`/playlists/${playlist.id}/tracks/${entryId}`).set(stranger),
      );
      await expectNotFound(
        api()
          .patch(`/playlists/${playlist.id}/tracks/${entryId}/position`)
          .set(stranger)
          .send({ position: 0 }),
      );
      await expectNotFound(api().delete(`/playlists/${playlist.id}`).set(stranger));

      // Same answer as a playlist that does not exist at all.
      await expectNotFound(api().get(`/playlists/${randomUUID()}`).set(stranger));

      const list = await api().get('/me/playlists').set(stranger).expect(200);
      expect(list.body).toMatchObject({ total: 0, items: [] });

      // Nothing changed for the owner.
      const mine = await api().get(`/playlists/${playlist.id}`).set(owner).expect(200);
      expect(mine.body).toMatchObject({ name: 'My Playlist #1', trackCount: 1 });
    });
  });

  describe('tracks', () => {
    it('appends, inserts at a position and allows repeats', async () => {
      const { id } = await createPlaylist();
      await addTracks(id, [a, b]);
      const withRepeat = await addTracks(id, [a]);
      expect(order(withRepeat)).toEqual([a, b, a]);

      const inserted = await addTracks(id, [c, c], 1);
      expect(order(inserted)).toEqual([a, c, c, b, a]);
      expect(positions(inserted)).toEqual([0, 1, 2, 3, 4]);
      expect(inserted.trackCount).toBe(5);
      expect(inserted.covers).toHaveLength(3);
      expect(new Set(inserted.entries.map((entry) => entry.id)).size).toBe(5);

      const atEnd = await addTracks(id, [b], 99);
      expect(order(atEnd)).toEqual([a, c, c, b, a, b]);
    });

    it('rejects unknown tracks without adding any', async () => {
      const { id } = await createPlaylist();
      const response = await api()
        .post(`/playlists/${id}/tracks`)
        .set(owner)
        .send({ trackIds: [a, randomUUID()] })
        .expect(404);
      expect(response.body).toMatchObject({ code: 'TRACK_NOT_FOUND' });
      const detail = await api().get(`/playlists/${id}`).set(owner).expect(200);
      expect((detail.body as Detail).trackCount).toBe(0);
    });

    it('caps a playlist at 500 tracks with 409 PLAYLIST_FULL', async () => {
      const { id } = await createPlaylist();
      for (let i = 0; i < 5; i += 1) {
        await addTracks(
          id,
          Array.from({ length: 100 }, () => a),
        );
      }
      const response = await api()
        .post(`/playlists/${id}/tracks`)
        .set(owner)
        .send({ trackIds: [b] })
        .expect(409);
      expect(response.body).toMatchObject({ code: 'PLAYLIST_FULL' });
    });

    it('removes one entry of a repeated track and closes the gap', async () => {
      const { id } = await createPlaylist();
      const before = await addTracks(id, [a, b, a, c]);
      const secondA = before.entries[2]?.id;

      const response = await api()
        .delete(`/playlists/${id}/tracks/${secondA}`)
        .set(owner)
        .expect(200);
      const after = response.body as Detail;
      expect(order(after)).toEqual([a, b, c]);
      expect(positions(after)).toEqual([0, 1, 2]);

      const again = await api().delete(`/playlists/${id}/tracks/${secondA}`).set(owner).expect(404);
      expect(again.body).toMatchObject({ code: 'ENTRY_NOT_FOUND' });
    });

    it('moves entries down, up and past the end', async () => {
      const { id } = await createPlaylist();
      const start = await addTracks(id, [a, b, c]);
      const [ea, eb, ec] = start.entries.map((entry) => entry.id);
      const move = async (entryId: string | undefined, position: number) =>
        (
          await api()
            .patch(`/playlists/${id}/tracks/${entryId}/position`)
            .set(owner)
            .send({ position })
            .expect(200)
        ).body as Detail;

      expect(order(await move(ea, 2))).toEqual([b, c, a]);
      expect(order(await move(ea, 0))).toEqual([a, b, c]);
      const last = await move(eb, 99);
      expect(order(last)).toEqual([a, c, b]);
      expect(positions(last)).toEqual([0, 1, 2]);
      expect(order(await move(ec, 1))).toEqual([a, c, b]);

      await api()
        .patch(`/playlists/${id}/tracks/${ea}/position`)
        .set(owner)
        .send({ position: -1 })
        .expect(400);
    });

    it('keeps positions contiguous under concurrent moves (two tabs)', async () => {
      const { id } = await createPlaylist();
      const start = await addTracks(id, [a, b, c, a, b, c]);
      const ids = start.entries.map((entry) => entry.id);

      await Promise.all(
        ids.map((entryId, index) =>
          api()
            .patch(`/playlists/${id}/tracks/${entryId}/position`)
            .set(owner)
            .send({ position: (index * 5) % ids.length })
            .expect(200),
        ),
      );

      const detail = (await api().get(`/playlists/${id}`).set(owner).expect(200)).body as Detail;
      expect(positions(detail)).toEqual([0, 1, 2, 3, 4, 5]);
      expect([...detail.entries.map((entry) => entry.id)].sort()).toEqual([...ids].sort());
    });

    it('keeps a deleted track as unavailable', async () => {
      const extra = await createReadyTrack(
        ctx.app,
        ctx.server,
        admin.Authorization.slice('Bearer '.length),
        {
          artist: 'Gone Artist',
          album: 'Gone Album',
          title: 'Gone Song',
          audioPath: await makeTone('library-gone.wav', 1),
        },
      );
      const { id } = await createPlaylist();
      await addTracks(id, [a, extra.trackId]);
      await api().delete(`/admin/tracks/${extra.trackId}`).set(admin).expect(204);

      const detail = (await api().get(`/playlists/${id}`).set(owner).expect(200)).body as Detail;
      expect(detail.entries.map((entry) => entry.available)).toEqual([true, false]);
      expect(detail.trackCount).toBe(2);

      // It can no longer be added.
      await api()
        .post(`/playlists/${id}/tracks`)
        .set(owner)
        .send({ trackIds: [extra.trackId] })
        .expect(404);
    });
  });

  describe('favorites', () => {
    it('likes and unlikes idempotently', async () => {
      await api().put(`/me/favorites/${a}`).set(owner).expect(204);
      await api().put(`/me/favorites/${a}`).set(owner).expect(204);
      await api().put(`/me/favorites/${b}`).set(owner).expect(204);

      const list = await api().get('/me/favorites').set(owner).expect(200);
      expect(list.body).toMatchObject({ total: 2 });
      expect(
        (list.body as { items: { track: { id: string } }[] }).items.map((item) => item.track.id),
      ).toEqual([b, a]);

      await api().delete(`/me/favorites/${a}`).set(owner).expect(204);
      await api().delete(`/me/favorites/${a}`).set(owner).expect(204);
      const after = await api().get('/me/favorites').set(owner).expect(200);
      expect(after.body).toMatchObject({ total: 1 });

      // Favorites are per user.
      const theirs = await api().get('/me/favorites').set(stranger).expect(200);
      expect(theirs.body).toMatchObject({ total: 0 });
    });

    it('answers which tracks are liked', async () => {
      await api().put(`/me/favorites/${a}`).set(owner).expect(204);
      await api().put(`/me/favorites/${c}`).set(owner).expect(204);

      const csv = await api()
        .get(`/me/favorites/contains?ids=${a},${b},${c}`)
        .set(owner)
        .expect(200);
      expect(csv.body).toEqual({ trackIds: [a, c] });

      const repeated = await api()
        .get(`/me/favorites/contains?ids=${b}&ids=${c}`)
        .set(owner)
        .expect(200);
      expect(repeated.body).toEqual({ trackIds: [c] });

      await api().get('/me/favorites/contains').set(owner).expect(400);
      await api().get('/me/favorites/contains?ids=nope').set(owner).expect(400);
      const tooMany = Array.from({ length: 51 }, () => randomUUID()).join(',');
      await api().get(`/me/favorites/contains?ids=${tooMany}`).set(owner).expect(400);
    });

    it('returns 404 when liking an unknown track', async () => {
      const response = await api().put(`/me/favorites/${randomUUID()}`).set(owner).expect(404);
      expect(response.body).toMatchObject({ code: 'TRACK_NOT_FOUND' });
      await api().put('/me/favorites/not-a-uuid').set(owner).expect(400);
    });
  });
});
