import { slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it.each([
    ['Café del Mar', 'cafe-del-mar'],
    ['  Hello,   World!  ', 'hello-world'],
    ['Simon & Garfunkel', 'simon-and-garfunkel'],
    ['Ñandú Über', 'nandu-uber'],
    ['---', 'untitled'],
    ['日本語', 'untitled'],
  ])('%j → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('caps the length without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(199)} b`);
    expect(slug.length).toBeLessThanOrEqual(200);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('adds a numeric suffix until the slug is free', async () => {
    const taken = new Set(['night-drive', 'night-drive-2']);
    await expect(
      uniqueSlug('Night Drive', (slug) => Promise.resolve(taken.has(slug))),
    ).resolves.toBe('night-drive-3');
  });
});
