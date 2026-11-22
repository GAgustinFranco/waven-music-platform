import { createHmac, timingSafeEqual } from 'node:crypto';

/** Accepted clock difference between Mercado Pago's `ts` and ours. */
export const SIGNATURE_TOLERANCE_MS = 10 * 60 * 1000;

export interface SignatureInput {
  /** The `x-signature` header: `ts=<timestamp>,v1=<hex hmac>`. */
  header: string | undefined;
  /** The `x-request-id` header. */
  requestId: string | undefined;
  /** The `data.id` query parameter. */
  dataId: string | undefined;
  secret: string | undefined;
  now?: Date;
}

/** Parses `ts=…,v1=…` (order and spaces do not matter). */
export function parseSignatureHeader(header: string): { ts: string; v1: string } | null {
  const parts = new Map(
    header.split(',').map((part) => {
      const [key = '', ...rest] = part.split('=');
      return [key.trim(), rest.join('=').trim()] as const;
    }),
  );
  const ts = parts.get('ts');
  const v1 = parts.get('v1');
  return ts && v1 ? { ts, v1 } : null;
}

/**
 * The signed manifest: `id:{data.id};request-id:{x-request-id};ts:{ts};`.
 * Alphanumeric ids are lowercased and missing values drop their part, as
 * Mercado Pago documents.
 */
export function buildManifest(
  dataId: string | undefined,
  requestId: string | undefined,
  ts: string,
) {
  const id = dataId && /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  return `${id ? `id:${id};` : ''}${requestId ? `request-id:${requestId};` : ''}ts:${ts};`;
}

export function signManifest(manifest: string, secret: string): string {
  return createHmac('sha256', secret).update(manifest).digest('hex');
}

/** `ts` may come in seconds or milliseconds. */
function timestampMs(ts: string): number | null {
  if (!/^\d+$/.test(ts)) {
    return null;
  }
  const value = Number(ts);
  return value > 1e12 ? value : value * 1000;
}

/** HMAC-SHA256 check in constant time, inside the `ts` tolerance window. */
export function verifyMercadoPagoSignature(input: SignatureInput): boolean {
  if (!input.secret || !input.header) {
    return false;
  }
  const parsed = parseSignatureHeader(input.header);
  if (!parsed || !/^[0-9a-f]{64}$/i.test(parsed.v1)) {
    return false;
  }
  const sentAt = timestampMs(parsed.ts);
  const now = (input.now ?? new Date()).getTime();
  if (sentAt === null || Math.abs(now - sentAt) > SIGNATURE_TOLERANCE_MS) {
    return false;
  }
  const expected = Buffer.from(
    signManifest(buildManifest(input.dataId, input.requestId, parsed.ts), input.secret),
    'hex',
  );
  return timingSafeEqual(expected, Buffer.from(parsed.v1.toLowerCase(), 'hex'));
}
