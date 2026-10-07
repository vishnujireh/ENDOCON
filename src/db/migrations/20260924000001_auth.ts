import type { Knex } from 'knex';
import { TABLE_DEFAULTS, dt, timestamps } from '../schema-helpers.js';

export async function up(knex: Knex): Promise<void> {
  // Gap-free counters for order / invoice / abstract numbers (row-locked in transactions).
  await knex.schema.createTable('sequences', (t) => {
    TABLE_DEFAULTS(t);
    t.string('name', 64).primary();
    t.integer('value').unsigned().notNullable().defaultTo(0);
  });

  await knex.schema.createTable('users', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.string('email', 254).notNullable().unique(); // stored lower-cased
    t.string('password_hash', 255).notNullable();
    t.enu('role', ['participant', 'admin']).notNullable().defaultTo('participant');
    t.enu('status', ['active', 'disabled']).notNullable().defaultTo('active');
    dt(t, 'last_login_at').nullable();
    dt(t, 'password_changed_at').nullable();
    timestamps(knex, t);
    t.index(['role']);
  });

  await knex.schema.createTable('user_profiles', (t) => {
    TABLE_DEFAULTS(t);
    t.integer('user_id').unsigned().primary().references('users.id').onDelete('CASCADE');
    // (1) Personal information
    t.string('title', 10).nullable();
    t.string('full_name', 150).notNullable();
    t.tinyint('age').unsigned().nullable();
    t.string('gender', 30).nullable();
    // (2) Professional details
    t.string('designation', 150).nullable();
    t.string('organization', 200).nullable();
    t.string('mci_state_code', 60).nullable();
    t.string('mci_reg_no', 60).nullable();
    t.string('membership_type', 20).nullable(); // sgei_member | non_member
    t.string('membership_no', 60).nullable();
    // (3) Contact & address
    t.string('phone_country_code', 6).nullable();
    t.string('phone_number', 20).nullable();
    t.string('address', 500).nullable();
    t.string('city', 100).nullable();
    t.string('state', 100).nullable();
    t.string('country', 100).nullable();
    t.string('pin_code', 12).nullable();
    t.string('dietary_preference', 30).nullable();
    dt(t, 'completed_at').nullable();
    timestamps(knex, t);
    t.index(['full_name']);
    t.index(['organization']);
  });

  await knex.schema.createTable('sessions', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    t.specificType('token_hash', 'CHAR(64)').notNullable().unique();
    t.string('csrf_token', 64).notNullable();
    t.string('ip', 45).nullable();
    t.string('user_agent', 255).nullable();
    dt(t, 'last_seen_at').notNullable();
    dt(t, 'expires_at').notNullable();
    dt(t, 'absolute_expires_at').notNullable();
    dt(t, 'revoked_at').nullable();
    timestamps(knex, t, false);
    t.index(['user_id']);
    t.index(['expires_at']);
  });

  await knex.schema.createTable('password_reset_tokens', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    t.specificType('token_hash', 'CHAR(64)').notNullable().unique();
    dt(t, 'expires_at').notNullable();
    dt(t, 'used_at').nullable();
    t.string('requested_ip', 45).nullable();
    timestamps(knex, t, false);
    t.index(['user_id']);
  });

  await knex.schema.createTable('audit_logs', (t) => {
    TABLE_DEFAULTS(t);
    t.bigIncrements('id').primary();
    t.integer('actor_user_id').unsigned().nullable().references('users.id').onDelete('SET NULL');
    t.string('action', 80).notNullable();
    t.string('entity_type', 40).notNullable();
    t.string('entity_id', 40).notNullable();
    t.json('before').nullable();
    t.json('after').nullable();
    t.string('ip', 45).nullable();
    t.string('user_agent', 255).nullable();
    timestamps(knex, t, false);
    t.index(['entity_type', 'entity_id']);
    t.index(['actor_user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('password_reset_tokens');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('user_profiles');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('sequences');
}
