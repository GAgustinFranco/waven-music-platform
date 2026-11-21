import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';
import { Role } from '../../users/user.entity.js';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators/auth.decorators.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

const jwt = new JwtService({ secret: 'x'.repeat(32), signOptions: { expiresIn: 60 } });

function contextFor(request: Partial<Request>, metadata: Record<string, unknown> = {}) {
  const handler = () => undefined;
  for (const [key, value] of Object.entries(metadata)) {
    Reflect.defineMetadata(key, value, handler);
  }
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(new Reflector(), jwt);

  it('lets public routes through without a token', async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} }, { [IS_PUBLIC_KEY]: true })),
    ).resolves.toBe(true);
  });

  it('attaches the user from a valid token', async () => {
    const token = await jwt.signAsync({ sub: 'user-1', role: Role.Admin });
    const request: Partial<Request> = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.auth).toEqual({ id: 'user-1', role: Role.Admin });
  });

  it.each([
    ['no header', undefined],
    ['another scheme', 'Basic abc'],
    ['a garbage token', 'Bearer not-a-jwt'],
  ])('rejects %s', async (_label, authorization) => {
    const request: Partial<Request> = { headers: authorization ? { authorization } : {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new JwtService({ secret: 'y'.repeat(32) }).signAsync({
      sub: 'user-1',
      role: Role.Admin,
    });
    const request: Partial<Request> = { headers: { authorization: `Bearer ${forged}` } };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token with an unknown role', async () => {
    const token = await jwt.signAsync({ sub: 'user-1', role: 'root' });
    const request: Partial<Request> = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows any authenticated user when no roles are required', () => {
    expect(guard.canActivate(contextFor({ auth: { id: 'u', role: Role.User } }))).toBe(true);
  });

  it('allows a user with a required role', () => {
    const context = contextFor(
      { auth: { id: 'u', role: Role.Admin } },
      { [ROLES_KEY]: [Role.Admin] },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('forbids a user without the required role', () => {
    const context = contextFor(
      { auth: { id: 'u', role: Role.User } },
      { [ROLES_KEY]: [Role.Admin] },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
