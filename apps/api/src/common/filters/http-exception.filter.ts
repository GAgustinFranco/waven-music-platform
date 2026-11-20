import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type Response } from 'express';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

const CODE_BY_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE]: 'RANGE_NOT_SATISFIABLE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Turns every error into `{ statusCode, code, message }`. Throw an HttpException
 * with `{ code, message }` as its response to set a domain-specific code.
 */
export function toApiErrorBody(exception: unknown): ApiErrorBody {
  if (!(exception instanceof HttpException)) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    };
  }

  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  const fallbackCode = CODE_BY_STATUS[statusCode] ?? 'HTTP_ERROR';

  if (!isRecord(response)) {
    return { statusCode, code: fallbackCode, message: String(response) };
  }

  const rawMessage = response['message'];
  const message = Array.isArray(rawMessage)
    ? rawMessage.map(String).join('; ')
    : typeof rawMessage === 'string'
      ? rawMessage
      : exception.message;
  // ValidationPipe reports a list of messages; give it a stable code of its own.
  const code =
    typeof response['code'] === 'string'
      ? response['code']
      : Array.isArray(rawMessage)
        ? 'VALIDATION_FAILED'
        : fallbackCode;

  return { statusCode, code, message };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toApiErrorBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
