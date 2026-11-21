import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { baseDatabaseOptions } from './database.options.js';

// Used only by the TypeORM CLI, which runs against the compiled output in `dist`.
// Same precedence as the app: real env vars, then apps/api/.env, then the root .env.
for (const file of ['.env', '../../.env']) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}

// Only the database URL is needed here, so migrations do not require the OAuth or JWT secrets.
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run migrations');
}
const root = import.meta.dirname.replaceAll('\\', '/');

export default new DataSource({
  ...baseDatabaseOptions(databaseUrl),
  entities: [`${root}/../modules/**/*.entity.js`],
  migrations: [`${root}/migrations/*.js`],
});
