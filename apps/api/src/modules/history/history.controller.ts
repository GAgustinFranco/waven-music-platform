import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { type AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/auth.decorators.js';
import { RecordPlayDto } from './history.dto.js';
import { HistoryService } from './history.service.js';

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('me/history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

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
