import { pipeline } from 'node:stream/promises';
import { Controller, Get, HttpStatus, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type Response } from 'express';
import { Public } from '../auth/decorators/auth.decorators.js';
import { STORAGE_DRIVER, type StorageDriver } from '../storage/storage.types.js';

/** Only processed images are public; audio always goes through `/stream`. */
const PUBLIC_IMAGE_KEY = /^images\/[0-9a-f-]{36}\/(64|300|640)\.webp$/;
const ONE_YEAR = 31_536_000;

/**
 * Serves cover and artist images in development. In production
 * `MEDIA_PUBLIC_URL` points at a public bucket or CDN instead. Image keys are
 * never reused, so responses are cached forever.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('media')
export class MediaController {
  constructor(@Inject(STORAGE_DRIVER) private readonly storage: StorageDriver) {}

  @Get('*key')
  async get(@Param('key') segments: string[] | string, @Res() res: Response): Promise<void> {
    const key = Array.isArray(segments) ? segments.join('/') : segments;
    if (!PUBLIC_IMAGE_KEY.test(key)) {
      throw notFound();
    }

    const signedUrl = await this.storage.getSignedUrl(key, 3600);
    if (signedUrl) {
      res.redirect(HttpStatus.FOUND, signedUrl);
      return;
    }

    const object = await this.storage.stat(key);
    if (!object) {
      throw notFound();
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Length', String(object.size));
    res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
    const body = await this.storage.getStream(key);
    await pipeline(body, res).catch(() => body.destroy());
  }
}

function notFound(): NotFoundException {
  return new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Media not found' });
}
