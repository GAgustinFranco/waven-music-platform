import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators.js';
import { type AuthUser } from '../auth/auth.types.js';
import { AdminUserQueryDto, UpdateUserRoleDto, UserDto, UserPageDto } from './dto/user.dto.js';
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
  async list(@Query() query: AdminUserQueryDto): Promise<UserPageDto> {
    const { items, total } = await this.users.list(query.limit, query.offset, {
      q: query.q,
      role: query.role,
    });
    return {
      items: items.map((user) => UserDto.from(user)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Get(':id')
  @ApiOkResponse({ type: UserDto })
  @ApiNotFoundResponse()
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return UserDto.from(await this.users.findById(id));
  }

  @Patch(':id')
  @ApiOkResponse({
    type: UserDto,
    description: 'The new role reaches the access token of that user at its next refresh.',
  })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: '`CANNOT_DEMOTE_SELF`' })
  async changeRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserRoleDto,
  ): Promise<UserDto> {
    return UserDto.from(await this.users.changeRole(actor.id, id, body.role));
  }
}
