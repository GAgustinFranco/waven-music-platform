import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { type AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators/auth.decorators.js';
import { CatalogService } from './catalog.service.js';
import {
  AlbumDetailDto,
  AlbumPageDto,
  ArtistDetailDto,
  ArtistPageDto,
  HomeDto,
  ShowcaseDto,
  TrackDto,
} from './dto/catalog.dto.js';

@ApiTags('catalog')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('artists')
export class ArtistsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({ type: ArtistPageDto })
  list(@Query() query: PaginationQueryDto): Promise<ArtistPageDto> {
    return this.catalog.listArtists(query.limit, query.offset);
  }

  @Get(':id')
  @ApiOkResponse({ type: ArtistDetailDto })
  @ApiNotFoundResponse({ description: 'Unknown artist, or one without playable tracks.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ArtistDetailDto> {
    return this.catalog.getArtist(id);
  }
}

@ApiTags('catalog')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('albums')
export class AlbumsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({ type: AlbumPageDto, description: 'Newest releases first.' })
  list(@Query() query: PaginationQueryDto): Promise<AlbumPageDto> {
    return this.catalog.listAlbums(query.limit, query.offset);
  }

  @Get(':id')
  @ApiOkResponse({ type: AlbumDetailDto })
  @ApiNotFoundResponse({ description: 'Unknown album, or one without playable tracks.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AlbumDetailDto> {
    return this.catalog.getAlbum(id);
  }
}

@ApiTags('catalog')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('tracks')
export class TracksController {
  constructor(private readonly catalog: CatalogService) {}

  @Get(':id')
  @ApiOkResponse({ type: TrackDto })
  @ApiNotFoundResponse({ description: 'Unknown, deleted or not yet playable track.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<TrackDto> {
    return this.catalog.getTrack(id);
  }
}

@ApiTags('catalog')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('browse')
export class BrowseController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('home')
  @ApiOkResponse({ type: HomeDto, description: 'Recently played is per user.' })
  home(@CurrentUser() user: AuthUser): Promise<HomeDto> {
    return this.catalog.home(user.id);
  }
}

/** Public, so the sign-in page can show the catalog before anyone signs in. */
@ApiTags('catalog')
@Public()
@Controller('browse')
export class ShowcaseController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('showcase')
  @ApiOkResponse({ type: ShowcaseDto, description: 'Up to 48 random public album covers.' })
  showcase(): Promise<ShowcaseDto> {
    return this.catalog.showcase();
  }
}
