import {
  buildManifest,
  parseSignatureHeader,
  signManifest,
  verifyMercadoPagoSignature,
} from './mercadopago-signature.js';

const SECRET = 'webhook-secret';
const NOW = new Date('2026-11-21T12:00:00Z');
const TS = String(Math.floor(NOW.getTime() / 1000));

function header(dataId: string, requestId: string, ts = TS, secret = SECRET): string {
  return `ts=${ts},v1=${signManifest(buildManifest(dataId, requestId, ts), secret)}`;
}

describe('Mercado Pago webhook signature', () => {
  it('builds the documented manifest, lowercasing alphanumeric ids', () => {
    expect(buildManifest('ABC123', 'req-1', '1700')).toBe('id:abc123;request-id:req-1;ts:1700;');
    expect(buildManifest(undefined, 'req-1', '1700')).toBe('request-id:req-1;ts:1700;');
    expect(buildManifest('12-34', undefined, '1700')).toBe('id:12-34;ts:1700;');
  });

  it('parses the header in any order', () => {
    expect(parseSignatureHeader(' v1=abc , ts=123')).toEqual({ ts: '123', v1: 'abc' });
    expect(parseSignatureHeader('ts=123')).toBeNull();
  });

  it('accepts a valid signature (seconds or milliseconds)', () => {
    const base = { requestId: 'req-1', dataId: '123', secret: SECRET, now: NOW };
    expect(verifyMercadoPagoSignature({ ...base, header: header('123', 'req-1') })).toBe(true);
    const ms = String(NOW.getTime());
    expect(verifyMercadoPagoSignature({ ...base, header: header('123', 'req-1', ms) })).toBe(true);
  });

  it.each([
    ['another secret', header('123', 'req-1', TS, 'other-secret')],
    ['another data id', header('999', 'req-1')],
    ['another request id', header('123', 'req-2')],
    ['an old timestamp', header('123', 'req-1', String(Number(TS) - 3600))],
    ['a malformed header', 'v1=zz'],
  ])('rejects %s', (_case, value) => {
    expect(
      verifyMercadoPagoSignature({
        header: value,
        requestId: 'req-1',
        dataId: '123',
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(
      verifyMercadoPagoSignature({
        header: header('123', 'req-1'),
        requestId: 'req-1',
        dataId: '123',
        secret: undefined,
        now: NOW,
      }),
    ).toBe(false);
  });
});
