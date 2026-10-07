import type { Knex } from 'knex';
import { TABLE_DEFAULTS, dt, timestamps } from '../schema-helpers.js';

/**
 * Online Abstract Review Module (judges / reviewers).
 *
 *   abstracts ─┬─ abstract_assignments (one row per abstract + reviewer; soft-removed on reassignment)
 *              │        └─ judge_reviews (one per assignment: draft → submitted; COI or scored)
 *              │                 └─ judge_review_scores (one per criterion, with a snapshot of its name / max)
 *   reviewers ─┘   reviewer_otps (hashed one-time codes)   reviewer_sessions (hashed session tokens)
 *   review_criteria (configurable scoring criteria – none are seeded)
 *
 * Reviewers are NOT user accounts: they log in with an emailed OTP and only ever see their own
 * assignments. The existing `abstract_reviews` table (admin Accept / Reject / Duplicate decisions)
 * is untouched – judge reviews live in `judge_reviews`.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('reviewers', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.string('reviewer_code', 20).notNullable().unique();
    t.string('name', 150).notNullable();
    t.string('email', 254).notNullable().unique();
    t.enu('status', ['active', 'inactive']).notNullable().defaultTo('active');
    t.integer('created_by').unsigned().nullable().references('users.id').onDelete('SET NULL');
    timestamps(knex, t);
  });

  await knex.schema.createTable('reviewer_otps', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('reviewer_id').unsigned().notNullable().references('reviewers.id').onDelete('CASCADE');
    t.specificType('otp_hash', 'CHAR(64)').notNullable();
    dt(t, 'expires_at').notNullable();
    dt(t, 'verified_at').nullable();
    dt(t, 'invalidated_at').nullable(); // superseded by a newer code or too many wrong attempts
    t.tinyint('attempt_count').unsigned().notNullable().defaultTo(0);
    t.string('requested_ip', 45).nullable();
    timestamps(knex, t, false);
    t.index(['reviewer_id', 'created_at']);
  });

  await knex.schema.createTable('reviewer_sessions', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('reviewer_id').unsigned().notNullable().references('reviewers.id').onDelete('CASCADE');
    t.specificType('token_hash', 'CHAR(64)').notNullable().unique();
    t.string('csrf_token', 100).notNullable();
    t.string('ip', 45).nullable();
    t.string('user_agent', 255).nullable();
    dt(t, 'last_seen_at').notNullable();
    dt(t, 'expires_at').notNullable();
    dt(t, 'revoked_at').nullable();
    timestamps(knex, t, false);
    t.index(['reviewer_id']);
  });

  await knex.schema.createTable('review_criteria', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.string('name', 150).notNullable();
    t.text('description').nullable();
    t.integer('max_score').unsigned().notNullable();
    t.integer('display_order').notNullable().defaultTo(0);
    t.enu('status', ['active', 'inactive']).notNullable().defaultTo('active');
    timestamps(knex, t);
  });

  await knex.schema.createTable('abstract_assignments', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('abstract_id').unsigned().notNullable().references('abstracts.id').onDelete('RESTRICT');
    t.integer('reviewer_id').unsigned().notNullable().references('reviewers.id').onDelete('RESTRICT');
    t.enu('status', ['pending', 'completed', 'coi']).notNullable().defaultTo('pending');
    t.integer('assigned_by').unsigned().nullable().references('users.id').onDelete('SET NULL');
    dt(t, 'assigned_at').notNullable();
    // Reassignment never deletes: the old assignment is marked removed (and keeps its review).
    dt(t, 'removed_at').nullable();
    t.integer('removed_by').unsigned().nullable().references('users.id').onDelete('SET NULL');
    t.integer('replaced_by_reviewer_id').unsigned().nullable().references('reviewers.id').onDelete('SET NULL');
    timestamps(knex, t);
    t.unique(['abstract_id', 'reviewer_id']); // the same reviewer cannot be assigned twice
    t.index(['reviewer_id', 'removed_at']);
  });

  await knex.schema.createTable('judge_reviews', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    // One review per assignment – the database blocks a second one.
    t.integer('assignment_id').unsigned().notNullable().unique().references('abstract_assignments.id').onDelete('RESTRICT');
    t.integer('abstract_id').unsigned().notNullable().references('abstracts.id').onDelete('RESTRICT');
    t.integer('reviewer_id').unsigned().notNullable().references('reviewers.id').onDelete('RESTRICT');
    t.enu('state', ['draft', 'submitted']).notNullable().defaultTo('draft');
    t.boolean('coi').notNullable().defaultTo(false);
    t.text('coi_reason').nullable();
    t.text('comments').nullable();
    t.integer('total_score').unsigned().nullable(); // null for COI / when no criteria are configured
    t.integer('max_total').unsigned().nullable();
    t.integer('abstract_revision').unsigned().notNullable(); // the revision that was reviewed
    dt(t, 'submitted_at').nullable();
    timestamps(knex, t);
    t.index(['abstract_id']);
  });

  await knex.schema.createTable('judge_review_scores', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('review_id').unsigned().notNullable().references('judge_reviews.id').onDelete('CASCADE');
    t.integer('criterion_id').unsigned().notNullable().references('review_criteria.id').onDelete('RESTRICT');
    t.string('criterion_name', 150).notNullable(); // snapshot – later edits to the criterion do not change past reviews
    t.integer('max_score').unsigned().notNullable();
    t.integer('score').unsigned().notNullable();
    t.unique(['review_id', 'criterion_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('judge_review_scores');
  await knex.schema.dropTableIfExists('judge_reviews');
  await knex.schema.dropTableIfExists('abstract_assignments');
  await knex.schema.dropTableIfExists('review_criteria');
  await knex.schema.dropTableIfExists('reviewer_sessions');
  await knex.schema.dropTableIfExists('reviewer_otps');
  await knex.schema.dropTableIfExists('reviewers');
  await knex('sequences').where({ name: 'reviewer_code' }).del();
}
