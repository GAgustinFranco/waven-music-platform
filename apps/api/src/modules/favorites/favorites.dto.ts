import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { MAX_PAGE_SIZE } from '../../common/dto/pagination.dto.js';
import { TrackDto } from '../catalog/dto/catalog.dto.js';

export class FavoritesContainsQueryDto {
  @ApiProperty({
    type: 'string',
    description: `Comma-separated track ids, up to ${MAX_PAGE_SIZE}.`,
    example: '0b7c…,9f21…',
  })
  // Accepts both `ids=a,b` and `ids=a&ids=b`.
  @Transform(({ value }: { value: unknown }) =>
    (Array.isArray(value) ? value : [value])
      .flatMap((part: unknown) => (typeof part === 'string' ? part.split(',') : [part]))
      .map((part: unknown) => (typeof part === 'string' ? part.trim() : part))
      .filter((part: unknown) => part !== ''),
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PAGE_SIZE)
  @IsUUID('all', { each: true })
  ids: string[];
}

export class FavoritesContainsDto {
  @ApiProperty({ type: [String], format: 'uuid', description: 'The requested ids that are liked.' })
  trackIds: string[];
}

export class FavoriteDto {
  @ApiProperty({ format: 'date-time' })
  addedAt: string;

  @ApiProperty({ description: '`false` when the track was deleted or is not playable.' })
  available: boolean;

  @ApiProperty({ type: TrackDto })
  track: TrackDto;
}

export class FavoritePageDto {
  @ApiProperty({ type: [FavoriteDto] })
  items: FavoriteDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}
