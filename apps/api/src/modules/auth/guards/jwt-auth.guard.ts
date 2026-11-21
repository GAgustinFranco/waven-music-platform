import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';
import { Role } from '../../users/user.entity.js';
import { type AccessTokenPayload } from '../auth.types.js';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators.js';

const ROLES = new Set<string>(Object.values(Role));

function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { sub, role } = value as Record<string, unknown>;
  return typeof sub === 'string' && typeof role === 'string' && ROLES.has(role);
}

/** Global guard: every route needs a valid access JWT unless marked `@Public()`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing access token' });
    }

    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid or expired access token',
      });
    }
    if (!isAccessTokenPayload(payload)) {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid or expired access token',
      });
    }

    request.auth = { id: payload.sub, role: payload.role };
    return true;
  }
}
