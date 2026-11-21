import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
