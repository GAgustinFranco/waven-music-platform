import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Backdrop, Theme } from './appearance.js';

export enum Role {
  User = 'user',
  Admin = 'admin',
}

/** Every user has a way to sign in: Google, a password or both. */
@Entity('users')
@Check('CHK_users_has_credential', `"google_id" IS NOT NULL OR "password_hash" IS NOT NULL`)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null for accounts created with an email and a password. */
  @Column({ name: 'google_id', type: 'varchar', length: 64, unique: true, nullable: true })
  googleId: string | null;

  /** `PasswordHasher` output; null for Google-only accounts. Never leaves the API. */
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash: string | null;

  /** Always stored lowercased. */
  @Column({ type: 'varchar', length: 320, unique: true })
  email: string;

  /** Set by the one-click link (password accounts) or at the first Google sign-in. */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  /** SHA-256 of the pending verification token; the token itself is never stored. */
  @Column({
    name: 'email_verification_token_hash',
    type: 'char',
    length: 64,
    unique: true,
    nullable: true,
    select: false,
  })
  emailVerificationTokenHash: string | null;

  @Column({
    name: 'email_verification_expires_at',
    type: 'timestamptz',
    nullable: true,
    select: false,
  })
  emailVerificationExpiresAt: Date | null;

  @Column({ name: 'display_name', type: 'varchar', length: 50 })
  displayName: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'enum', enum: Role, enumName: 'user_role', default: Role.User })
  role: Role;

  /** The chosen theme; Free users see the default whatever is stored (see appearance.ts). */
  @Column({ type: 'enum', enum: Theme, enumName: 'app_theme', default: Theme.Violet })
  theme: Theme;

  @Column({ type: 'enum', enum: Backdrop, enumName: 'app_backdrop', default: Backdrop.Solid })
  backdrop: Backdrop;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
