import { type DataSourceOptions } from 'typeorm';

/** Options shared by the Nest app and the TypeORM CLI. The schema only changes through migrations. */
export function baseDatabaseOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'migrations',
    // gen_random_uuid() is built into Postgres 13+, unlike uuid-ossp.
    uuidExtension: 'pgcrypto',
  };
}
