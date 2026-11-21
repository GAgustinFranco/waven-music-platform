import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogSource } from '../src/modules/catalog/entities/catalog-source.js';
import { TrackStatus } from '../src/modules/catalog/entities/track.entity.js';
import { creativeCommonsName } from '../src/modules/catalog/license.js';
import {
  CatalogIngester,
  createCatalogContext,
  errorMessage,
  loadEnvFiles,
  runPool,
  scriptLogger as logger,
} from './lib/catalog-script.js';

/**
 * Seeds the catalog from Jamendo (Creative Commons music, SPEC §7).
 *
 *   pnpm seed                       # SEED_TRACK_COUNT tracks (default 300)
 *   SEED_TRACK_COUNT=1000 pnpm seed
 *
 * Every Creative Commons license is accepted, including NC ones; each track
 * keeps its license and a link to its Jamendo page for attribution. Running it
 * again skips tracks that are already ready.
 */

const API = 'https://api.jamendo.com/v3.0';
const PAGE_SIZE = 200;
const REQUEST_TIMEOUT_MS = 60_000;

interface JamendoTrack {
  id: string;
  name: string;
  position: number | string;
  releasedate: string;
  artist_id: string;
  artist_name: string;
  album_id: string;
  album_name: string;
  album_image: string;
  license_ccurl: string;
  shareurl: string;
  audio: string;
}

interface JamendoArtist {
  id: string;
  image: string;
}

interface JamendoResponse<T> {
  headers: { status: string; code: number; error_message: string };
  results: T[];
}

loadEnvFiles();
const clientId = process.env['JAMENDO_CLIENT_ID'];
if (!clientId) {
  console.error('JAMENDO_CLIENT_ID is missing. Get one at https://devportal.jamendo.com');
  process.exit(1);
}
const target = Number(process.env['SEED_TRACK_COUNT'] ?? 300);
if (!Number.isInteger(target) || target < 1) {
  console.error('SEED_TRACK_COUNT must be a positive integer');
  process.exit(1);
}
const concurrency = Number(process.env['MEDIA_CONCURRENCY'] ?? 2) || 2;

/**
 * GET that always reads the whole body, even on errors. Leaving a response body
 * unread can crash undici when the server closes the socket, so nothing here
 * streams. Transient failures are retried once.
 */
async function getBytes(url: URL | string, timeoutMs: number): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      const data = Buffer.from(await response.arrayBuffer());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return data;
    } catch (error: unknown) {
      if (attempt >= 2) {
        throw error;
      }
    }
  }
}

async function jamendo<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${API}/${path}/`);
  url.search = new URLSearchParams({
    client_id: clientId ?? '',
    format: 'json',
    ...params,
  }).toString();
  const body = JSON.parse(
    (await getBytes(url, REQUEST_TIMEOUT_MS)).toString('utf8'),
  ) as JamendoResponse<T>;
  if (body.headers.status !== 'success') {
    throw new Error(`Jamendo ${path} failed: ${body.headers.error_message}`);
  }
  return body.results;
}

async function download(url: string, path: string): Promise<void> {
  await writeFile(path, await getBytes(url, 5 * REQUEST_TIMEOUT_MS));
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  return url ? getBytes(url, REQUEST_TIMEOUT_MS).catch(() => null) : null;
}

/**
 * Jamendo serves 300 px covers by default. Its `imagesize` parameter breaks
 * pagination (every page after the first comes back empty), so the size is
 * raised in the image URL instead.
 */
function largeCover(url: string): string {
  return url.replace(/([?&]width=)\d+/, '$1600');
}

/** Most popular tracks first, page by page, skipping anything without audio or a CC license. */
async function* candidates(): AsyncGenerator<JamendoTrack> {
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await jamendo<JamendoTrack>('tracks', {
      limit: String(PAGE_SIZE),
      offset: String(offset),
      order: 'popularity_total',
      audioformat: 'mp32',
    });
    for (const track of page) {
      if (track.audio && creativeCommonsName(track.license_ccurl)) {
        yield track;
      }
    }
    if (page.length < PAGE_SIZE) {
      return;
    }
  }
}

const app = await createCatalogContext();
const ingester = new CatalogIngester(app, CatalogSource.Jamendo);
const workDir = await mkdtemp(join(tmpdir(), 'waven-seed-'));
const artistImages = new Map<string, Promise<Buffer | null>>();

let ready = 0;
let inFlight = 0;
let failed = 0;
const startedAt = Date.now();

async function seedTrack(item: JamendoTrack): Promise<void> {
  const existing = await ingester.findTrack(item.id);
  if (existing?.deletedAt) {
    // Removed by an admin: never bring it back.
    return;
  }
  if (existing?.status === TrackStatus.Ready) {
    ready += 1;
    return;
  }
  inFlight += 1;
  const audioPath = join(workDir, `${item.id}.mp3`);
  try {
    const artist = await ingester.artist(item.artist_id, item.artist_name, () => {
      const cached =
        artistImages.get(item.artist_id) ??
        jamendo<JamendoArtist>('artists', { id: item.artist_id }).then((results) =>
          fetchBuffer(results[0]?.image ?? ''),
        );
      artistImages.set(item.artist_id, cached);
      return cached;
    });
    const album = await ingester.album(
      item.album_id,
      artist,
      item.album_name || item.name,
      /^\d{4}-\d{2}-\d{2}$/.test(item.releasedate) ? item.releasedate : null,
      () => fetchBuffer(largeCover(item.album_image)),
    );
    await download(item.audio, audioPath);
    await ingester.track(
      item.id,
      album,
      {
        title: item.name.slice(0, 200),
        trackNumber: Math.min(999, Math.max(1, Number(item.position) || 1)),
        license: creativeCommonsName(item.license_ccurl),
        attributionUrl: item.shareurl,
      },
      audioPath,
    );
    ready += 1;
    if (ready % 10 === 0) {
      const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
      logger.log(`${ready}/${target} tracks ready (${minutes} min)`);
    }
  } catch (error: unknown) {
    failed += 1;
    logger.warn(`Skipped "${item.name}" by ${item.artist_name}: ${errorMessage(error)}`);
  } finally {
    inFlight -= 1;
    await rm(audioPath, { force: true });
  }
}

try {
  await runPool(candidates(), concurrency, seedTrack, () => ready + inFlight >= target);
  const total = await ingester.countReady();
  logger.log(`Done: ${total} Jamendo tracks ready (${failed} skipped).`);
  if (total < target) {
    logger.warn(`Fewer than ${target} tracks are ready; run the seed again to retry.`);
    process.exitCode = 1;
  }
} finally {
  await rm(workDir, { recursive: true, force: true });
  await app.close();
}
