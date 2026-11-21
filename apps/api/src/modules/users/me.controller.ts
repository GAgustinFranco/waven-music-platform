import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { type AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/auth.decorators.js';
import { MeDto, UpdateMeDto } from './dto/user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ type: MeDto })
  async get(@CurrentUser() auth: AuthUser): Promise<MeDto> {
    return MeDto.from(await this.users.findById(auth.id));
  }

  @Patch()
  @ApiOkResponse({ type: MeDto })
  async update(@CurrentUser() auth: AuthUser, @Body() body: UpdateMeDto): Promise<MeDto> {
    return MeDto.from(await this.users.updateProfile(auth.id, body));
  }
}
