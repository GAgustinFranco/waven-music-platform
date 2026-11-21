import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AlbumSummaryDto, ArtistSummaryDto, TrackDto } from '../catalog/dto/catalog.dto.js';

export const MAX_QUERY_LENGTH = 100;
export const MAX_SEARCH_LIMIT = 20;

export enum SearchType {
  All = 'all',
  Track = 'track',
  Album = 'album',
  Artist = 'artist',
}

/** What a single hit is; `SearchType` without `all`. */
export enum SearchHitType {
  Track = 'track',
  Album = 'album',
  Artist = 'artist',
}

export class SearchQueryDto {
  @ApiProperty({
    maxLength: MAX_QUERY_LENGTH,
    description: 'Case- and accent-insensitive, tolerant to small typos. Blank returns nothing.',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(MAX_QUERY_LENGTH)
  q: string;

  @ApiPropertyOptional({ enum: SearchType, enumName: 'SearchType', default: SearchType.All })
  @IsOptional()
  @IsEnum(SearchType)
  type: SearchType = SearchType.All;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: MAX_SEARCH_LIMIT,
    default: 10,
    description: 'Maximum results per type.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_LIMIT)
  limit = 10;
}

export class TopResultDto {
  @ApiProperty({ enum: SearchHitType, enumName: 'SearchHitType' })
  type: SearchHitType;

  @ApiProperty({ format: 'uuid', description: 'Id of an item in the matching list.' })
  id: string;
}

export class SearchResultsDto {
  @ApiProperty({ type: [TrackDto], description: 'Best match first.' })
  tracks: TrackDto[];

  @ApiProperty({ type: [AlbumSummaryDto], description: 'Best match first.' })
  albums: AlbumSummaryDto[];

  @ApiProperty({ type: [ArtistSummaryDto], description: 'Best match first.' })
  artists: ArtistSummaryDto[];

  @ApiProperty({
    type: TopResultDto,
    nullable: true,
    description: 'The best hit across types; only with `type=all`.',
  })
  topResult: TopResultDto | null;
}
