/**
 * Human-readable name of a Creative Commons license URL:
 * `http://creativecommons.org/licenses/by-nc-sa/3.0/` → `CC BY-NC-SA 3.0`.
 */
export function creativeCommonsName(url: string): string | null {
  const match = /creativecommons\.org\/(?:licenses|publicdomain)\/([a-z-]+)\/(\d+(?:\.\d+)?)/i.exec(
    url,
  );
  if (!match) {
    return null;
  }
  const [, kind = '', version = ''] = match;
  return kind.toLowerCase() === 'zero' ? `CC0 ${version}` : `CC ${kind.toUpperCase()} ${version}`;
}
