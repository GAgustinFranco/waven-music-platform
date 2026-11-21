import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { Roles } from '../auth/decorators/auth.decorators.js';
import { UserDto, UserPageDto } from './dto/user.dto.js';
import { Role } from './user.entity.js';
import { UsersService } from './users.service.js';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The user is not an admin.' })
@Roles(Role.Admin)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ type: UserPageDto })
  async list(@Query() query: PaginationQueryDto): Promise<UserPageDto> {
    const { items, total } = await this.users.list(query.limit, query.offset);
    return { items: items.map((user) => UserDto.from(user)), total, ...query };
  }
}
