import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Track } from '../catalog/entities/track.entity.js';
import { User } from '../users/user.entity.js';

/** A track the user liked. The composite key makes liking idempotent. */
@Entity('favorites')
@Index('IDX_favorites_user_created_at', ['userId', 'createdAt'])
export class Favorite {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'track_id', type: 'uuid' })
  trackId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Track, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'track_id' })
  track?: Track;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
