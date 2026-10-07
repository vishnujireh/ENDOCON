import type { Knex } from 'knex';

/**
 * Abstract form additions: Department, Corresponding author (name) and Track / Theme.
 * Nullable in the database (abstracts submitted before this change have none); required on the form.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('abstracts', (t) => {
    t.string('department', 200).nullable();
    t.string('corresponding_author', 200).nullable();
    t.string('track', 100).nullable();
    t.index(['track']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('abstracts', (t) => {
    t.dropIndex(['track']);
    t.dropColumn('department');
    t.dropColumn('corresponding_author');
    t.dropColumn('track');
  });
}
