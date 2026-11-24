import { pipeline } from 'node:stream/promises';
import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPartialContentResponse,
  ApiProduces,
  ApiQuery,
  ApiRequestedRangeNotSatisfiableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type Response } from 'express';
import { type AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators/auth.decorators.js';
import { STORAGE_DRIVER, type StorageDriver } from '../storage/storage.types.js';
import { parseRange } from './range.js';
import { StreamUrlDto } from './stream.dto.js';
import { StreamingService } from './streaming.service.js';

@ApiTags('streaming')
@Controller()
export class StreamingController {
  constructor(
    private readonly streaming: StreamingService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  @Post('tracks/:id/stream')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOkResponse({
    type: StreamUrlDto,
    description: 'Quality follows the plan (every plan gets high, 320 kbps).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiNotFoundResponse({ description: 'Unknown, deleted or not yet playable track.' })
  issue(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamUrlDto> {
    return this.streaming.issue(user, id);
  }

  /**
   * Audio bytes for `<audio src>`. Authenticated by the signed token instead of
   * the JWT. Local storage answers Range requests here (200/206/416); S3
   * storage redirects (302) to a presigned URL that handles them.
   */
  @Get('stream/:trackId')
  @Public()
  @SkipThrottle()
  @ApiProduces('audio/mpeg')
  @ApiQuery({ name: 'token', required: true, description: 'From `POST /tracks/:id/stream`.' })
  @ApiOkResponse({ description: 'The whole file.' })
  @ApiPartialContentResponse({ description: 'The requested byte range.' })
  @ApiFoundResponse({ description: 'Redirect to a presigned URL (S3 storage).' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired stream token.' })
  @ApiNotFoundResponse({ description: 'Unknown, deleted or not yet playable track.' })
  @ApiRequestedRangeNotSatisfiableResponse({ description: 'The range is outside the file.' })
  async stream(
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @Query('token') token: string | undefined,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { key, remainingSeconds } = await this.streaming.resolve(trackId, token);

    const signedUrl = await this.storage.getSignedUrl(key, remainingSeconds);
    if (signedUrl) {
      res.setHeader('Cache-Control', 'private, no-store');
      res.redirect(HttpStatus.FOUND, signedUrl);
      return;
    }

    const object = await this.storage.stat(key);
    if (!object) {
      throw new NotFoundException({ code: 'TRACK_NOT_FOUND', message: 'Track not found' });
    }
    res.setHeader('Accept-Ranges', 'bytes');

    const range = parseRange(rangeHeader, object.size);
    if (range.kind === 'unsatisfiable') {
      // The exception filter writes the JSON error body; only the range header is added here.
      res.setHeader('Content-Range', `bytes */${object.size}`);
      throw new HttpException(
        { code: 'RANGE_NOT_SATISFIABLE', message: 'The requested range is outside the file' },
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      );
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', `private, max-age=${remainingSeconds}`);

    if (range.kind === 'partial') {
      const { start, end } = range.range;
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${object.size}`);
      res.setHeader('Content-Length', String(end - start + 1));
    } else {
      res.status(HttpStatus.OK);
      res.setHeader('Content-Length', String(object.size));
    }

    const body = await this.storage.getStream(
      key,
      range.kind === 'partial' ? range.range : undefined,
    );
    // The player aborts requests while seeking; a closed connection is not an error.
    await pipeline(body, res).catch(() => body.destroy());
  }
}
