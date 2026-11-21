import { open } from 'node:fs/promises';

export type AudioType = 'mp3' | 'flac' | 'wav' | 'ogg';
export type ImageType = 'jpeg' | 'png' | 'webp';

const ascii = (bytes: Buffer, offset: number, value: string) =>
  bytes.subarray(offset, offset + value.length).toString('latin1') === value;

/** Detects an audio container from its magic bytes (the extension and MIME type are not trusted). */
export function detectAudioType(bytes: Buffer): AudioType | null {
  if (ascii(bytes, 0, 'ID3')) {
    return 'mp3';
  }
  // MPEG audio frame sync: 11 set bits, a valid layer (not 00) and not the reserved version.
  const first = bytes[0];
  const second = bytes[1];
  if (
    first === 0xff &&
    second !== undefined &&
    (second & 0xe0) === 0xe0 &&
    (second & 0x06) !== 0 &&
    (second & 0x18) !== 0x08
  ) {
    return 'mp3';
  }
  if (ascii(bytes, 0, 'fLaC')) {
    return 'flac';
  }
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WAVE')) {
    return 'wav';
  }
  if (ascii(bytes, 0, 'OggS')) {
    return 'ogg';
  }
  return null;
}

export function detectImageType(bytes: Buffer): ImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
    return 'webp';
  }
  return null;
}

/** Reads the first bytes of a file, enough for the signatures above. */
export async function readHeader(path: string, length = 16): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
