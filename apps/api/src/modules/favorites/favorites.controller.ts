import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
  FavoritePageDto,
  FavoritesContainsDto,
  FavoritesContainsQueryDto,
} from './favorites.dto.js';
import { FavoritesService } from './favorites.service.js';

@ApiTags('library')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('me/favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOkResponse({ type: FavoritePageDto, description: 'Liked tracks, most recent first.' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<FavoritePageDto> {
    return this.favorites.list(user.id, query.limit, query.offset);
  }

  @Get('contains')
  @ApiOkResponse({ type: FavoritesContainsDto })
  @ApiBadRequestResponse({ description: 'Missing, malformed or too many ids.' })
  async contains(
    @CurrentUser() user: AuthUser,
    @Query() query: FavoritesContainsQueryDto,
  ): Promise<FavoritesContainsDto> {
    return { trackIds: await this.favorites.contains(user.id, query.ids) };
  }

  @Put(':trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Liked, or already liked.' })
  @ApiNotFoundResponse({ description: 'Unknown, deleted or not yet playable track.' })
  async add(
    @CurrentUser() user: AuthUser,
    @Param('trackId', ParseUUIDPipe) trackId: string,
  ): Promise<void> {
    await this.favorites.add(user.id, trackId);
  }

  @Delete(':trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Unliked, or was not liked.' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('trackId', ParseUUIDPipe) trackId: string,
  ): Promise<void> {
    await this.favorites.remove(user.id, trackId);
  }
}
