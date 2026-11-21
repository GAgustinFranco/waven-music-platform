import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Album } from './album.entity.js';
import { Artist } from './artist.entity.js';
import { CatalogSource } from './catalog-source.js';

export enum TrackStatus {
  /** Created without audio yet. */
  Pending = 'pending',
  Processing = 'processing',
  Ready = 'ready',
  Failed = 'failed',
}

@Entity('tracks')
@Index('UQ_tracks_source', ['source', 'sourceId'], { unique: true })
@Index('IDX_tracks_album', ['albumId', 'trackNumber'])
@Index('IDX_tracks_artist', ['artistId'])
@Index('IDX_tracks_play_count', ['playCount'])
export class Track {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'album_id', type: 'uuid' })
  albumId: string;

  @ManyToOne(() => Album, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'album_id' })
  album?: Album;

  /** Copied from the album so artist pages do not need a join. */
  @Column({ name: 'artist_id', type: 'uuid' })
  artistId: string;

  @ManyToOne(() => Artist, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'artist_id' })
  artist?: Artist;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'track_number', type: 'int' })
  trackNumber: number;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  /** 128 kbps MP3. */
  @Column({ name: 'audio_key_std', type: 'varchar', length: 255, nullable: true })
  audioKeyStd: string | null;

  /** 320 kbps MP3. */
  @Column({ name: 'audio_key_high', type: 'varchar', length: 255, nullable: true })
  audioKeyHigh: string | null;

  @Column({
    type: 'enum',
    enum: TrackStatus,
    enumName: 'track_status',
    default: TrackStatus.Pending,
  })
  status: TrackStatus;

  @Column({ name: 'play_count', type: 'int', default: 0 })
  playCount: number;

  @Column({
    type: 'enum',
    enum: CatalogSource,
    enumName: 'catalog_source',
    default: CatalogSource.Upload,
  })
  source: CatalogSource;

  @Column({ name: 'source_id', type: 'varchar', length: 255, nullable: true })
  sourceId: string | null;

  /** Human-readable license, e.g. `CC BY-NC-SA 3.0`. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  license: string | null;

  @Column({ name: 'attribution_url', type: 'text', nullable: true })
  attributionUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;
}

/** Whether a track can be played; deleted or unprocessed ones stay in playlists as unavailable (SPEC §6.7). */
export function isTrackAvailable(track: Track): boolean {
  return track.status === TrackStatus.Ready && track.deletedAt === null;
}
