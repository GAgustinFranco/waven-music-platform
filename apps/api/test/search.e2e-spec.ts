import request from 'supertest';
import { DataSource } from 'typeorm';
import { TrackStatus } from '../src/modules/catalog/entities/track.entity.js';
import { insertCatalog } from './fixtures.js';
import { createTestApp, resetDatabase, type TestApp, testLogin } from './utils.js';

interface Named {
  id: string;
  title?: string;
  name?: string;
}

interface Results {
  tracks: Named[];
  albums: Named[];
  artists: Named[];
  topResult: { type: string; id: string } | null;
}

describe('Search (e2e)', () => {
  let ctx: TestApp;
  let user: { Authorization: string };
  let cafeArtistId: string;
  let cafeTrackId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.app);
    const login = await testLogin(ctx.server, { email: 'searcher@waven.test' });
    user = { Authorization: `Bearer ${login.accessToken}` };

    const cafe = await insertCatalog(ctx.app, {
      artist: 'Café Tacvba',
      album: 'Mañana en el Café',
      tracks: [{ title: 'Café de la Esquina', playCount: 5 }, { title: 'Eres' }],
    });
    cafeArtistId = cafe.artistId;
    cafeTrackId = cafe.trackIds[0] ?? '';
    await insertCatalog(ctx.app, {
      artist: 'Night Owls',
      album: 'Midnight Drive',
      tracks: [{ title: 'Midnight Drive' }, { title: '100% Pure' }],
    });
    // Nothing public: an artist and album whose only tracks are pending or deleted.
    await insertCatalog(ctx.app, {
      artist: 'Hidden Cafe Band',
      album: 'Hidden Cafe Album',
      tracks: [
        { title: 'Hidden Cafe Pending', status: TrackStatus.Pending },
        { title: 'Hidden Cafe Deleted', deleted: true },
      ],
    });
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  const search = async (query: Record<string, string | number>, status = 200) =>
    (await request(ctx.server).get('/search').query(query).set(user).expect(status))
      .body as Results;

  const titles = (items: Named[]) => items.map((item) => item.title ?? item.name);

  it('ignores accents and case: "cafe" finds "Café"', async () => {
    const results = await search({ q: 'cafe' });

    expect(titles(results.artists)).toEqual(['Café Tacvba']);
    expect(titles(results.albums)).toEqual(['Mañana en el Café']);
    expect(titles(results.tracks)).toEqual(['Café de la Esquina']);
    expect(titles((await search({ q: 'MAÑANA' })).albums)).toEqual(['Mañana en el Café']);
  });

  it('tolerates a simple typo', async () => {
    expect(titles((await search({ q: 'midnigth' })).tracks)).toEqual(['Midnight Drive']);
    expect(titles((await search({ q: 'caffe' })).artists)).toEqual(['Café Tacvba']);
  });

  it('only searches the public catalog', async () => {
    const results = await search({ q: 'hidden' });

    expect(results).toEqual({ tracks: [], albums: [], artists: [], topResult: null });
  });

  it('picks a top result across types, preferring an exact artist', async () => {
    const results = await search({ q: 'café tacvba' });

    expect(results.topResult).toEqual({ type: 'artist', id: cafeArtistId });
    expect((await search({ q: 'café de la esquina' })).topResult).toEqual({
      type: 'track',
      id: cafeTrackId,
    });
  });

  it('filters by type and caps each list', async () => {
    const tracks = await search({ q: 'cafe', type: 'track' });
    expect(titles(tracks.tracks)).toEqual(['Café de la Esquina']);
    expect(tracks.artists).toEqual([]);
    expect(tracks.albums).toEqual([]);
    expect(tracks.topResult).toBeNull();

    const capped = await search({ q: 'midnight', limit: 1 });
    expect(capped.tracks).toHaveLength(1);
    expect(capped.albums).toHaveLength(1);
  });

  it('treats LIKE wildcards literally', async () => {
    expect(titles((await search({ q: '%' })).tracks)).toEqual(['100% Pure']);
    expect((await search({ q: '_' })).tracks).toEqual([]);
  });

  it('returns nothing for a blank query and validates the parameters', async () => {
    expect(await search({ q: '   ' })).toEqual({
      tracks: [],
      albums: [],
      artists: [],
      topResult: null,
    });

    const invalid: Record<string, string | number>[] = [
      {},
      { q: 'x'.repeat(101) },
      { q: 'a', type: 'song' },
      { q: 'a', limit: 0 },
    ];
    for (const query of invalid) {
      const body = (await search(query, 400)) as unknown as { code: string };
      expect(body.code).toBe('VALIDATION_FAILED');
    }
  });

  it('requires authentication', async () => {
    await request(ctx.server).get('/search').query({ q: 'cafe' }).expect(401);
  });

  it('can use the trigram indexes', async () => {
    const db = ctx.app.get(DataSource);
    const plan = await db.transaction(async (manager) => {
      // The test catalog is tiny, so force the planner off sequential scans.
      await manager.query('SET LOCAL enable_seqscan = off');
      const rows: { 'QUERY PLAN': string }[] = await manager.query(
        `EXPLAIN SELECT 1 FROM "tracks"
          WHERE f_unaccent(lower("title")) LIKE f_unaccent(lower('%cafe%'))
             OR f_unaccent(lower('cafe')) <% f_unaccent(lower("title"))`,
      );
      return rows.map((row) => row['QUERY PLAN']).join('\n');
    });

    expect(plan).toContain('IDX_tracks_title_trgm');
  });
});
