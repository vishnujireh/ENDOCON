import type { Knex } from 'knex';
import { TABLE_DEFAULTS, dt, money, timestamps } from '../schema-helpers.js';

const ITEM_STATUS = ['active', 'refunded', 'cancelled'];

/** Snapshot of what was charged for a line. Never read from master tables for history. */
function chargedAmounts(t: Knex.CreateTableBuilder): void {
  t.string('description', 255).notNullable();
  t.string('pricing_period_code', 20).nullable();
  t.specificType('original_currency', 'CHAR(3)').notNullable();
  money(t, 'original_unit_amount_minor');
  t.decimal('fx_rate', 12, 6).nullable(); // set when a USD price was converted to INR
  money(t, 'unit_amount_minor');
  t.integer('quantity').unsigned().notNullable().defaultTo(1);
  money(t, 'amount_minor'); // taxable value
  t.integer('gst_rate_bps').unsigned().notNullable();
  money(t, 'gst_minor');
  money(t, 'total_minor');
}

export async function up(knex: Knex): Promise<void> {
  /** Parent registration / order. Exactly one per user for the conference lifecycle. */
  await knex.schema.createTable('orders', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    // ENDO-0001; assigned (gap-free) when the first payment on the order is verified.
    t.string('order_number', 30).nullable().unique();
    t.integer('user_id').unsigned().notNullable().unique().references('users.id').onDelete('RESTRICT');
    t.enu('status', ['open', 'active', 'cancelled']).notNullable().defaultTo('open');
    t.specificType('currency', 'CHAR(3)').notNullable().defaultTo('INR');
    dt(t, 'confirmed_at').nullable();
    timestamps(knex, t);
    t.index(['status']);
    t.index(['created_at']);
  });

  /** One row per checkout / gateway order. Each has its own gateway identifiers. */
  await knex.schema.createTable('payments', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('order_id').unsigned().notNullable().references('orders.id').onDelete('RESTRICT');
    t.integer('user_id').unsigned().notNullable().references('users.id').onDelete('RESTRICT');
    t.string('gateway', 20).notNullable();
    t.string('gateway_order_id', 64).nullable().unique();
    t.string('gateway_payment_id', 64).nullable().unique();
    t.string('gateway_signature', 255).nullable();
    t.string('method', 30).nullable();
    money(t, 'subtotal_minor');
    money(t, 'gst_minor');
    money(t, 'total_minor');
    money(t, 'refunded_minor').defaultTo(0);
    t.specificType('currency', 'CHAR(3)').notNullable();
    t.enu('status', [
      'created', // gateway order created, awaiting payment
      'pending', // gateway reports authorised / in progress
      'success', // verified server-side and settled into entitlements
      'failed',
      'cancelled', // user dismissed / superseded by a new cart
      'expired',
      'conflict', // money captured but items could not be granted (e.g. duplicate) -> needs refund
      'refunded',
      'partially_refunded',
    ]).notNullable().defaultTo('created');
    t.enu('purpose', ['registration', 'add_on']).notNullable();
    t.specificType('cart_hash', 'CHAR(64)').notNullable();
    t.string('idempotency_key', 80).nullable();
    t.string('failure_code', 80).nullable();
    t.string('failure_reason', 500).nullable();
    dt(t, 'paid_at').nullable();
    dt(t, 'last_checked_at').nullable();
    timestamps(knex, t);
    t.unique(['user_id', 'idempotency_key']);
    t.index(['order_id']);
    t.index(['status', 'created_at']);
  });

  await knex.schema.createTable('payment_items', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('payment_id').unsigned().notNullable().references('payments.id').onDelete('CASCADE');
    t.enu('item_type', ['conference', 'workshop', 'accommodation', 'accompanying']).notNullable();
    // What was bought: the code from the static catalogue (shared/catalogue.json) + a name snapshot.
    t.string('item_code', 40).nullable();
    t.string('item_name', 200).nullable();
    t.enu('region', ['national', 'international']).nullable(); // conference / accompanying
    t.enu('occupancy', ['single', 'twin_share']).nullable(); // accommodation
    t.date('check_in').nullable();
    t.date('check_out').nullable();
    t.string('guest_title', 10).nullable();
    t.string('guest_name', 150).nullable();
    chargedAmounts(t);
    timestamps(knex, t, false);
    t.index(['payment_id']);
  });

  // ---- Entitlements: rows exist only for verified payments (or admin complimentary grants). ----

  await knex.schema.createTable('conference_registrations', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('order_id').unsigned().notNullable().unique().references('orders.id');
    t.integer('user_id').unsigned().notNullable().unique().references('users.id'); // one conference per user
    t.string('category_code', 40).notNullable(); // catalogue code
    t.string('category_name', 100).notNullable(); // snapshot
    t.enu('region', ['national', 'international']).notNullable();
    t.integer('payment_id').unsigned().nullable().references('payments.id');
    t.integer('payment_item_id').unsigned().nullable().unique().references('payment_items.id');
    t.enu('source', ['payment', 'complimentary']).notNullable().defaultTo('payment');
    chargedAmounts(t);
    t.enu('status', ITEM_STATUS).notNullable().defaultTo('active');
    timestamps(knex, t);
  });

  await knex.schema.createTable('order_workshops', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('order_id').unsigned().notNullable().references('orders.id');
    t.integer('user_id').unsigned().notNullable().references('users.id');
    t.string('workshop_code', 40).notNullable(); // catalogue code
    t.string('workshop_name', 200).notNullable(); // snapshot
    t.integer('payment_id').unsigned().nullable().references('payments.id');
    t.integer('payment_item_id').unsigned().nullable().unique().references('payment_items.id');
    chargedAmounts(t);
    t.enu('status', ITEM_STATUS).notNullable().defaultTo('active');
    timestamps(knex, t);
    t.unique(['order_id', 'workshop_code']); // the same workshop can never be purchased twice
    t.index(['workshop_code', 'status']);
  });

  await knex.schema.createTable('order_accommodations', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('order_id').unsigned().notNullable().unique().references('orders.id'); // one per order
    t.integer('user_id').unsigned().notNullable().references('users.id');
    t.string('accommodation_code', 40).notNullable(); // catalogue code
    t.string('hotel_name', 150).notNullable(); // snapshot
    t.enu('occupancy', ['single', 'twin_share']).notNullable();
    t.integer('payment_id').unsigned().nullable().references('payments.id');
    t.integer('payment_item_id').unsigned().nullable().unique().references('payment_items.id');
    t.date('check_in').notNullable();
    t.date('check_out').notNullable();
    chargedAmounts(t);
    t.enu('status', ITEM_STATUS).notNullable().defaultTo('active');
    timestamps(knex, t);
  });

  await knex.schema.createTable('order_accompanying_persons', (t) => {
    TABLE_DEFAULTS(t);
    t.increments('id').primary();
    t.integer('order_id').unsigned().notNullable().references('orders.id');
    t.integer('user_id').unsigned().notNullable().references('users.id');
    t.string('category_code', 40).notNullable(); // catalogue code (accompanying national / international)
    t.string('category_name', 100).notNullable(); // snapshot
    t.integer('payment_id').unsigned().nullable().references('payments.id');
    t.integer('payment_item_id').unsigned().nullable().unique().references('payment_items.id');
    t.string('title', 10).nullable();
    t.string('full_name', 150).notNullable();
    chargedAmounts(t);
    t.enu('status', ITEM_STATUS).notNullable().defaultTo('active');
    timestamps(knex, t);
    t.index(['order_id']);
  });

  /** Raw gateway events (webhooks, verify callbacks, reconciliation) for audit + dedupe. */
  await knex.schema.createTable('payment_events', (t) => {
    TABLE_DEFAULTS(t);
    t.bigIncrements('id').primary();
    t.string('gateway', 20).notNullable();
    t.enu('source', ['webhook', 'verify', 'reconcile', 'checkout', 'client']).notNullable();
    t.string('gateway_event_id', 100).nullable().unique();
    t.string('event_type', 80).notNullable();
    t.string('gateway_order_id', 64).nullable();
    t.string('gateway_payment_id', 64).nullable();
    t.integer('payment_id').unsigned().nullable().references('payments.id').onDelete('SET NULL');
    t.boolean('signature_valid').nullable();
    t.json('payload').nullable();
    dt(t, 'processed_at').nullable();
    t.string('error', 500).nullable();
    timestamps(knex, t, false);
    t.index(['gateway_order_id']);
    t.index(['payment_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  for (const table of [
    'payment_events',
    'order_accompanying_persons',
    'order_accommodations',
    'order_workshops',
    'conference_registrations',
    'payment_items',
    'payments',
    'orders',
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
}
