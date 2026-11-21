import { creativeCommonsName } from './license.js';

describe('creativeCommonsName', () => {
  it.each([
    ['http://creativecommons.org/licenses/by-nc-sa/3.0/', 'CC BY-NC-SA 3.0'],
    ['https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0'],
    ['http://creativecommons.org/licenses/by-nc-nd/2.5/it/', 'CC BY-NC-ND 2.5'],
    ['https://creativecommons.org/publicdomain/zero/1.0/', 'CC0 1.0'],
  ])('%s → %s', (url, expected) => {
    expect(creativeCommonsName(url)).toBe(expected);
  });

  it('returns null for anything else', () => {
    expect(creativeCommonsName('https://example.com/license')).toBeNull();
  });
});
