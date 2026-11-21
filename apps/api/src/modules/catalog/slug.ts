const MAX_SLUG_LENGTH = 200;

/** URL-safe, accent-free, lowercase slug: `"Café del Mar"` → `"cafe-del-mar"`. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
  return slug || 'untitled';
}

/** Appends `-2`, `-3`… until `isTaken` says the slug is free. */
export async function uniqueSlug(
  text: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(text);
  for (let attempt = 1; ; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
}
