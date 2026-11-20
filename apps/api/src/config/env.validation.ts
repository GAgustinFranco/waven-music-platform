import { plainToInstance, Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsEnum, IsIn, IsInt, IsUrl, Max, Min, validateSync } from 'class-validator';

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
