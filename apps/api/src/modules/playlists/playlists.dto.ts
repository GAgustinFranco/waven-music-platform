import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ImageSetDto, TrackDto } from '../catalog/dto/catalog.dto.js';

/** SPEC §2: the same for every plan. */
export const MAX_PLAYLIST_TRACKS = 500;
/** Tracks accepted by one `POST /playlists/:id/tracks`. */
export const MAX_TRACKS_PER_ADD = 100;
export const MAX_NAME_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 300;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** An empty description clears it. */
const trimToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreatePlaylistDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: MAX_NAME_LENGTH,
    description: 'Defaults to "My Playlist #n".',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional({ type: 'string', nullable: true, maxLength: MAX_DESCRIPTION_LENGTH })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string | null;
}

export class UpdatePlaylistDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: MAX_NAME_LENGTH })
  // `null` is not a valid name, unlike a missing one.
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    maxLength: MAX_DESCRIPTION_LENGTH,
    description: '`null` or an empty string clears it.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string | null;
}

export class AddTracksDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    maxItems: MAX_TRACKS_PER_ADD,
    description: 'Added in this order; repeats are allowed.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TRACKS_PER_ADD)
  @IsUUID('all', { each: true })
  trackIds: string[];

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Where the first track goes. Defaults to the end; larger values mean the end.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class MoveEntryDto {
  @ApiProperty({
    minimum: 0,
    description: 'Target position, 0-based. Values past the end move the entry to the end.',
  })
  @IsInt()
  @Min(0)
  position: number;
}

export class PlaylistSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: 'string', nullable: true })
  description: string | null;

  @ApiProperty()
  trackCount: number;

  @ApiProperty({
    type: [ImageSetDto],
    description: 'Up to 4 distinct album covers, in playlist order, for a mosaic.',
  })
  covers: ImageSetDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class PlaylistPageDto {
  @ApiProperty({ type: [PlaylistSummaryDto] })
  items: PlaylistSummaryDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}

export class PlaylistEntryDto {
  @ApiProperty({ format: 'uuid', description: 'Entry id; a track may appear more than once.' })
  id: string;

  @ApiProperty({ description: '0-based and contiguous.' })
  position: number;

  @ApiProperty({ format: 'date-time' })
  addedAt: string;

  @ApiProperty({ description: '`false` when the track was deleted or is not playable.' })
  available: boolean;

  @ApiProperty({ type: TrackDto })
  track: TrackDto;
}

export class PlaylistDetailDto extends PlaylistSummaryDto {
  @ApiProperty({ description: 'Sum of the available track durations.' })
  durationMs: number;

  @ApiProperty({ type: [PlaylistEntryDto], description: 'Every entry, ordered by position.' })
  entries: PlaylistEntryDto[];
}
