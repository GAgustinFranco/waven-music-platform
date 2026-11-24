import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity.js';

/** Stored notifications. The web owns the copy; the API only sends the type and data. */
export enum NotificationType {
  Welcome = 'welcome',
  PremiumActivated = 'premium-activated',
}

/**
 * One in-app notification. `dedupKey` names the event it reports (for
 * example `premium-activated:<subscriptionId>`), and the unique
 * (user, dedupKey) pair makes every insert idempotent.
 */
@Entity('notifications')
@Unique('UQ_notifications_user_dedup_key', ['userId', 'dedupKey'])
@Index('IDX_notifications_user_created', ['userId', 'createdAt', 'id'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'enum', enum: NotificationType, enumName: 'notification_type' })
  type: NotificationType;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, string> | null;

  @Column({ name: 'dedup_key', type: 'varchar', length: 128 })
  dedupKey: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
