import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { bundledFfmpegPath as ffmpegPath } from '../src/modules/media/ffmpeg-path.js';
import sharp from 'sharp';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { TrackAudioService } from '../src/modules/catalog/track-audio.service.js';

const run = promisify(execFile);
const FIXTURES_DIR = join(tmpdir(), 'waven-e2e-fixtures');

/** A short synthetic sine tone, so the tests never need real music. */
export async function makeTone(name: string, seconds = 2, frequency = 440): Promise<string> {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static has no binary for this platform');
  }
  await mkdir(FIXTURES_DIR, { recursive: true });
  const output = join(FIXTURES_DIR, name);
  await run(ffmpegPath, [
    ...['-hide_banner', '-loglevel', 'error', '-y'],
    ...['-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${seconds}`],
    output,
  ]);
  return output;
}

export function makePng(color = { r: 200, g: 40, b: 90 }): Promise<Buffer> {
  return sharp({ create: { width: 32, height: 32, channels: 3, background: color } })
    .png()
    .toBuffer();
}

export async function writeFixture(name: string, data: Buffer | string): Promise<string> {
  await mkdir(FIXTURES_DIR, { recursive: true });
  const path = join(FIXTURES_DIR, name);
  await writeFile(path, data);
  return path;
}

export interface SeededTrack {
  artistId: string;
  albumId: string;
  trackId: string;
}

/** Creates artist → album (with cover) → track and uploads `audioPath`, waiting until it is processed. */
export async function createReadyTrack(
  app: NestExpressApplication,
  server: App,
  adminToken: string,
  options: {
    artist: string;
    album: string;
    title: string;
    audioPath: string;
    trackNumber?: number;
  },
): Promise<SeededTrack> {
  const auth = { Authorization: `Bearer ${adminToken}` };
  const artist = await request(server)
    .post('/admin/artists')
    .set(auth)
    .send({ name: options.artist })
    .expect(201);
  const album = await request(server)
    .post('/admin/albums')
    .set(auth)
    .send({ artistId: artist.body.id, title: options.album, releaseDate: '2026-01-15' })
    .expect(201);
  await request(server)
    .post(`/admin/albums/${album.body.id}/cover`)
    .set(auth)
    .attach('file', await makePng(), 'cover.png')
    .expect(200);
  const track = await request(server)
    .post('/admin/tracks')
    .set(auth)
    .send({ albumId: album.body.id, title: options.title, trackNumber: options.trackNumber ?? 1 })
    .expect(201);
  await request(server)
    .post(`/admin/tracks/${track.body.id}/audio`)
    .set(auth)
    .attach('file', options.audioPath)
    .expect(202);
  await app.get(TrackAudioService).onIdle();

  return { artistId: artist.body.id, albumId: album.body.id, trackId: track.body.id };
}
