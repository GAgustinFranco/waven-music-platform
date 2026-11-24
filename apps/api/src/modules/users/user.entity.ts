import {
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

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'google_id', type: 'varchar', length: 64, unique: true })
  googleId: string;

  /** Always stored lowercased. */
  @Column({ type: 'varchar', length: 320, unique: true })
  email: string;

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
