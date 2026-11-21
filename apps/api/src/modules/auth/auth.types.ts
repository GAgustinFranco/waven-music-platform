import { type Role } from '../users/user.entity.js';

/** Identity attached to the request by `JwtAuthGuard`. */
export interface AuthUser {
  id: string;
  role: Role;
}

/** Claims inside the access JWT. */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `JwtAuthGuard`. Kept apart from `req.user`, which Passport owns. */
      auth?: AuthUser;
    }
  }
}
