import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation.js';
import { baseDatabaseOptions } from './database.options.js';

// Used only by the TypeORM CLI, which runs against the compiled output in `dist`.
// Same precedence as the app: real env vars, then apps/api/.env, then the root .env.
for (const file of ['.env', '../../.env']) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}

const env = validateEnv(process.env);
const root = import.meta.dirname.replaceAll('\\', '/');

export default new DataSource({
  ...baseDatabaseOptions(env.DATABASE_URL),
  entities: [`${root}/../modules/**/*.entity.js`],
  migrations: [`${root}/migrations/*.js`],
});
