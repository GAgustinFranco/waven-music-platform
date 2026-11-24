import { createHash, randomBytes } from 'node:crypto';
import { type EmailVerification } from '../users/users.service.js';

/** How long a verification link works. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** The token goes only in the link; the database keeps its SHA-256. */
export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 32 random bytes as base64url: unguessable, so a fast hash is enough. */
export function createVerificationToken(now = new Date()): EmailVerification & { token: string } {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashVerificationToken(token),
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
  };
}

/** The web page that posts the token to `POST /auth/verify-email`. */
export function verificationUrl(webUrl: string, token: string): string {
  return `${webUrl.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
}
