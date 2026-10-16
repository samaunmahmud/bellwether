import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}

// scrypt work factor. Chosen so one hash takes tens of milliseconds on a typical server.
// Stored with each hash, so it can be raised later without breaking existing passwords.
export const SCRYPT_COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  // scrypt needs about 128 * N * r bytes; allow double that.
  const maxmem = 256 * (options.N ?? SCRYPT_COST) * (options.r ?? BLOCK_SIZE);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { ...options, maxmem }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** A9: passwords are stored as `scrypt$N$r$p$salt$hash` (salt and hash base64). */
export function createScryptHasher(cost: number = SCRYPT_COST): PasswordHasher {
  return {
    async hash(password) {
      const salt = randomBytes(SALT_BYTES);
      const key = await derive(password, salt, { N: cost, r: BLOCK_SIZE, p: PARALLELISM });
      return [
        'scrypt',
        cost,
        BLOCK_SIZE,
        PARALLELISM,
        salt.toString('base64'),
        key.toString('base64'),
      ].join('$');
    },

    async verify(password, stored) {
      const parts = stored.split('$');
      if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
      const [N, r, p] = parts.slice(1, 4).map(Number);
      if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

      const salt = Buffer.from(parts[4]!, 'base64');
      const expected = Buffer.from(parts[5]!, 'base64');
      if (expected.length !== KEY_LENGTH) return false;

      const key = await derive(password, salt, { N, r, p });
      return timingSafeEqual(key, expected);
    },
  };
}
