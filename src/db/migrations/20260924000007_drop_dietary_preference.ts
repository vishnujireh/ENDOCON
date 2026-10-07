import type { Knex } from 'knex';

/** Dietary preference is no longer collected (removed from the form, API, admin view and CSV). */
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('user_profiles', 'dietary_preference')) {
    await knex.schema.alterTable('user_profiles', (t) => {
      t.dropColumn('dietary_preference');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_profiles', (t) => {
    t.string('dietary_preference', 30).nullable();
  });
}
