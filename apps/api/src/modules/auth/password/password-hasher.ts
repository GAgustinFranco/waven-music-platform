import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto';

/** OWASP's scrypt profile N=2^15, r=8, p=3 (about 32 MiB per hash). */
const COST = { N: 2 ** 15, r: 8, p: 3 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
/** Node's default `maxmem` (32 MiB) is exactly 128·N·r, which it rejects. */
const MAX_MEMORY = 64 * 1024 * 1024;
const PREFIX = 'scrypt';

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

interface ParsedHash {
  options: ScryptOptions;
  salt: Buffer;
  key: Buffer;
}

/** `scrypt$N$r$p$salt$key`, with base64 salt and key. */
function parse(stored: string): ParsedHash | null {
  const [prefix, ...rest] = stored.split('$');
  if (prefix !== PREFIX || rest.length !== 5) {
    return null;
  }
  const [N, r, p, salt, key] = rest as [string, string, string, string, string];
  const cost = [N, r, p].map(Number);
  if (!cost.every((value) => Number.isSafeInteger(value) && value > 0)) {
    return null;
  }
  return {
    options: { N: Number(N), r: Number(r), p: Number(p), maxmem: MAX_MEMORY },
    salt: Buffer.from(salt, 'base64'),
    key: Buffer.from(key, 'base64'),
  };
}

/**
 * Hashes passwords with Node's built-in scrypt. The cost parameters are stored
 * with each hash, so they can be raised later without breaking existing ones.
 */
@Injectable()
export class PasswordHasher {
  /** Compared against when the account does not exist, so timing does not reveal it. */
  private readonly dummyHash = this.hash(randomBytes(16).toString('hex'));

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await deriveKey(password, salt, { ...COST, maxmem: MAX_MEMORY });
    return [PREFIX, COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join(
      '$',
    );
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parsed = parse(stored);
    if (!parsed || parsed.key.length !== KEY_LENGTH) {
      return false;
    }
    const key = await deriveKey(password, parsed.salt, parsed.options);
    return timingSafeEqual(key, parsed.key);
  }

  /** Spends the same time as `verify` and always fails. */
  async verifyDummy(password: string): Promise<false> {
    await this.verify(password, await this.dummyHash);
    return false;
  }
}
