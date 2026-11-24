import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(320)
  email: string;

  /** No length rule here, so a login never hints at the sign-up rules. */
  @ApiProperty({ maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}

export class RegisterDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  @ApiProperty({ minLength: 1, maxLength: 50 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayName: string;
}

export class AccessTokenDto {
  @ApiProperty({ description: 'Short-lived JWT. Keep it in memory only.' })
  accessToken: string;

  @ApiProperty({ description: 'Lifetime of the access token in seconds.' })
  expiresIn: number;
}

/** Body of the test-only login route. */
export class TestLoginDto {
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  admin?: boolean;
}
