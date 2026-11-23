import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../../../config/env.validation.js';
import { PaymentProviderError } from '../payment-provider.js';

const TIMEOUT_MS = 10_000;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A string field, or a number turned into one (Mercado Pago mixes both for ids). */
export function readId(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  return typeof value === 'number' ? String(value) : null;
}

export function readDate(record: Record<string, unknown>, key: string): Date | null {
  const value = record[key];
  if (typeof value !== 'string') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Minimal Mercado Pago REST client over `fetch`. The access token never
 * reaches logs or error messages.
 */
@Injectable()
export class MercadoPagoClient {
  private readonly token: string | undefined;
  private readonly baseUrl: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.token = config.get('MP_ACCESS_TOKEN', { infer: true });
    this.baseUrl = config.get('MP_API_URL', { infer: true }).replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return this.token !== undefined;
  }

  /** Credentials from "Test credentials" start with `TEST-` and use the sandbox checkout URL. */
  usesTestCredentials(): boolean {
    return this.token?.startsWith('TEST-') ?? false;
  }

  /** GET that maps 404 to `null`, so unknown ids (simulated notifications) are ignored. */
  async find(path: string): Promise<Record<string, unknown> | null> {
    return this.send('GET', path, undefined, undefined, true);
  }

  async create(
    path: string,
    body: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    const result = await this.send('POST', path, body, idempotencyKey, false);
    if (!result) {
      throw new PaymentProviderError(`Mercado Pago POST ${path} returned no body`);
    }
    return result;
  }

  async update(path: string, body: Record<string, unknown>): Promise<void> {
    await this.send('PUT', path, body, undefined, false);
  }

  private async send(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body: Record<string, unknown> | undefined,
    idempotencyKey: string | undefined,
    allowNotFound: boolean,
  ): Promise<Record<string, unknown> | null> {
    if (!this.token) {
      throw new PaymentProviderError('MP_ACCESS_TOKEN is not set');
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new PaymentProviderError(
        `Mercado Pago ${method} ${path} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    if (allowNotFound && response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new PaymentProviderError(
        `Mercado Pago ${method} ${path} answered ${response.status}: ${detail.slice(0, 300)}`,
      );
    }
    const text = await response.text();
    if (text === '') {
      return null;
    }
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) {
      throw new PaymentProviderError(`Mercado Pago ${method} ${path} returned a non-object`);
    }
    return parsed;
  }
}
