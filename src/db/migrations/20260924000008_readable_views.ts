import type { Knex } from 'knex';

/**
 * Read-only views for people looking at the database directly (MySQL Workbench, reports).
 *
 * Money is STORED in paise (`*_minor`, e.g. 2537000 = ₹25,370.00) so all calculations are exact
 * integers. These views show the same rows in rupees with plain column names, plus the order
 * number and participant – nothing is stored twice and the application does not use them.
 *
 *   v_payments        one row per payment attempt
 *   v_payment_items   what each payment charged, line by line
 *   v_invoices        issued invoices with the GST split
 */
const rupees = (col: string, as: string) => `CAST(${col} / 100 AS DECIMAL(14,2)) AS ${as}`;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE VIEW v_payments AS
    SELECT
      p.id                    AS payment_id,
      o.order_number          AS order_number,
      TRIM(CONCAT_WS(' ', up.title, up.full_name)) AS participant,
      u.email                 AS email,
      p.purpose               AS purpose,
      p.status                AS status,
      p.method                AS method,
      p.currency              AS currency,
      ${rupees('p.subtotal_minor', 'price_inr')},
      ${rupees('p.gst_minor', 'gst_inr')},
      ${rupees('p.total_minor', 'total_inr')},
      ${rupees('p.refunded_minor', 'refunded_inr')},
      p.gateway               AS gateway,
      p.gateway_payment_id    AS gateway_payment_id,
      p.gateway_order_id      AS gateway_order_id,
      p.failure_reason        AS failure_reason,
      p.paid_at               AS paid_at,
      p.created_at            AS created_at
    FROM payments p
    JOIN orders o        ON o.id = p.order_id
    JOIN users u         ON u.id = p.user_id
    LEFT JOIN user_profiles up ON up.user_id = p.user_id
  `);

  await knex.raw(`
    CREATE OR REPLACE VIEW v_payment_items AS
    SELECT
      pi.id                   AS item_id,
      pi.payment_id           AS payment_id,
      o.order_number          AS order_number,
      p.status                AS payment_status,
      pi.item_type            AS item_type,
      pi.description          AS description,
      pi.pricing_period_code  AS pricing_period,
      pi.quantity             AS quantity,
      ${rupees('pi.unit_amount_minor', 'unit_price_inr')},
      ${rupees('pi.amount_minor', 'price_inr')},
      CAST(pi.gst_rate_bps / 100 AS DECIMAL(5,2)) AS gst_percent,
      ${rupees('pi.gst_minor', 'gst_inr')},
      ${rupees('pi.total_minor', 'total_inr')},
      pi.original_currency    AS original_currency,
      ${rupees('pi.original_unit_amount_minor', 'original_unit_price')},
      pi.fx_rate              AS fx_rate,
      pi.guest_name           AS guest_name,
      pi.check_in             AS check_in,
      pi.check_out            AS check_out
    FROM payment_items pi
    JOIN payments p ON p.id = pi.payment_id
    JOIN orders o   ON o.id = p.order_id
  `);

  await knex.raw(`
    CREATE OR REPLACE VIEW v_invoices AS
    SELECT
      i.invoice_number        AS invoice_number,
      i.financial_year        AS financial_year,
      o.order_number          AS order_number,
      TRIM(CONCAT_WS(' ', up.title, up.full_name)) AS participant,
      u.email                 AS email,
      i.currency              AS currency,
      ${rupees('i.subtotal_minor', 'price_inr')},
      ${rupees('i.cgst_minor', 'cgst_inr')},
      ${rupees('i.sgst_minor', 'sgst_inr')},
      ${rupees('i.igst_minor', 'igst_inr')},
      ${rupees('i.gst_minor', 'gst_inr')},
      ${rupees('i.total_minor', 'total_inr')},
      p.gateway_payment_id    AS gateway_payment_id,
      i.generated_at          AS generated_at,
      i.created_at            AS created_at
    FROM invoices i
    JOIN orders o   ON o.id = i.order_id
    JOIN users u    ON u.id = i.user_id
    JOIN payments p ON p.id = i.payment_id
    LEFT JOIN user_profiles up ON up.user_id = i.user_id
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP VIEW IF EXISTS v_invoices');
  await knex.raw('DROP VIEW IF EXISTS v_payment_items');
  await knex.raw('DROP VIEW IF EXISTS v_payments');
}
