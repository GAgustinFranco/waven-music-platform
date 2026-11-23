import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { type AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/auth.decorators.js';
import { MeDto, UpdateMeDto } from './dto/user.dto.js';
import { PlanService } from '../billing/plan.service.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly plans: PlanService,
  ) {}

  @Get()
  @ApiOkResponse({ type: MeDto })
  async get(@CurrentUser() auth: AuthUser): Promise<MeDto> {
    const [user, plan] = await Promise.all([
      this.users.findById(auth.id),
      this.plans.getPlan(auth.id),
    ]);
    return MeDto.fromUser(user, plan);
  }

  @Patch()
  @ApiOkResponse({ type: MeDto })
  async update(@CurrentUser() auth: AuthUser, @Body() body: UpdateMeDto): Promise<MeDto> {
    const user = await this.users.updateProfile(auth.id, body);
    return MeDto.fromUser(user, await this.plans.getPlan(auth.id));
  }
}
