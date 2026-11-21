import { detectAudioType, detectImageType } from './file-type.js';

const bytes = (...values: (number | string)[]) =>
  Buffer.concat(
    values.map((value) =>
      typeof value === 'string' ? Buffer.from(value, 'latin1') : Buffer.from([value]),
    ),
  );

describe('detectAudioType', () => {
  it.each([
    ['mp3 with ID3', bytes('ID3', 4, 0, 0), 'mp3'],
    ['mp3 frame sync', bytes(0xff, 0xfb, 0x90, 0x00), 'mp3'],
    ['flac', bytes('fLaC', 0, 0, 0, 34), 'flac'],
    ['wav', bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt '), 'wav'],
    ['ogg', bytes('OggS', 0, 2), 'ogg'],
  ])('detects %s', (_name, header, expected) => {
    expect(detectAudioType(header)).toBe(expected);
  });

  it.each([
    ['plain text', bytes('hello world')],
    ['png', bytes(0x89, 'PNG\r\n', 0x1a, '\n')],
    ['webp (RIFF but not WAVE)', bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 ')],
    ['empty', Buffer.alloc(0)],
  ])('rejects %s', (_name, header) => {
    expect(detectAudioType(header)).toBeNull();
  });
});

describe('detectImageType', () => {
  it.each([
    ['jpeg', bytes(0xff, 0xd8, 0xff, 0xe0), 'jpeg'],
    ['png', bytes(0x89, 'PNG\r\n', 0x1a, '\n'), 'png'],
    ['webp', bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '), 'webp'],
  ])('detects %s', (_name, header, expected) => {
    expect(detectImageType(header)).toBe(expected);
  });

  it.each([
    ['gif', bytes('GIF89a')],
    ['svg', bytes('<svg xmlns=')],
    ['mp3', bytes('ID3', 4, 0, 0)],
  ])('rejects %s', (_name, header) => {
    expect(detectImageType(header)).toBeNull();
  });
});
