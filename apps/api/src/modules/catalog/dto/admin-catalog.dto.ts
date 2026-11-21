import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { CatalogSource } from '../entities/catalog-source.js';
import { TrackStatus } from '../entities/track.entity.js';
import { AlbumRefDto, AlbumSummaryDto, ArtistRefDto, ArtistSummaryDto } from './catalog.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// ---------- Inputs ----------

export class CreateArtistDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ type: 'string', nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string | null;
}

export class UpdateArtistDto extends PartialType(CreateArtistDto) {}

export class CreateAlbumDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  artistId: string;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true, example: '2026-05-01' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @MaxLength(10)
  releaseDate?: string | null;
}

export class UpdateAlbumDto extends PartialType(OmitType(CreateAlbumDto, ['artistId'] as const)) {}

export class CreateTrackDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  albumId: string;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ minimum: 1, maximum: 999 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  trackNumber: number;

  @ApiPropertyOptional({ type: 'string', nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  license?: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true, format: 'uri' })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  attributionUrl?: string | null;
}

export class UpdateTrackDto extends PartialType(OmitType(CreateTrackDto, ['albumId'] as const)) {}

export class AdminAlbumQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  artistId?: string;
}

export class AdminTrackQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  albumId?: string;
}

/** Swagger body of the multipart upload endpoints. */
export class FileUploadDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: unknown;
}

// ---------- Outputs ----------

export class AdminArtistDto extends ArtistSummaryDto {
  @ApiProperty({ type: 'string', nullable: true })
  bio: string | null;

  @ApiProperty({ enum: CatalogSource, enumName: 'CatalogSource' })
  source: CatalogSource;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class AdminAlbumDto extends AlbumSummaryDto {
  @ApiProperty({ enum: CatalogSource, enumName: 'CatalogSource' })
  source: CatalogSource;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class AdminTrackDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  trackNumber: number;

  @ApiProperty({ type: 'integer', nullable: true })
  durationMs: number | null;

  @ApiProperty({ enum: TrackStatus, enumName: 'TrackStatus' })
  status: TrackStatus;

  @ApiProperty({ type: ArtistRefDto })
  artist: ArtistRefDto;

  @ApiProperty({ type: AlbumRefDto })
  album: AlbumRefDto;

  @ApiProperty({ type: 'string', nullable: true })
  license: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  attributionUrl: string | null;

  @ApiProperty()
  playCount: number;

  @ApiProperty({ enum: CatalogSource, enumName: 'CatalogSource' })
  source: CatalogSource;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class AdminArtistPageDto {
  @ApiProperty({ type: [AdminArtistDto] })
  items: AdminArtistDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}

export class AdminAlbumPageDto {
  @ApiProperty({ type: [AdminAlbumDto] })
  items: AdminAlbumDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}

export class AdminTrackPageDto {
  @ApiProperty({ type: [AdminTrackDto] })
  items: AdminTrackDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}
