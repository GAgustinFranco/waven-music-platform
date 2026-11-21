import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { type AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/auth.decorators.js';
import { HistoryPageDto, HistoryQueryDto, RecordPlayDto } from './history.dto.js';
import { HistoryService } from './history.service.js';

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('me/history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  @ApiOkResponse({ type: HistoryPageDto, description: 'Newest play first, one entry per play.' })
  @ApiBadRequestResponse({ description: 'Invalid `limit` or `cursor`.' })
  list(@CurrentUser() user: AuthUser, @Query() query: HistoryQueryDto): Promise<HistoryPageDto> {
    return this.history.list(user.id, query.limit, query.cursor);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Recorded, or already recorded for this `playId`.' })
  @ApiBadRequestResponse({ description: 'Invalid body.' })
  @ApiNotFoundResponse({ description: 'Unknown, deleted or not yet playable track.' })
  @ApiUnprocessableEntityResponse({
    description: '`PLAY_TOO_SHORT`: under 30 s, or under the whole track if it is shorter.',
  })
  async record(@CurrentUser() user: AuthUser, @Body() body: RecordPlayDto): Promise<void> {
    await this.history.record(user.id, body);
  }
}
