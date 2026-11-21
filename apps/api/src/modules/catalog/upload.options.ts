import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';

const MB = 1024 * 1024;

/** SPEC §6.10: audio up to 100 MB, streamed to a temp file instead of memory. */
export const AUDIO_UPLOAD: MulterOptions = {
  dest: join(tmpdir(), 'waven-uploads'),
  limits: { fileSize: 100 * MB, files: 1, fields: 0 },
};

/** SPEC §6.10: covers and artist images up to 5 MB, kept in memory for sharp. */
export const IMAGE_UPLOAD: MulterOptions = {
  limits: { fileSize: 5 * MB, files: 1, fields: 0 },
};
