import {
  Controller,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/auth.decorators.js';
import {
  NotificationDto,
  NotificationsPageDto,
  NotificationsQueryDto,
} from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse({
    type: NotificationsPageDto,
    description: 'Newest first, with the unread count and the active reminders.',
  })
  @ApiBadRequestResponse({ description: 'Invalid `limit` or `cursor`.' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationsPageDto> {
    return this.notifications.list(user.id, query.limit, query.cursor);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Every notification is now read.' })
  async markAllRead(@CurrentUser() user: AuthUser): Promise<void> {
    await this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOkResponse({ type: NotificationDto, description: 'Read now, or already read.' })
  @ApiBadRequestResponse({ description: 'The id is not a UUID.' })
  @ApiNotFoundResponse({ description: '`NOTIFICATION_NOT_FOUND`: unknown or not yours.' })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(user.id, id);
  }
}
