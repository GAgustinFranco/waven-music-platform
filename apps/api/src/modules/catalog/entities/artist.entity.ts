import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { type Album } from './album.entity.js';
import { CatalogSource } from './catalog-source.js';

@Entity('artists')
@Index('UQ_artists_source', ['source', 'sourceId'], { unique: true })
export class Artist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 220, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  /** Prefix of the image variants (`<imageKey>/<size>.webp`). */
  @Column({ name: 'image_key', type: 'varchar', length: 255, nullable: true })
  imageKey: string | null;

  @Column({
    type: 'enum',
    enum: CatalogSource,
    enumName: 'catalog_source',
    default: CatalogSource.Upload,
  })
  source: CatalogSource;

  @Column({ name: 'source_id', type: 'varchar', length: 255, nullable: true })
  sourceId: string | null;

  @OneToMany('Album', (album: Album) => album.artist)
  albums?: Album[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
