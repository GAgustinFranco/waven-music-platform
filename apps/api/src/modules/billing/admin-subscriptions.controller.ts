import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/auth.decorators.js';
import { Role } from '../users/user.entity.js';
import {
  AdminSubscriptionDto,
  AdminSubscriptionPageDto,
  AdminSubscriptionQueryDto,
} from './billing.dto.js';
import { SubscriptionsService } from './subscriptions.service.js';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The user is not an admin.' })
@Roles(Role.Admin)
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @ApiOkResponse({ type: AdminSubscriptionPageDto })
  async list(@Query() query: AdminSubscriptionQueryDto): Promise<AdminSubscriptionPageDto> {
    const { items, total } = await this.subscriptions.list(query.limit, query.offset, {
      status: query.status,
      q: query.q,
    });
    return {
      items: items.map((subscription) => AdminSubscriptionDto.from(subscription)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }
}
