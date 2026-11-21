import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Request } from 'express';
import { type Role } from '../../users/user.entity.js';
import { ROLES_KEY } from '../decorators/auth.decorators.js';

/** Global guard: runs after `JwtAuthGuard` and enforces `@Roles(...)`. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }

    const auth = context.switchToHttp().getRequest<Request>().auth;
    if (!auth || !roles.includes(auth.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have access to this resource',
      });
    }
    return true;
  }
}
