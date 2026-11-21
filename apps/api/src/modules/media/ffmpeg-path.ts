import { createRequire } from 'node:module';

/**
 * Path of the binary bundled by `ffmpeg-static`. The package is CommonJS and
 * exports the path itself, which its `export default` typings misdescribe
 * under NodeNext, so it is loaded with `require`.
 */
export const bundledFfmpegPath = createRequire(import.meta.url)('ffmpeg-static') as string | null;
