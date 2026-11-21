import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Track } from '../catalog/entities/track.entity.js';
import { Playlist } from './playlist.entity.js';

/**
 * One entry of a playlist. A track may appear more than once, so entries have
 * their own id. Positions are contiguous from 0; the unique constraint is
 * deferred so a transaction can shift a range of them.
 */
@Entity('playlist_tracks')
@Unique('UQ_playlist_tracks_position', ['playlistId', 'position'], {
  deferrable: 'INITIALLY DEFERRED',
})
@Index('IDX_playlist_tracks_track', ['trackId'])
export class PlaylistTrack {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'playlist_id', type: 'uuid' })
  playlistId: string;

  @ManyToOne(() => Playlist, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlist_id' })
  playlist?: Playlist;

  @Column({ name: 'track_id', type: 'uuid' })
  trackId: string;

  // Tracks are only soft-deleted; a deleted one stays here as "unavailable" (SPEC §6.7).
  @ManyToOne(() => Track, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'track_id' })
  track?: Track;

  @Column({ type: 'int' })
  position: number;

  @Column({ name: 'added_at', type: 'timestamptz', default: () => 'now()' })
  addedAt: Date;
}
