import type { Knex } from 'knex';
import { TABLE_DEFAULTS, dt, money, timestamps } from '../schema-helpers.js';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('invoices', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.string('invoice_number', 40).notNullable().unique(); // consecutive per financial year
    t.string('financial_year', 9).notNullable();
    t.integer('payment_id').unsigned().notNullable().unique().references('payments.id');
    t.integer('order_id').unsigned().notNullable().references('orders.id');
    t.integer('user_id').unsigned().notNullable().references('users.id');
    t.json('billed_to').notNullable(); // snapshot of participant details at invoice time
    t.json('lines').notNullable(); // snapshot of invoice lines
    money(t, 'subtotal_minor');
    money(t, 'cgst_minor');
    money(t, 'sgst_minor');
    money(t, 'igst_minor');
    money(t, 'gst_minor');
    money(t, 'total_minor');
    t.specificType('currency', 'CHAR(3)').notNullable();
    t.string('file_key', 255).nullable();
    dt(t, 'generated_at').nullable();
    timestamps(knex, t);
    t.index(['order_id']);
  });

  /**
   * Transactional outbox: emails are written in the same DB transaction as the business
   * event, then delivered (with retries) by the email worker.
   */
  await knex.schema.createTable('email_outbox', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.string('to_email', 254).notNullable();
    t.string('template', 60).notNullable();
    t.json('payload').notNullable();
    t.enu('status', ['pending', 'sending', 'sent', 'failed']).notNullable().defaultTo('pending');
    t.integer('attempts').unsigned().notNullable().defaultTo(0);
    t.string('last_error', 1000).nullable();
    dt(t, 'send_after').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    dt(t, 'sent_at').nullable();
    t.string('related_type', 40).nullable();
    t.string('related_id', 40).nullable();
    t.string('dedupe_key', 150).nullable().unique();
    timestamps(knex, t);
    t.index(['status', 'send_after']);
    t.index(['related_type', 'related_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('email_outbox');
  await knex.schema.dropTableIfExists('invoices');
}
