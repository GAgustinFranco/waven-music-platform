import {
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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { type AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/auth.decorators.js';
import {
  AddTracksDto,
  CreatePlaylistDto,
  MoveEntryDto,
  PlaylistDetailDto,
  PlaylistPageDto,
  UpdatePlaylistDto,
} from './playlists.dto.js';
import { PlaylistsService } from './playlists.service.js';

const NOT_FOUND = 'Unknown playlist, or one owned by someone else (`PLAYLIST_NOT_FOUND`).';

@ApiTags('library')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('me/playlists')
export class MyPlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  @Get()
  @ApiOkResponse({ type: PlaylistPageDto, description: 'Own playlists, newest first.' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PlaylistPageDto> {
    return this.playlists.list(user.id, query.limit, query.offset);
  }
}

@ApiTags('library')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  @Post()
  @ApiCreatedResponse({ type: PlaylistDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid body.' })
  @ApiForbiddenResponse({ description: '`PLAN_LIMIT_REACHED`: the plan allows no more playlists.' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreatePlaylistDto,
  ): Promise<PlaylistDetailDto> {
    return this.playlists.create(user.id, body);
  }

  @Get(':id')
  @ApiOkResponse({ type: PlaylistDetailDto })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlaylistDetailDto> {
    return this.playlists.get(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: PlaylistDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid body.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePlaylistDto,
  ): Promise<PlaylistDetailDto> {
    return this.playlists.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted with all its entries.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.playlists.remove(user.id, id);
  }

  @Post(':id/tracks')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PlaylistDetailDto, description: 'The playlist after the change.' })
  @ApiBadRequestResponse({ description: 'Invalid body.' })
  @ApiNotFoundResponse({ description: `${NOT_FOUND} Or a track that is not playable.` })
  @ApiConflictResponse({ description: '`PLAYLIST_FULL`: it would exceed 500 tracks.' })
  addTracks(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddTracksDto,
  ): Promise<PlaylistDetailDto> {
    return this.playlists.addTracks(user.id, id, body);
  }

  @Delete(':id/tracks/:entryId')
  @ApiOkResponse({ type: PlaylistDetailDto, description: 'The playlist after the change.' })
  @ApiNotFoundResponse({ description: `${NOT_FOUND} Or an unknown entry (\`ENTRY_NOT_FOUND\`).` })
  removeEntry(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ): Promise<PlaylistDetailDto> {
    return this.playlists.removeEntry(user.id, id, entryId);
  }

  @Patch(':id/tracks/:entryId/position')
  @ApiOkResponse({ type: PlaylistDetailDto, description: 'The playlist after the change.' })
  @ApiBadRequestResponse({ description: 'Invalid body.' })
  @ApiNotFoundResponse({ description: `${NOT_FOUND} Or an unknown entry (\`ENTRY_NOT_FOUND\`).` })
  moveEntry(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: MoveEntryDto,
  ): Promise<PlaylistDetailDto> {
    return this.playlists.moveEntry(user.id, id, entryId, body.position);
  }
}
