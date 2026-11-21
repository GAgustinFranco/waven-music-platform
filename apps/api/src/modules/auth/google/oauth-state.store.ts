import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Request } from 'express';
import { type EnvironmentVariables } from '../../../config/env.validation.js';
import {
  clearOAuthStateCookie,
  OAUTH_STATE_COOKIE,
  readCookie,
  setOAuthStateCookie,
} from '../auth.cookies.js';

type StoreCallback = (err: Error | null, state: string) => void;
type VerifyCallback = (err: Error | null, ok: boolean, state: string | { message: string }) => void;

const sameString = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

// Passport passes `meta` only when the method declares it, so the callback can be
// in either position.
function pickCallback<T>(metaOrCallback: unknown, maybeCallback: T | undefined): T {
  const callback = maybeCallback ?? metaOrCallback;
  if (typeof callback !== 'function') {
    throw new TypeError('OAuth state store called without a callback');
  }
  return callback as T;
}

/**
 * Passport state store backed by a short-lived httpOnly cookie, because the API
 * has no server-side sessions. Passport picks the call shape from each method's
 * arity, so both declare the `meta` parameter.
 */
@Injectable()
export class OAuthStateStore {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  store(req: Request, metaOrCallback: unknown, maybeCallback?: StoreCallback): void {
    const callback = pickCallback<StoreCallback>(metaOrCallback, maybeCallback);
    const state = randomBytes(24).toString('base64url');
    if (req.res) {
      setOAuthStateCookie(req.res, state, this.secure);
    }
    callback(null, state);
  }

  verify(
    req: Request,
    state: string,
    metaOrCallback: unknown,
    maybeCallback?: VerifyCallback,
  ): void {
    const callback = pickCallback<VerifyCallback>(metaOrCallback, maybeCallback);
    const expected = readCookie(req, OAUTH_STATE_COOKIE);
    if (req.res) {
      clearOAuthStateCookie(req.res, this.secure);
    }
    if (expected && sameString(expected, state)) {
      callback(null, true, state);
    } else {
      callback(null, false, { message: 'Invalid OAuth state' });
    }
  }

  private get secure(): boolean {
    return this.config.get('WEB_URL', { infer: true }).startsWith('https:');
  }
}
