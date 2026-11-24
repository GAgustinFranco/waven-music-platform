import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('stores the algorithm, its cost and a random salt with the key', async () => {
    const first = await hasher.hash('correct horse battery');
    const second = await hasher.hash('correct horse battery');

    expect(first).toMatch(/^scrypt\$32768\$8\$3\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain('correct horse battery');
  });

  it('accepts the right password and rejects any other', async () => {
    const stored = await hasher.hash('correct horse battery');

    await expect(hasher.verify('correct horse battery', stored)).resolves.toBe(true);
    await expect(hasher.verify('correct horse batterY', stored)).resolves.toBe(false);
    await expect(hasher.verify('', stored)).resolves.toBe(false);
  });

  it('treats canonically equivalent Unicode the same', async () => {
    const stored = await hasher.hash('café-password');

    await expect(hasher.verify('café-password', stored)).resolves.toBe(true);
  });

  it('rejects malformed hashes instead of throwing', async () => {
    await expect(hasher.verify('secret-password', 'not-a-hash')).resolves.toBe(false);
    await expect(hasher.verify('secret-password', 'scrypt$x$8$3$c2FsdA==$a2V5')).resolves.toBe(
      false,
    );
    await expect(hasher.verify('secret-password', 'scrypt$16384$8$1$c2FsdA==$a2V5')).resolves.toBe(
      false,
    );
  });

  it('always fails the dummy check', async () => {
    await expect(hasher.verifyDummy('anything at all')).resolves.toBe(false);
  });
});
