import type { Knex } from 'knex';

/**
 * Intentionally empty. Catalogue tables were removed: categories, pricing periods, workshops and
 * accommodation now live in the static file shared/catalogue.json. Kept so the migration history
 * stays consistent – do not delete once it has been run.
 */
export async function up(_knex: Knex): Promise<void> {}
export async function down(_knex: Knex): Promise<void> {}
