import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { toApiErrorBody } from './http-exception.filter.js';

describe('toApiErrorBody', () => {
  it('maps a standard HttpException to a stable code', () => {
    expect(toApiErrorBody(new NotFoundException('Track not found'))).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Track not found',
    });
  });

  it('keeps a domain-specific code', () => {
    const exception = new ForbiddenException({
      code: 'PLAN_LIMIT_REACHED',
      message: 'Upgrade to create more playlists',
    });

    expect(toApiErrorBody(exception)).toEqual({
      statusCode: 403,
      code: 'PLAN_LIMIT_REACHED',
      message: 'Upgrade to create more playlists',
    });
  });

  it('joins validation messages', () => {
    const exception = new BadRequestException([
      'name must be a string',
      'name should not be empty',
    ]);

    expect(toApiErrorBody(exception)).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'name must be a string; name should not be empty',
    });
  });

  it('handles a string response and an unmapped status', () => {
    expect(toApiErrorBody(new HttpException('I am a teapot', 418))).toEqual({
      statusCode: 418,
      code: 'HTTP_ERROR',
      message: 'I am a teapot',
    });
  });

  it('hides the details of unknown errors', () => {
    expect(toApiErrorBody(new Error('connection string leaked'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
