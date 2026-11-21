import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ArtistRefDto } from '../catalog/dto/catalog.dto.js';

export const MAX_STATS_DAYS = 90;

export class AdminStatsQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: MAX_STATS_DAYS, default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_STATS_DAYS)
  days = 14;
}

export class UserStatsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  admins: number;

  @ApiProperty({ description: 'Users with an effective Premium plan (business rule 1).' })
  premium: number;

  @ApiProperty({ description: 'Signed up in the last 7 days.' })
  newLast7Days: number;
}

export class TrackStatsDto {
  @ApiProperty({ description: 'Tracks that are not deleted, in any status.' })
  total: number;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  processing: number;

  @ApiProperty()
  ready: number;

  @ApiProperty()
  failed: number;
}

export class DailyPlaysDto {
  @ApiProperty({ format: 'date', description: 'UTC day.' })
  date: string;

  @ApiProperty()
  plays: number;
}

export class TopTrackDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: ArtistRefDto })
  artist: ArtistRefDto;

  @ApiProperty()
  playCount: number;
}

export class AdminStatsDto {
  @ApiProperty({ type: UserStatsDto })
  users: UserStatsDto;

  @ApiProperty({ type: TrackStatsDto })
  tracks: TrackStatsDto;

  @ApiProperty({
    type: [DailyPlaysDto],
    description: 'One entry per day, oldest first, zeros included.',
  })
  playsPerDay: DailyPlaysDto[];

  @ApiProperty({ type: [TopTrackDto], description: 'Up to 5, by all-time play count.' })
  topTracks: TopTrackDto[];
}
