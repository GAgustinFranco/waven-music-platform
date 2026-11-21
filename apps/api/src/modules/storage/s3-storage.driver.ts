import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  assertValidKey,
  type ByteRange,
  type StorageDriver,
  type StorageSource,
  type StoredObject,
} from './storage.types.js';

export interface S3StorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Any S3-compatible bucket. In production this is Cloudflare R2. */
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.endpoint !== undefined,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async put(key: string, source: StorageSource, contentType: string): Promise<void> {
    assertValidKey(key);
    const isBuffer = Buffer.isBuffer(source);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: isBuffer ? source : createReadStream(source.path),
        ContentLength: isBuffer ? source.length : (await stat(source.path)).size,
        ContentType: contentType,
      }),
    );
  }

  async stat(key: string): Promise<StoredObject | null> {
    assertValidKey(key);
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: head.ContentLength ?? 0 };
    } catch (error: unknown) {
      if (error instanceof NotFound) {
        return null;
      }
      throw error;
    }
  }

  async getStream(key: string, range?: ByteRange): Promise<Readable> {
    assertValidKey(key);
    const object = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    if (!(object.Body instanceof Readable)) {
      throw new Error(`Unexpected body for ${key}`);
    }
    return object.Body;
  }

  getSignedUrl(key: string, expiresInSeconds: number): Promise<string | null> {
    assertValidKey(key);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    const listed = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: key }),
    );
    // The key itself or objects under `key/`, never siblings that only share a prefix.
    const keys = (listed.Contents ?? [])
      .map((object) => object.Key)
      .filter((name): name is string => name === key || (name?.startsWith(`${key}/`) ?? false));
    if (keys.length > 0) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.map((name) => ({ Key: name })) },
        }),
      );
    }
  }
}
