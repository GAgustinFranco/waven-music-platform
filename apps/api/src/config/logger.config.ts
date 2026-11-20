import { randomUUID } from 'node:crypto';
import { type IncomingMessage } from 'node:http';
import { type Params } from 'nestjs-pino';
import { type EnvironmentVariables, NodeEnv } from './env.validation.js';

const REQUEST_ID_HEADER = 'x-request-id';

export function buildLoggerParams(env: EnvironmentVariables): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: (req: IncomingMessage) => {
        const incoming = req.headers[REQUEST_ID_HEADER];
        return typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
      },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[redacted]',
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
      transport:
        env.NODE_ENV === NodeEnv.Development
          ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } }
          : undefined,
    },
  };
}
