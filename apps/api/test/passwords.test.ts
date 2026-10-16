import { describe, expect, it } from 'vitest';
import { createScryptHasher } from '../src/auth/passwords';

// A low cost keeps the tests fast; production uses the default cost.
const hasher = createScryptHasher(2 ** 10);

describe('scrypt password hasher (A9)', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hasher.hash('correct horse battery');
    expect(await hasher.verify('correct horse battery', stored)).toBe(true);
    expect(await hasher.verify('correct horse batterz', stored)).toBe(false);
  });

  it('never stores the password itself, and salts every hash', async () => {
    const a = await hasher.hash('correct horse battery');
    const b = await hasher.hash('correct horse battery');
    expect(a).not.toContain('correct horse battery');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$1024\$8\$1\$/);
  });

  it('verifies a hash made with a different cost, because the cost is stored with it', async () => {
    const stored = await createScryptHasher(2 ** 11).hash('correct horse battery');
    expect(await hasher.verify('correct horse battery', stored)).toBe(true);
  });

  it.each(['', 'plain', 'scrypt$1024$8$1$c2FsdA==', 'bcrypt$1$2$3$a$b', 'scrypt$x$8$1$a$b'])(
    'rejects a malformed stored hash: %s',
    async (stored) => {
      expect(await hasher.verify('anything', stored)).toBe(false);
    },
  );
});
