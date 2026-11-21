import { createReadStream } from 'node:fs';
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { type Readable } from 'node:stream';
import {
  assertValidKey,
  type ByteRange,
  type StorageDriver,
  type StorageSource,
  type StoredObject,
} from './storage.types.js';

/** Stores objects as files under a root folder. Used in development and tests. */
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathOf(key: string): string {
    assertValidKey(key);
    return join(this.root, ...key.split('/'));
  }

  async put(key: string, source: StorageSource): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    if (Buffer.isBuffer(source)) {
      await writeFile(path, source);
    } else {
      await copyFile(source.path, path);
    }
  }

  async stat(key: string): Promise<StoredObject | null> {
    try {
      const info = await stat(this.pathOf(key));
      return info.isFile() ? { size: info.size } : null;
    } catch (error: unknown) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  getStream(key: string, range?: ByteRange): Promise<Readable> {
    return Promise.resolve(createReadStream(this.pathOf(key), range));
  }

  getSignedUrl(): Promise<string | null> {
    return Promise.resolve(null);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { recursive: true, force: true });
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
