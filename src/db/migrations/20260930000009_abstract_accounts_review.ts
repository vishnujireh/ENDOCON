import type { Knex } from 'knex';
import { TABLE_DEFAULTS, dt, timestamps } from '../schema-helpers.js';

/**
 * Abstracts now require a delegate account and go through an admin review loop:
 *
 *   submitted ─┬─► accepted  (final for the author)
 *              ├─► rejected  ─┐  admin comment required; the author revises the SAME abstract
 *              └─► duplicate ─┤  (same number) and resubmits while the submission window is open
 *   resubmitted ◄─────────────┘  → back to the admin
 *
 * - The abstracts submitted without an account during testing are deleted (confirmed by the client).
 *   Their uploaded files are left in storage/abstracts/ and can be removed by hand.
 * - `abstract_reviews` keeps every admin decision with its comment (shown to the author).
 * - `abstract_versions` keeps a snapshot of every submitted revision; `abstract_files.revision`
 *   keeps the files of earlier revisions downloadable.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Remove the test data (children first) and restart abstract numbering at 0001.
  await knex('abstract_files').del();
  await knex('abstract_authors').del();
  await knex('abstracts').del();
  await knex('sequences').where({ name: 'abstract_number' }).del();

  // 2. Every abstract belongs to a user account; the new status set; the latest admin comment.
  await knex.schema.alterTable('abstracts', (t) => {
    t.integer('user_id').unsigned().notNullable().references('users.id').onDelete('RESTRICT');
    t.integer('revision').unsigned().notNullable().defaultTo(1);
    t.text('review_comment').nullable(); // latest Reject / Duplicate comment – shown to the author
    dt(t, 'resubmitted_at').nullable();
    t.dropColumn('admin_notes');
    t.dropColumn('submitted_from_ip');
    t.index(['user_id']);
  });
  await knex.raw(
    "ALTER TABLE abstracts MODIFY status ENUM('submitted','resubmitted','accepted','rejected','duplicate') NOT NULL DEFAULT 'submitted'",
  );

  // 3. Files are kept per revision (earlier revisions stay downloadable for the reviewers).
  await knex.schema.alterTable('abstract_files', (t) => {
    t.integer('revision').unsigned().notNullable().defaultTo(1);
  });
  await knex.schema.alterTable('abstract_files', (t) => {
    t.index(['abstract_id'], 'abstract_files_abstract_id_idx'); // keeps the FK indexed while the unique key changes
    t.dropUnique(['abstract_id', 'kind']);
    t.unique(['abstract_id', 'kind', 'revision']);
  });

  // 4. Review history: one row per admin decision.
  await knex.schema.createTable('abstract_reviews', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('abstract_id').unsigned().notNullable().references('abstracts.id').onDelete('CASCADE');
    t.integer('revision').unsigned().notNullable();
    t.enu('decision', ['accepted', 'rejected', 'duplicate']).notNullable();
    t.text('comment').nullable();
    t.integer('reviewer_id').unsigned().nullable().references('users.id').onDelete('SET NULL');
    timestamps(knex, t, false);
    t.index(['abstract_id', 'created_at']);
  });

  // 5. Snapshot of each submitted revision (what the reviewers saw).
  await knex.schema.createTable('abstract_versions', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('abstract_id').unsigned().notNullable().references('abstracts.id').onDelete('CASCADE');
    t.integer('revision').unsigned().notNullable();
    t.json('snapshot').notNullable();
    dt(t, 'submitted_at').notNullable();
    timestamps(knex, t, false);
    t.unique(['abstract_id', 'revision']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('abstract_versions');
  await knex.schema.dropTableIfExists('abstract_reviews');
  await knex('abstract_files').del();
  await knex('abstract_authors').del();
  await knex('abstracts').del();
  await knex.schema.alterTable('abstract_files', (t) => {
    t.dropUnique(['abstract_id', 'kind', 'revision']);
    t.unique(['abstract_id', 'kind']);
  });
  await knex.schema.alterTable('abstract_files', (t) => {
    t.dropIndex(['abstract_id'], 'abstract_files_abstract_id_idx');
    t.dropColumn('revision');
  });
  await knex.raw(
    "ALTER TABLE abstracts MODIFY status ENUM('draft','submitted','under_review','accepted','rejected','withdrawn') NOT NULL DEFAULT 'draft'",
  );
  await knex.schema.alterTable('abstracts', (t) => {
    t.dropForeign(['user_id']);
    t.dropIndex(['user_id']);
  });
  await knex.schema.alterTable('abstracts', (t) => {
    t.dropColumn('user_id');
    t.dropColumn('revision');
    t.dropColumn('review_comment');
    t.dropColumn('resubmitted_at');
    t.text('admin_notes').nullable();
    t.string('submitted_from_ip', 45).nullable();
  });
}
