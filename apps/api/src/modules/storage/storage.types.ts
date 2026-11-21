import { type Readable } from 'node:stream';

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

/** Inclusive byte range, as in `Content-Range`. */
export interface ByteRange {
  start: number;
  end: number;
}

/** A file on disk or an in-memory buffer. */
export type StorageSource = Buffer | { path: string };

export interface StoredObject {
  size: number;
}

/** Storage backend for audio and images. Keys look like `audio/<uuid>/std.mp3`. */
export interface StorageDriver {
  put(key: string, source: StorageSource, contentType: string): Promise<void>;
  /** `null` when the key does not exist. */
  stat(key: string): Promise<StoredObject | null>;
  getStream(key: string, range?: ByteRange): Promise<Readable>;
  /**
   * A presigned URL the browser can fetch directly, or `null` when the driver
   * cannot sign URLs and the API has to serve the bytes itself (local disk).
   */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string | null>;
  /** Deletes the key and every object under `key/`; missing keys are ignored. */
  delete(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*$/i;

/** Rejects keys that could escape the storage root (`..`, absolute paths, backslashes). */
export function assertValidKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}
