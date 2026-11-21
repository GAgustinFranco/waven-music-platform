import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request } from 'express';
import { type Role } from '../../users/user.entity.js';
import { type AuthUser } from '../auth.types.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/** Opts a route or controller out of the global `JwtAuthGuard`. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route or controller to the given roles (checked by `RolesGuard`). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** The authenticated user. Only valid on routes behind `JwtAuthGuard`. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const auth = ctx.switchToHttp().getRequest<Request>().auth;
  if (!auth) {
    throw new UnauthorizedException();
  }
  return auth satisfies AuthUser;
});
