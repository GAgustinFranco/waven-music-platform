import { type ByteRange } from '../storage/storage.types.js';

export type RangeResult =
  { kind: 'full' } | { kind: 'partial'; range: ByteRange } | { kind: 'unsatisfiable' };

/**
 * Parses a `Range` header for a resource of `size` bytes (RFC 9110 §14).
 * Only single `bytes` ranges are honored; anything else is served in full,
 * which the RFC allows.
 */
export function parseRange(header: string | undefined, size: number): RangeResult {
  if (!header) {
    return { kind: 'full' };
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) {
    return { kind: 'full' };
  }
  const [, rawStart = '', rawEnd = ''] = match;
  if (rawStart === '' && rawEnd === '') {
    return { kind: 'full' };
  }

  if (rawStart === '') {
    // Suffix range: the last N bytes.
    const length = Number(rawEnd);
    if (length === 0 || size === 0) {
      return { kind: 'unsatisfiable' };
    }
    return { kind: 'partial', range: { start: Math.max(0, size - length), end: size - 1 } };
  }

  const start = Number(rawStart);
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (start >= size) {
    return { kind: 'unsatisfiable' };
  }
  if (end < start) {
    return { kind: 'full' };
  }
  return { kind: 'partial', range: { start, end } };
}
