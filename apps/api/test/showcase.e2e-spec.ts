import request from 'supertest';
import { DataSource } from 'typeorm';
import { CatalogSource } from '../src/modules/catalog/entities/catalog-source.js';
import { TrackStatus } from '../src/modules/catalog/entities/track.entity.js';
import { insertCatalog } from './fixtures.js';
import { createTestApp, resetDatabase, type TestApp } from './utils.js';

describe('GET /browse/showcase (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.app);
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  async function album(
    name: string,
    options: { source: CatalogSource; cover: boolean; status?: TrackStatus },
  ): Promise<void> {
    const { albumId } = await insertCatalog(ctx.app, {
      artist: `${name} artist`,
      album: name,
      tracks: [{ title: `${name} track`, status: options.status ?? TrackStatus.Ready }],
    });
    await ctx.app
      .get(DataSource)
      .query(
        `UPDATE "albums" SET "source" = $1, "source_id" = $2, "cover_key" = $3 WHERE "id" = $4`,
        [options.source, name, options.cover ? `images/${name}` : null, albumId],
      );
  }

  it('is public and lists only licensed, public covers', async () => {
    await album('jamendo', { source: CatalogSource.Jamendo, cover: true });
    await album('upload', { source: CatalogSource.Upload, cover: true });
    await album('local', { source: CatalogSource.Local, cover: true });
    await album('no-cover', { source: CatalogSource.Jamendo, cover: false });
    await album('draft', {
      source: CatalogSource.Jamendo,
      cover: true,
      status: TrackStatus.Pending,
    });

    const response = await request(ctx.server).get('/browse/showcase').expect(200);

    const covers = response.body.covers as { sm: string; md: string; lg: string }[];
    expect(covers.map((cover) => cover.md).sort()).toEqual([
      'http://localhost:3000/api/media/images/jamendo/300.webp',
      'http://localhost:3000/api/media/images/upload/300.webp',
    ]);
    expect(covers[0]).toEqual({
      sm: expect.stringMatching(/\/64\.webp$/),
      md: expect.stringMatching(/\/300\.webp$/),
      lg: expect.stringMatching(/\/640\.webp$/),
    });
  });

  it('answers an empty list when the catalog is empty', async () => {
    const response = await request(ctx.server).get('/browse/showcase').expect(200);
    expect(response.body).toEqual({ covers: [] });
  });
});
