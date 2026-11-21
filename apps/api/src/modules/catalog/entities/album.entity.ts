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
import { Artist } from './artist.entity.js';
import { CatalogSource } from './catalog-source.js';

@Entity('albums')
@Index('UQ_albums_artist_slug', ['artistId', 'slug'], { unique: true })
@Index('UQ_albums_source', ['source', 'sourceId'], { unique: true })
@Index('IDX_albums_release_date', ['releaseDate'])
export class Album {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'artist_id', type: 'uuid' })
  artistId: string;

  @ManyToOne(() => Artist, (artist) => artist.albums, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'artist_id' })
  artist?: Artist;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 220 })
  slug: string;

  /** ISO date (`YYYY-MM-DD`). */
  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: string | null;

  /** Prefix of the cover variants (`<coverKey>/<size>.webp`). */
  @Column({ name: 'cover_key', type: 'varchar', length: 255, nullable: true })
  coverKey: string | null;

  /** `#rrggbb`, darkened until it has AA contrast with the text color. */
  @Column({ name: 'dominant_color', type: 'char', length: 7, nullable: true })
  dominantColor: string | null;

  @Column({
    type: 'enum',
    enum: CatalogSource,
    enumName: 'catalog_source',
    default: CatalogSource.Upload,
  })
  source: CatalogSource;

  @Column({ name: 'source_id', type: 'varchar', length: 255, nullable: true })
  sourceId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
