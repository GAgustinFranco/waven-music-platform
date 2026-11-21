import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PLAN_LIMITS, Plan, StreamQuality, getEffectivePlan } from '../plan.js';
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

export class MeDto extends UserDto {
  @ApiProperty({ enum: Plan, enumName: 'Plan' })
  plan: Plan;

  @ApiProperty({ type: PlanLimitsDto })
  limits: PlanLimitsDto;

  static override from(user: User): MeDto {
    const plan = getEffectivePlan();
    return { ...UserDto.from(user), plan, limits: { ...PLAN_LIMITS[plan] } };
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
