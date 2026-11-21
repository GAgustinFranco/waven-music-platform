import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { parseFile } from 'music-metadata';
import { CatalogSource } from '../src/modules/catalog/entities/catalog-source.js';
import { TrackStatus } from '../src/modules/catalog/entities/track.entity.js';
import { slugify } from '../src/modules/catalog/slug.js';
import {
  CatalogIngester,
  createCatalogContext,
  errorMessage,
  loadEnvFiles,
  runPool,
  scriptLogger as logger,
} from './lib/catalog-script.js';

/**
 * Imports your own audio files from a folder, reading their tags (SPEC §7).
 *
 *   pnpm -F api catalog:import ~/Music/some-album
 *
 * LOCAL USE ONLY: copyrighted music must never reach a deployed environment,
 * so this refuses to run in production or against S3 storage.
 */

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg']);

loadEnvFiles();
const folderArg = process.argv[2];
if (!folderArg) {
  console.error('Usage: pnpm -F api catalog:import <folder>');
  process.exit(1);
}
if (process.env['NODE_ENV'] === 'production' || process.env['STORAGE_DRIVER'] === 's3') {
  console.error('catalog:import is for local development only (local storage, not production).');
  process.exit(1);
}
// pnpm runs scripts from apps/api; resolve the folder from where the command was typed.
const folder = resolve(process.env['INIT_CWD'] ?? process.cwd(), folderArg);
const concurrency = Number(process.env['MEDIA_CONCURRENCY'] ?? 2) || 2;

async function* audioFiles(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* audioFiles(path);
    } else if (AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      yield path;
    }
  }
}

const app = await createCatalogContext();
const ingester = new CatalogIngester(app, CatalogSource.Local);
const workDir = await mkdtemp(join(tmpdir(), 'waven-import-'));
let imported = 0;
let skipped = 0;

async function importFile(path: string): Promise<void> {
  const sourceId = createHash('sha256').update(path).digest('hex');
  const existing = await ingester.findTrack(sourceId);
  if (existing?.status === TrackStatus.Ready || existing?.deletedAt) {
    skipped += 1;
    return;
  }
  // The transcoder deletes its input, so it gets a copy.
  const copy = join(workDir, `${sourceId}${extname(path)}`);
  try {
    const { common } = await parseFile(path, { duration: false });
    const artistName = (common.albumartist ?? common.artist ?? 'Unknown Artist').slice(0, 200);
    const albumTitle = (common.album ?? 'Unknown Album').slice(0, 200);
    const picture = common.picture?.[0];

    const artist = await ingester.artist(slugify(artistName), artistName);
    const album = await ingester.album(
      `${slugify(artistName)}/${slugify(albumTitle)}`,
      artist,
      albumTitle,
      common.year ? `${common.year}-01-01` : null,
      picture ? () => Promise.resolve(Buffer.from(picture.data)) : undefined,
    );
    await copyFile(path, copy);
    await ingester.track(
      sourceId,
      album,
      {
        title: (common.title ?? basename(path, extname(path))).slice(0, 200),
        trackNumber: Math.min(999, Math.max(1, common.track.no ?? 1)),
        license: null,
        attributionUrl: null,
      },
      copy,
    );
    imported += 1;
    logger.log(`Imported ${artistName} — ${common.title ?? basename(path)}`);
  } catch (error: unknown) {
    logger.warn(`Skipped ${path}: ${errorMessage(error)}`);
  } finally {
    await rm(copy, { force: true });
  }
}

try {
  await runPool(audioFiles(folder), concurrency, importFile);
  logger.log(`Done: ${imported} imported, ${skipped} already in the catalog.`);
} finally {
  await rm(workDir, { recursive: true, force: true });
  await app.close();
}
