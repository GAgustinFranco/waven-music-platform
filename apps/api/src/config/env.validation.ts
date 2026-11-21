import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const splitList = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : value;

const toLowerCaseList = (params: { value: unknown }): unknown => {
  const list = splitList(params);
  return Array.isArray(list) ? list.map((item) => String(item).toLowerCase()) : list;
};

const toBoolean = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() === 'true' : value;

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @IsUrl({ protocols: ['postgres', 'postgresql'], require_tld: false, require_protocol: true })
  DATABASE_URL: string;

  @IsIn(LOG_LEVELS)
  LOG_LEVEL: LogLevel = 'info';

  /** Comma-separated list of origins allowed by CORS (Swagger and local dev). */
  @Transform(splitList)
  @ArrayNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true }, { each: true })
  CORS_ORIGINS: string[] = ['http://localhost:3000'];

  /** Public origin of the web app: OAuth redirects there and refresh checks `Origin` against it. */
  @IsUrl({ require_tld: false, require_protocol: true })
  WEB_URL = 'http://localhost:3000';

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_SECRET: string;

  /** Goes through the web proxy so the refresh cookie is first-party. */
  @IsUrl({ require_tld: false, require_protocol: true })
  GOOGLE_CALLBACK_URL = 'http://localhost:3000/api/auth/google/callback';

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  /** Access token lifetime in seconds. */
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(3600)
  JWT_ACCESS_TTL = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  REFRESH_TTL_DAYS = 30;

  /** Comma-separated emails that get the admin role at login. */
  @Transform(toLowerCaseList)
  @IsEmail({}, { each: true })
  ADMIN_EMAILS: string[] = [];

  /** Registers `POST /auth/test-login`. Only honored when NODE_ENV=test. */
  @Transform(toBoolean)
  @IsBoolean()
  E2E_AUTH_BYPASS = false;
}

/**
 * Validates the raw environment at startup. Throwing here stops the API from
 * booting, so a missing or malformed variable fails fast.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { exposeDefaultValues: true });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return env;
}

/** True only when the test login route may be registered. */
export function isAuthBypassEnabled(
  env: Pick<EnvironmentVariables, 'NODE_ENV' | 'E2E_AUTH_BYPASS'>,
) {
  return env.NODE_ENV === NodeEnv.Test && env.E2E_AUTH_BYPASS;
}
