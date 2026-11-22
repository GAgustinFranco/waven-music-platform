import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** One received webhook notification; the unique key makes processing idempotent. */
@Entity('webhook_events')
@Unique('UQ_webhook_events_provider_event', ['provider', 'externalEventId'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  @Column({ name: 'external_event_id', type: 'varchar', length: 255 })
  externalEventId: string;

  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /** Set once processed; a failed attempt leaves it null so the provider's retry runs again. */
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
