import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AUDIO_BITRATES, MediaService } from '../media/media.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../storage/storage.types.js';
import { Track, TrackStatus } from './entities/track.entity.js';

/** `audio/<uuid>/std.mp3` → `audio/<uuid>`. */
const audioPrefixOf = (key: string) => key.slice(0, key.lastIndexOf('/'));

/** Transcodes uploaded audio into both qualities and tracks progress in `Track.status`. */
@Injectable()
export class TrackAudioService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TrackAudioService.name);

  constructor(
    @InjectRepository(Track) private readonly tracks: Repository<Track>,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly media: MediaService,
  ) {}

  /** Jobs live in memory, so anything still `processing` after a restart was lost. */
  async onApplicationBootstrap(): Promise<void> {
    const result = await this.tracks.update(
      { status: TrackStatus.Processing },
      { status: TrackStatus.Failed },
    );
    if (result.affected) {
      this.logger.warn(`Marked ${result.affected} interrupted track(s) as failed`);
    }
  }

  /** Marks the track as processing and transcodes in the background. Takes ownership of `inputPath`. */
  async enqueue(track: Track, inputPath: string): Promise<void> {
    await this.tracks.update({ id: track.id }, { status: TrackStatus.Processing });
    track.status = TrackStatus.Processing;
    this.media.enqueue(() => this.process(track.id, inputPath));
  }

  /** Waits for every queued transcoding job. */
  onIdle(): Promise<void> {
    return this.media.onIdle();
  }

  /**
   * Transcodes `inputPath` to 128 and 320 kbps, stores both files and marks the
   * track `ready` (or `failed`). Deletes `inputPath` when done.
   */
  async process(trackId: string, inputPath: string): Promise<void> {
    const workDir = await mkdtemp(join(tmpdir(), 'waven-transcode-'));
    const prefix = `audio/${randomUUID()}`;
    try {
      const std = join(workDir, 'std.mp3');
      const high = join(workDir, 'high.mp3');
      await this.media.transcodeToMp3(inputPath, std, AUDIO_BITRATES.std);
      await this.media.transcodeToMp3(inputPath, high, AUDIO_BITRATES.high);
      const durationMs = await this.media.probeDurationMs(std);

      await this.storage.put(`${prefix}/std.mp3`, { path: std }, 'audio/mpeg');
      await this.storage.put(`${prefix}/high.mp3`, { path: high }, 'audio/mpeg');

      const track = await this.tracks.findOne({ where: { id: trackId }, withDeleted: true });
      if (!track) {
        await this.storage.delete(prefix);
        return;
      }
      const previous = [track.audioKeyStd, track.audioKeyHigh].filter(
        (key): key is string => key !== null,
      );
      await this.tracks.update(
        { id: trackId },
        {
          audioKeyStd: `${prefix}/std.mp3`,
          audioKeyHigh: `${prefix}/high.mp3`,
          durationMs,
          status: TrackStatus.Ready,
        },
      );
      for (const old of new Set(previous.map(audioPrefixOf))) {
        await this.storage.delete(old);
      }
    } catch (error: unknown) {
      await this.storage.delete(prefix).catch(() => undefined);
      await this.tracks.update({ id: trackId }, { status: TrackStatus.Failed });
      throw new Error(
        `Transcoding track ${trackId} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await rm(workDir, { recursive: true, force: true });
      await rm(inputPath, { force: true });
    }
  }
}
