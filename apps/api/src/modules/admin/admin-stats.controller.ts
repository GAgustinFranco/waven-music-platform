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
import { AdminStatsDto, AdminStatsQueryDto } from './admin-stats.dto.js';
import { AdminStatsService } from './admin-stats.service.js';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The user is not an admin.' })
@Roles(Role.Admin)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get()
  @ApiOkResponse({ type: AdminStatsDto })
  get(@Query() query: AdminStatsQueryDto): Promise<AdminStatsDto> {
    return this.stats.get(query.days);
  }
}
