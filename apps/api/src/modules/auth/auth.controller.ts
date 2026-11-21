import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type Request, type Response } from 'express';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { type ExternalProfile } from '../users/users.service.js';
import {
  clearSessionCookies,
  readCookie,
  REFRESH_COOKIE,
  setSessionCookies,
} from './auth.cookies.js';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/auth.decorators.js';
import { AccessTokenDto } from './dto/auth.dto.js';
import { GoogleAuthGuard, OAuthFailureFilter } from './google/google-auth.guard.js';

/** Strict limit on every auth route (the global one is 100/min). */
export const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

const userAgentOf = (req: Request): string | null => req.headers['user-agent'] ?? null;

function isExternalProfile(value: unknown): value is ExternalProfile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const profile = value as Record<string, unknown>;
  return typeof profile['googleId'] === 'string' && typeof profile['email'] === 'string';
}

@ApiTags('auth')
@Public()
@Throttle(AUTH_THROTTLE)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiFoundResponse({ description: 'Redirects to Google.' })
  google(): void {
    // GoogleAuthGuard redirects before this runs.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @UseFilters(OAuthFailureFilter)
  @ApiFoundResponse({ description: 'Sets the session cookies and redirects to the web app.' })
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!isExternalProfile(req.user)) {
      throw new UnauthorizedException();
    }
    const { refresh } = await this.auth.login(req.user, userAgentOf(req));
    setSessionCookies(res, refresh, this.auth.secureCookies);
    res.redirect(302, `${this.config.get('WEB_URL', { infer: true })}/`);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiHeader({ name: 'X-Requested-With', required: true })
  @ApiOkResponse({ type: AccessTokenDto, description: 'Rotates the refresh cookie.' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, expired or reused refresh token.' })
  @ApiForbiddenResponse({ description: 'Untrusted origin.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenDto> {
    this.auth.assertTrustedOrigin(req);
    const token = readCookie(req, REFRESH_COOKIE);
    if (!token) {
      clearSessionCookies(res, this.auth.secureCookies);
      throw new UnauthorizedException({ code: 'NO_SESSION', message: 'You are not signed in' });
    }

    try {
      const { refresh, ...access } = await this.auth.refresh(token, userAgentOf(req));
      setSessionCookies(res, refresh, this.auth.secureCookies);
      return access;
    } catch (error) {
      clearSessionCookies(res, this.auth.secureCookies);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  @ApiHeader({ name: 'X-Requested-With', required: true })
  @ApiNoContentResponse({ description: 'Revokes the session and clears the cookies.' })
  @ApiForbiddenResponse({ description: 'Untrusted origin.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.auth.assertTrustedOrigin(req);
    const token = readCookie(req, REFRESH_COOKIE);
    if (token) {
      await this.auth.logout(token);
    }
    clearSessionCookies(res, this.auth.secureCookies);
  }
}
