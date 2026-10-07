import type { Knex } from 'knex';
import { TABLE_DEFAULTS, dt, timestamps } from '../schema-helpers.js';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('abstracts', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.string('abstract_number', 30).nullable().unique(); // assigned on submission
    t.integer('user_id').unsigned().notNullable().references('users.id').onDelete('RESTRICT');
    t.enu('category', ['plenary', 'yia', 'oral', 'eposter', 'video']).notNullable();
    t.string('title', 300).notNullable().defaultTo('');
    t.string('institution', 250).notNullable().defaultTo('');
    t.json('keywords').notNullable();
    t.text('body').notNullable();
    t.integer('word_count').unsigned().notNullable().defaultTo(0);
    t.text('references_text').nullable();
    t.text('conflict_of_interest').nullable();
    t.tinyint('presenting_author_age').unsigned().nullable();
    t.string('sgei_membership_no', 60).nullable();
    t.string('video_url', 500).nullable();
    t.text('video_objectives').nullable();
    t.text('technique_justification').nullable();
    t.boolean('english_narration_confirmed').notNullable().defaultTo(false);
    t.boolean('declaration_accepted').notNullable().defaultTo(false);
    t.enu('status', ['draft', 'submitted', 'under_review', 'accepted', 'rejected', 'withdrawn'])
      .notNullable()
      .defaultTo('draft');
    dt(t, 'submitted_at').nullable();
    dt(t, 'reviewed_at').nullable();
    t.text('admin_notes').nullable();
    timestamps(knex, t);
    t.index(['user_id']);
    t.index(['status', 'submitted_at']);
    t.index(['category']);
  });

  await knex.schema.createTable('abstract_authors', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('abstract_id').unsigned().notNullable().references('abstracts.id').onDelete('CASCADE');
    t.enu('role', ['submitting', 'presenting', 'co_author']).notNullable();
    t.string('first_name', 80).notNullable();
    t.string('middle_name', 80).nullable();
    t.string('last_name', 80).notNullable();
    t.string('email', 254).nullable();
    t.string('institution', 250).nullable();
    t.integer('sort').notNullable().defaultTo(0);
    t.index(['abstract_id']);
  });

  await knex.schema.createTable('abstract_files', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('abstract_id').unsigned().notNullable().references('abstracts.id').onDelete('CASCADE');
    t.enu('kind', ['abstract_doc', 'manuscript_pdf', 'eposter_doc']).notNullable();
    t.string('original_name', 255).notNullable();
    t.string('mime_type', 120).notNullable();
    t.integer('size_bytes').unsigned().notNullable();
    t.string('storage_key', 255).notNullable();
    t.specificType('sha256', 'CHAR(64)').notNullable();
    timestamps(knex, t, false);
    t.unique(['abstract_id', 'kind']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('abstract_files');
  await knex.schema.dropTableIfExists('abstract_authors');
  await knex.schema.dropTableIfExists('abstracts');
}
