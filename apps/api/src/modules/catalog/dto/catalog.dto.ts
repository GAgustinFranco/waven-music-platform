import { ApiProperty } from '@nestjs/swagger';

/** Square WebP variants of a cover or artist image. */
export class ImageSetDto {
  @ApiProperty({ description: '64 px' })
  sm: string;

  @ApiProperty({ description: '300 px' })
  md: string;

  @ApiProperty({ description: '640 px' })
  lg: string;
}

export class ArtistRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;
}

export class AlbumRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ type: ImageSetDto, nullable: true })
  cover: ImageSetDto | null;
}

export class TrackDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  trackNumber: number;

  @ApiProperty()
  durationMs: number;

  @ApiProperty({ type: ArtistRefDto })
  artist: ArtistRefDto;

  @ApiProperty({ type: AlbumRefDto })
  album: AlbumRefDto;

  @ApiProperty({ type: 'string', nullable: true, example: 'CC BY-NC-SA 3.0' })
  license: string | null;

  @ApiProperty({ type: 'string', nullable: true, description: 'Where the work is credited.' })
  attributionUrl: string | null;
}

export class ArtistSummaryDto extends ArtistRefDto {
  @ApiProperty({ type: ImageSetDto, nullable: true })
  image: ImageSetDto | null;
}

export class AlbumSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ type: 'string', format: 'date', nullable: true })
  releaseDate: string | null;

  @ApiProperty({ type: ImageSetDto, nullable: true })
  cover: ImageSetDto | null;

  @ApiProperty({ type: 'string', nullable: true, example: '#3a2f6b' })
  dominantColor: string | null;

  @ApiProperty({ type: ArtistRefDto })
  artist: ArtistRefDto;
}

export class ArtistDetailDto extends ArtistSummaryDto {
  @ApiProperty({ type: 'string', nullable: true })
  bio: string | null;

  @ApiProperty({ type: [AlbumSummaryDto] })
  albums: AlbumSummaryDto[];

  @ApiProperty({ type: [TrackDto], description: 'Most played tracks, up to 10.' })
  popularTracks: TrackDto[];
}

export class AlbumDetailDto extends AlbumSummaryDto {
  @ApiProperty({ type: [TrackDto] })
  tracks: TrackDto[];

  @ApiProperty({ description: 'Sum of the track durations.' })
  durationMs: number;
}

export class ArtistPageDto {
  @ApiProperty({ type: [ArtistSummaryDto] })
  items: ArtistSummaryDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}

export class AlbumPageDto {
  @ApiProperty({ type: [AlbumSummaryDto] })
  items: AlbumSummaryDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}

export class HomeDto {
  @ApiProperty({ type: [AlbumSummaryDto] })
  newReleases: AlbumSummaryDto[];

  @ApiProperty({ type: [TrackDto] })
  popularTracks: TrackDto[];

  @ApiProperty({
    type: [TrackDto],
    description: 'Your last distinct public tracks, latest play first (up to 10).',
  })
  recentlyPlayed: TrackDto[];
}
