import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { LocalStorageDriver } from './local-storage.driver.js';

describe('LocalStorageDriver', () => {
  let root: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'waven-storage-'));
    driver = new LocalStorageDriver(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('stores buffers and files, and reads byte ranges back', async () => {
    await driver.put('images/a/64.webp', Buffer.from('0123456789'));
    const source = join(root, 'source.txt');
    await writeFile(source, 'hello');
    await driver.put('audio/b/std.mp3', { path: source });

    expect(await driver.stat('images/a/64.webp')).toEqual({ size: 10 });
    const range = await driver.getStream('images/a/64.webp', { start: 2, end: 4 });
    expect(await text(range)).toBe('234');
    expect(await text(await driver.getStream('audio/b/std.mp3'))).toBe('hello');
    expect(await driver.getSignedUrl()).toBeNull();
  });

  it('deletes a prefix and ignores missing keys', async () => {
    await driver.put('images/a/64.webp', Buffer.from('x'));
    await driver.put('images/a/300.webp', Buffer.from('x'));

    await driver.delete('images/a');
    await driver.delete('images/never-existed');

    expect(await driver.stat('images/a/64.webp')).toBeNull();
    expect(await driver.stat('images/a/300.webp')).toBeNull();
  });

  it.each(['../escape', 'images/../../etc', '/absolute', 'images\\a', 'images/./a', ''])(
    'rejects the unsafe key %j',
    async (key) => {
      await expect(driver.stat(key)).rejects.toThrow(/Invalid storage key/);
    },
  );
});
