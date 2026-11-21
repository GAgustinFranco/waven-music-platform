/// <reference types="vite/client" />
import { DataSource } from 'typeorm';
import { baseDatabaseOptions } from '../src/database/database.options.js';

type MigrationClass = new () => object;

/** Rebuilds the test database from the migrations once per e2e run. */
export default async function setup(): Promise<void> {
  const url =
    process.env['TEST_DATABASE_URL'] ?? 'postgres://waven:waven@localhost:5433/waven_test';
  const modules = import.meta.glob<Record<string, MigrationClass>>(
    '../src/database/migrations/*.ts',
    { eager: true },
  );
  const migrations = Object.values(modules).flatMap((module) => Object.values(module));

  const dataSource = new DataSource({ ...baseDatabaseOptions(url), migrations });
  await dataSource.initialize();
  try {
    await dataSource.dropDatabase();
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
