import type { Knex } from 'knex';

/**
 * Abstracts are submitted from the public website without a delegate account.
 * The submitter's contact details are stored on the abstract instead of a user link.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('abstracts', (t) => {
    t.dropForeign(['user_id']);
    t.dropIndex(['user_id']);
  });
  await knex.schema.alterTable('abstracts', (t) => {
    t.dropColumn('user_id');
    t.string('contact_name', 150).notNullable().defaultTo('');
    t.string('contact_email', 254).notNullable().defaultTo('');
    t.string('contact_phone', 30).nullable();
    t.string('submitted_from_ip', 45).nullable(); // audit / abuse investigation only
    t.index(['contact_email']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('abstracts', (t) => {
    t.dropIndex(['contact_email']);
    t.dropColumn('contact_name');
    t.dropColumn('contact_email');
    t.dropColumn('contact_phone');
    t.dropColumn('submitted_from_ip');
    t.integer('user_id').unsigned().nullable().references('users.id').onDelete('RESTRICT');
    t.index(['user_id']);
  });
}
