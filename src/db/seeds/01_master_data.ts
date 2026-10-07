import type { Knex } from 'knex';

/**
 * Intentionally empty – master data (categories, prices, workshops, accommodation) now lives in the
 * static file shared/catalogue.json, not in the database. This file can be deleted.
 */
export async function seed(_knex: Knex): Promise<void> {}
