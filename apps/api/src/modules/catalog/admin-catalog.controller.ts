import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { SearchPageQueryDto } from '../../common/dto/pagination.dto.js';
import { Roles } from '../auth/decorators/auth.decorators.js';
import { Role } from '../users/user.entity.js';
import {
  AdminCatalogService,
  type UploadedAudio,
  type UploadedImage,
} from './admin-catalog.service.js';
import { CatalogMapper } from './catalog.mapper.js';
import {
  AdminAlbumDto,
  AdminAlbumPageDto,
  AdminAlbumQueryDto,
  AdminArtistDto,
  AdminArtistPageDto,
  AdminTrackDto,
  AdminTrackPageDto,
  AdminTrackQueryDto,
  CreateAlbumDto,
  CreateArtistDto,
  CreateTrackDto,
  FileUploadDto,
  UpdateAlbumDto,
  UpdateArtistDto,
  UpdateTrackDto,
} from './dto/admin-catalog.dto.js';
import { AUDIO_UPLOAD, IMAGE_UPLOAD } from './upload.options.js';

/** Shared decorators of the image upload endpoints. */
const ImageUpload = () =>
  applyDecorators(
    UseInterceptors(FileInterceptor('file', IMAGE_UPLOAD)),
    ApiConsumes('multipart/form-data'),
    ApiBody({ type: FileUploadDto }),
    ApiBadRequestResponse({ description: 'No file was sent.' }),
    ApiPayloadTooLargeResponse({ description: 'Larger than 5 MB.' }),
    ApiUnsupportedMediaTypeResponse({ description: 'Not a jpg, png or webp image.' }),
  );

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The user is not an admin.' })
@Roles(Role.Admin)
@Controller('admin/artists')
export class AdminArtistsController {
  constructor(
    private readonly catalog: AdminCatalogService,
    private readonly mapper: CatalogMapper,
  ) {}

  @Get()
  @ApiOkResponse({ type: AdminArtistPageDto })
  async list(@Query() query: SearchPageQueryDto): Promise<AdminArtistPageDto> {
    const { items, total } = await this.catalog.listArtists(query.limit, query.offset, query.q);
    return {
      items: items.map((artist) => this.mapper.adminArtist(artist)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Post()
  @ApiCreatedResponse({ type: AdminArtistDto })
  async create(@Body() body: CreateArtistDto): Promise<AdminArtistDto> {
    return this.mapper.adminArtist(await this.catalog.createArtist(body));
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminArtistDto })
  @ApiNotFoundResponse()
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminArtistDto> {
    return this.mapper.adminArtist(await this.catalog.getArtist(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: AdminArtistDto })
  @ApiNotFoundResponse()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateArtistDto,
  ): Promise<AdminArtistDto> {
    return this.mapper.adminArtist(await this.catalog.updateArtist(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: '`ARTIST_HAS_ALBUMS`' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.deleteArtist(id);
  }

  @Post(':id/image')
  @HttpCode(HttpStatus.OK)
  @ImageUpload()
  @ApiOkResponse({ type: AdminArtistDto })
  @ApiNotFoundResponse()
  async uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<AdminArtistDto> {
    return this.mapper.adminArtist(await this.catalog.setArtistImage(id, file));
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The user is not an admin.' })
@Roles(Role.Admin)
@Controller('admin/albums')
export class AdminAlbumsController {
  constructor(
    private readonly catalog: AdminCatalogService,
    private readonly mapper: CatalogMapper,
  ) {}

  @Get()
  @ApiOkResponse({ type: AdminAlbumPageDto })
  async list(@Query() query: AdminAlbumQueryDto): Promise<AdminAlbumPageDto> {
    const { items, total } = await this.catalog.listAlbums(query.limit, query.offset, {
      artistId: query.artistId,
      q: query.q,
    });
    return {
      items: items.map((album) => this.mapper.adminAlbum(album)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Post()
  @ApiCreatedResponse({ type: AdminAlbumDto })
  @ApiNotFoundResponse({ description: 'Unknown artist.' })
  async create(@Body() body: CreateAlbumDto): Promise<AdminAlbumDto> {
    return this.mapper.adminAlbum(await this.catalog.createAlbum(body));
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminAlbumDto })
  @ApiNotFoundResponse()
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminAlbumDto> {
    return this.mapper.adminAlbum(await this.catalog.getAlbum(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: AdminAlbumDto })
  @ApiNotFoundResponse()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAlbumDto,
  ): Promise<AdminAlbumDto> {
    return this.mapper.adminAlbum(await this.catalog.updateAlbum(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: '`ALBUM_HAS_TRACKS`' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.deleteAlbum(id);
  }

  @Post(':id/cover')
  @HttpCode(HttpStatus.OK)
  @ImageUpload()
  @ApiOkResponse({ type: AdminAlbumDto, description: 'Also sets `dominantColor`.' })
  @ApiNotFoundResponse()
  async uploadCover(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<AdminAlbumDto> {
    return this.mapper.adminAlbum(await this.catalog.setAlbumCover(id, file));
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The user is not an admin.' })
@Roles(Role.Admin)
@Controller('admin/tracks')
export class AdminTracksController {
  constructor(
    private readonly catalog: AdminCatalogService,
    private readonly mapper: CatalogMapper,
  ) {}

  @Get()
  @ApiOkResponse({ type: AdminTrackPageDto, description: 'Every status; deleted tracks excluded.' })
  async list(@Query() query: AdminTrackQueryDto): Promise<AdminTrackPageDto> {
    const { items, total } = await this.catalog.listTracks(query.limit, query.offset, {
      albumId: query.albumId,
      q: query.q,
    });
    return {
      items: items.map((track) => this.mapper.adminTrack(track)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Post()
  @ApiCreatedResponse({
    type: AdminTrackDto,
    description: 'Created as `pending` until audio is uploaded.',
  })
  @ApiNotFoundResponse({ description: 'Unknown album.' })
  async create(@Body() body: CreateTrackDto): Promise<AdminTrackDto> {
    return this.mapper.adminTrack(await this.catalog.createTrack(body));
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminTrackDto })
  @ApiNotFoundResponse()
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminTrackDto> {
    return this.mapper.adminTrack(await this.catalog.getTrack(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: AdminTrackDto })
  @ApiNotFoundResponse()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTrackDto,
  ): Promise<AdminTrackDto> {
    return this.mapper.adminTrack(await this.catalog.updateTrack(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Soft delete.' })
  @ApiNotFoundResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.deleteTrack(id);
  }

  @Post(':id/audio')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file', AUDIO_UPLOAD))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FileUploadDto })
  @ApiAcceptedResponse({ type: AdminTrackDto, description: 'Transcoding started (`processing`).' })
  @ApiBadRequestResponse({ description: 'No file was sent.' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: '`TRACK_PROCESSING`' })
  @ApiPayloadTooLargeResponse({ description: 'Larger than 100 MB.' })
  @ApiUnsupportedMediaTypeResponse({ description: 'Not mp3, flac, wav or ogg.' })
  async uploadAudio(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedAudio | undefined,
  ): Promise<AdminTrackDto> {
    return this.mapper.adminTrack(await this.catalog.uploadTrackAudio(id, file));
  }
}
