import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { PaymentMode } from '../modules/billing/subscription.entity.js';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum StorageDriverKind {
  Local = 'local',
  S3 = 's3',
}

export enum MailDriverKind {
  Log = 'log',
  Memory = 'memory',
  Resend = 'resend',
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

/** Lets optional variables be left blank in .env files. */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

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

  /** `local` writes to disk (dev); `s3` targets any S3-compatible bucket such as R2 (prod). */
  @IsEnum(StorageDriverKind)
  STORAGE_DRIVER: StorageDriverKind = StorageDriverKind.Local;

  /** Root folder of the local driver, relative to the API's working directory. */
  @IsString()
  @IsNotEmpty()
  STORAGE_LOCAL_DIR = '../../storage';

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_DRIVER === StorageDriverKind.S3)
  @IsString()
  @IsNotEmpty()
  S3_BUCKET?: string;

  /** Custom endpoint for S3-compatible providers (R2: `https://<account>.r2.cloudflarestorage.com`). */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  S3_ENDPOINT?: string;

  @IsString()
  @IsNotEmpty()
  S3_REGION = 'auto';

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_DRIVER === StorageDriverKind.S3)
  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY_ID?: string;

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_DRIVER === StorageDriverKind.S3)
  @IsString()
  @IsNotEmpty()
  S3_SECRET_ACCESS_KEY?: string;

  /** Public base URL of images (`/media/*` through the web proxy in dev, a public bucket in prod). */
  @IsUrl({ require_tld: false, require_protocol: true })
  MEDIA_PUBLIC_URL = 'http://localhost:3000/api/media';

  /** Base URL the browser uses to reach `GET /stream/:id` (through the web proxy by default). */
  @IsUrl({ require_tld: false, require_protocol: true })
  STREAM_BASE_URL = 'http://localhost:3000/api';

  /** HMAC key of the signed stream URLs. */
  @IsString()
  @MinLength(32)
  STREAM_TOKEN_SECRET: string;

  /** Stream token lifetime in seconds. */
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86_400)
  STREAM_TOKEN_TTL = 3600;

  /** Transcoding jobs that run at the same time. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  MEDIA_CONCURRENCY = 2;

  /** Overrides the ffmpeg binary bundled by `ffmpeg-static`. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  FFMPEG_PATH?: string;

  /** `preapproval` (monthly subscription) or `onetime` (Checkout Pro, 30 days per payment). */
  @IsEnum(PaymentMode)
  PAYMENT_MODE: PaymentMode = PaymentMode.Preapproval;

  /** Seller access token. Checkout answers 503 while it is missing. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  MP_ACCESS_TOKEN?: string;

  /** Secret signature of the webhook (Your integrations → Webhooks). Without it every webhook gets 401. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  MP_WEBHOOK_SECRET?: string;

  /** Public https origin of the web (a tunnel in dev); Mercado Pago sends the buyer back there. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  MP_PUBLIC_URL?: string;

  /** Sandbox only: the test buyer's email, which Mercado Pago requires as the payer. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEmail()
  MP_TEST_PAYER_EMAIL?: string;

  /** Mercado Pago API origin. */
  @IsUrl({ require_tld: false, require_protocol: true })
  MP_API_URL = 'https://api.mercadopago.com';

  /** `log` only logs (dev), `memory` keeps messages for tests, `resend` sends them (prod). */
  @IsEnum(MailDriverKind)
  MAIL_DRIVER: MailDriverKind = MailDriverKind.Log;

  /** Sender, e.g. `Waven <hello@example.com>`; with Resend the domain must be verified. */
  @IsString()
  @IsNotEmpty()
  MAIL_FROM = 'Waven <no-reply@waven.local>';

  @ValidateIf((env: EnvironmentVariables) => env.MAIL_DRIVER === MailDriverKind.Resend)
  @IsString()
  @IsNotEmpty()
  RESEND_API_KEY?: string;
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
