import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { setSessionCookies } from '../auth.cookies.js';
import { AuthService } from '../auth.service.js';
import { Public } from '../decorators/auth.decorators.js';
import { type AccessTokenDto, TestLoginDto } from '../dto/auth.dto.js';

/**
 * Test-only login that skips Google. `TestAuthModule` is only imported when
 * NODE_ENV=test and E2E_AUTH_BYPASS=true, so this route does not exist otherwise.
 */
@ApiExcludeController()
@Public()
@Controller('auth/test-login')
export class TestAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: TestLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenDto> {
    const email = body.email.toLowerCase();
    const { user, refresh } = await this.auth.login(
      {
        googleId: `test:${email}`,
        email,
        displayName: body.displayName ?? email.slice(0, email.indexOf('@')),
        avatarUrl: null,
      },
      req.headers['user-agent'] ?? null,
      { grantAdmin: body.admin === true },
    );
    setSessionCookies(res, refresh, this.auth.secureCookies);
    return this.auth.signAccessToken(user);
  }
}
