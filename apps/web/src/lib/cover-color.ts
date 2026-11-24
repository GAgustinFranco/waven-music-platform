import { type Hsl, hexToHsl, pickVibrantColor } from './palette';

/** Pixels sampled per side; enough to find the main hues, cheap to read. */
const SAMPLE = 32;

const cache = new Map<string, Promise<Hsl | null>>();

function sample(url: string): Promise<Hsl | null> {
  return new Promise((resolve) => {
    const image = new Image();
    // Covers on another origin (a CDN) need CORS; without it the canvas is tainted.
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
        resolve(pickVibrantColor(context.getImageData(0, 0, SAMPLE, SAMPLE).data));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * The vibrant color of a cover, read from its smallest rendition and cached per
 * URL. Falls back to the API's dominant color when the image cannot be read.
 */
export async function coverColor(
  url: string | null | undefined,
  fallbackHex: string | null | undefined,
): Promise<Hsl | null> {
  let read: Hsl | null = null;
  if (url) {
    let pending = cache.get(url);
    if (!pending) {
      pending = sample(url);
      cache.set(url, pending);
    }
    read = await pending;
  }
  return read ?? (fallbackHex ? hexToHsl(fallbackHex) : null);
}
