import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';

export enum SubscriptionStatus {
  Pending = 'pending',
  Authorized = 'authorized',
  Paused = 'paused',
  Cancelled = 'cancelled',
}

export enum PaymentMode {
  Preapproval = 'preapproval',
  Onetime = 'onetime',
}

/** Statuses that block a new checkout (business rule 8). */
export const ACTIVE_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.Pending,
  SubscriptionStatus.Authorized,
] as const;

/** Money stays exact: Postgres `numeric` comes back as a string and is parsed here. */
const decimal = {
  to: (value: number): number => value,
  from: (value: string): number => Number(value),
};

@Entity('subscriptions')
@Index('UQ_subscriptions_active_user', ['userId'], {
  unique: true,
  where: `"status" IN ('pending', 'authorized')`,
})
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_subscriptions_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  @Column({ type: 'enum', enum: PaymentMode, enumName: 'payment_mode' })
  mode: PaymentMode;

  /** The provider's id (preapproval or payment); unknown until checkout returns it. */
  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    enumName: 'subscription_status',
    default: SubscriptionStatus.Pending,
  })
  status: SubscriptionStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimal })
  amount: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  /** `onetime` mode: the last payment that extended the period, so it never counts twice. */
  @Column({ name: 'last_payment_id', type: 'varchar', length: 255, nullable: true })
  lastPaymentId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
