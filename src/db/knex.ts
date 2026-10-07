import knexFactory, { type Knex } from 'knex';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const isCompiled = here.includes(`${path.sep}dist${path.sep}`) || here.endsWith(`${path.sep}dist`);
const ext = isCompiled ? 'js' : 'ts';

/**
 * Migrations are recorded WITHOUT their extension so the same database works with the
 * TypeScript sources (dev, tsx) and the compiled JavaScript (production, dist/).
 */
class ExtensionlessMigrationSource {
  constructor(private readonly dir: string) {}
  async getMigrations(): Promise<string[]> {
    return readdirSync(this.dir)
      .filter((f) => f.endsWith(`.${ext}`) && !f.endsWith('.d.ts'))
      .sort();
  }
  getMigrationName(file: string): string {
    return file.replace(/\.(ts|js)$/, '');
  }
  async getMigration(file: string) {
    return import(pathToFileURL(path.join(this.dir, file)).href);
  }
}

export function buildKnexConfig(overrides: Partial<{ database: string }> = {}): Knex.Config {
  return {
    client: 'mysql2',
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: overrides.database ?? env.DB_NAME,
      charset: 'utf8mb4',
      // All DATETIME columns are stored in UTC.
      timezone: 'Z',
      supportBigNumbers: true,
      bigNumberStrings: false,
      decimalNumbers: true,
      // TINYINT(1) -> boolean
      typeCast(field: { type: string; length: number; string(): string | null }, next: () => unknown) {
        if (field.type === 'TINY' && field.length === 1) {
          const v = field.string();
          return v === null ? null : v === '1';
        }
        return next();
      },
    },
    pool: {
      min: 0,
      max: env.DB_POOL_MAX,
      afterCreate(conn: { query: (sql: string, cb: (err: Error | null) => void) => void }, done: (err: Error | null, conn: unknown) => void) {
        conn.query("SET time_zone = '+00:00'", (err) => done(err, conn));
      },
    },
    migrations: {
      tableName: 'knex_migrations',
      migrationSource: new ExtensionlessMigrationSource(path.join(here, 'migrations')),
    },
    seeds: {
      directory: path.join(here, 'seeds'),
      loadExtensions: [`.${ext}`],
    },
  };
}

export const db: Knex = knexFactory(buildKnexConfig());

export type Db = Knex;
export type Trx = Knex.Transaction;
/** Either the root connection or an open transaction. */
export type DbOrTrx = Knex | Knex.Transaction;
