import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SearchPageQueryDto } from '../../../common/dto/pagination.dto.js';
import { Backdrop, effectiveAppearance, Theme } from '../appearance.js';
import { PLAN_LIMITS, Plan, StreamQuality } from '../plan.js';
import { Role, type User } from '../user.entity.js';

export class PlanLimitsDto {
  @ApiProperty({ type: 'integer', nullable: true, description: '`null` means unlimited.' })
  maxPlaylists: number | null;

  @ApiProperty({ enum: StreamQuality, enumName: 'StreamQuality' })
  streamQuality: StreamQuality;
}

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ type: 'string', nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role: Role;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static from(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export class AppearanceDto {
  @ApiProperty({ enum: Theme, enumName: 'Theme' })
  theme: Theme;

  @ApiProperty({ enum: Backdrop, enumName: 'Backdrop' })
  backdrop: Backdrop;
}

export class MeDto extends UserDto {
  @ApiProperty({ enum: Plan, enumName: 'Plan' })
  plan: Plan;

  @ApiProperty({ type: PlanLimitsDto })
  limits: PlanLimitsDto;

  @ApiProperty({
    type: AppearanceDto,
    description: 'What the app shows: the default on Free, whatever is saved.',
  })
  appearance: AppearanceDto;

  @ApiProperty({
    type: AppearanceDto,
    description: 'The saved choice, kept while the user is on Free.',
  })
  savedAppearance: AppearanceDto;

  static fromUser(user: User, plan: Plan): MeDto {
    const saved = { theme: user.theme, backdrop: user.backdrop };
    return {
      ...UserDto.from(user),
      plan,
      limits: { ...PLAN_LIMITS[plan] },
      appearance: effectiveAppearance(saved, plan === Plan.Premium),
      savedAppearance: saved,
    };
  }
}

export class UpdateMeDto {
  @ApiProperty({ required: false, minLength: 1, maxLength: 50 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({
    enum: Theme,
    enumName: 'Theme',
    description: 'Anything but `violet` needs Premium (403 `PREMIUM_REQUIRED`).',
  })
  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @ApiPropertyOptional({
    enum: Backdrop,
    enumName: 'Backdrop',
    description: '`glow` needs Premium (403 `PREMIUM_REQUIRED`).',
  })
  @IsOptional()
  @IsEnum(Backdrop)
  backdrop?: Backdrop;
}

export class UserPageDto {
  @ApiProperty({ type: [UserDto] })
  items: UserDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}

export class AdminUserQueryDto extends SearchPageQueryDto {
  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role, enumName: 'Role' })
  @IsEnum(Role)
  role: Role;
}
