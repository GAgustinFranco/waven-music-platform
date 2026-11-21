import { spawn } from 'node:child_process';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseFile } from 'music-metadata';
import sharp from 'sharp';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { darkenForContrast, toHex } from './color.js';
import { bundledFfmpegPath } from './ffmpeg-path.js';
import { type Job, JobQueue } from './job-queue.js';

/** Square WebP variants generated for covers and artist images. */
export const IMAGE_SIZES = [64, 300, 640] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export const AUDIO_BITRATES = { std: 128, high: 320 } as const;

export interface ProcessedImage {
  variants: { size: ImageSize; data: Buffer }[];
  /** `#rrggbb`, already darkened for AA contrast with the text color. */
  dominantColor: string;
}

const MAX_IMAGE_PIXELS = 40_000_000;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly ffmpegPath: string | null;
  private readonly queue: JobQueue;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.ffmpegPath = config.get('FFMPEG_PATH', { infer: true }) ?? bundledFfmpegPath;
    this.queue = new JobQueue(config.get('MEDIA_CONCURRENCY', { infer: true }), (error) =>
      this.logger.error(`Media job failed: ${error instanceof Error ? error.message : error}`),
    );
  }

  /** Runs a job in the background, at most `MEDIA_CONCURRENCY` at a time. */
  enqueue(job: Job): void {
    this.queue.enqueue(job);
  }

  onIdle(): Promise<void> {
    return this.queue.onIdle();
  }

  /** Transcodes any supported input to a stereo 44.1 kHz CBR MP3 without metadata. */
  transcodeToMp3(input: string, output: string, kbps: number): Promise<void> {
    const ffmpeg = this.ffmpegPath;
    if (!ffmpeg) {
      return Promise.reject(new Error('ffmpeg is not available; set FFMPEG_PATH'));
    }
    const args = [
      ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y'],
      ['-i', input, '-map', '0:a:0', '-vn', '-map_metadata', '-1'],
      ['-c:a', 'libmp3lame', '-b:a', `${kbps}k`, '-ar', '44100', '-ac', '2', '-f', 'mp3', output],
    ].flat();

    return new Promise((resolve, reject) => {
      const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        stderr = (stderr + chunk).slice(-2000);
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
        }
      });
    });
  }

  async probeDurationMs(path: string): Promise<number> {
    const metadata = await parseFile(path, { duration: true, skipCovers: true });
    const seconds = metadata.format.duration;
    if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
      throw new Error('Could not read the audio duration');
    }
    return Math.round(seconds * 1000);
  }

  /** Resizes to square WebP variants and extracts the dominant color. */
  async processImage(input: Buffer): Promise<ProcessedImage> {
    const image = sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS }).rotate();
    const variants = await Promise.all(
      IMAGE_SIZES.map(async (size) => ({
        size,
        data: await image
          .clone()
          .resize(size, size, { fit: 'cover' })
          .webp({ quality: 82 })
          .toBuffer(),
      })),
    );
    const { dominant } = await image.clone().stats();
    return { variants, dominantColor: toHex(darkenForContrast(dominant)) };
  }
}
