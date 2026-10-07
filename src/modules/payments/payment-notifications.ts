import { env } from '../../config/env.js';
import type { DbOrTrx } from '../../db/knex.js';
import { formatEventDateTime } from '../../lib/time.js';
import { gstRatePercent } from '../catalogue/pricing.service.js';
import { enqueueEmail } from '../email/outbox.js';
import type { PaymentEmailPayload } from '../email/templates.js';
import { loadEntitlements } from '../registration/entitlements.repository.js';

export async function buildPaymentEmailPayload(conn: DbOrTrx, paymentId: number): Promise<PaymentEmailPayload> {
  const p = await conn('payments as p')
    .join('orders as o', 'o.id', 'p.order_id')
    .join('users as u', 'u.id', 'p.user_id')
    .leftJoin('user_profiles as pr', 'pr.user_id', 'p.user_id')
    .leftJoin('invoices as i', 'i.payment_id', 'p.id')
    .where('p.id', paymentId)
    .first('p.*', 'o.order_number', 'u.email', 'pr.title', 'pr.full_name', 'pr.phone_country_code', 'pr.phone_number', 'i.id as invoice_id');
  const items = await conn('payment_items').where({ payment_id: paymentId }).orderBy('id');
  const held = await loadEntitlements(conn, p.user_id);

  return {
    paymentId,
    invoiceId: p.invoice_id ?? null,
    title: p.title ?? null,
    fullName: p.full_name ?? 'Participant',
    email: p.email,
    phone: p.phone_number ? `${p.phone_country_code ?? ''} ${p.phone_number}`.trim() : null,
    orderNumber: p.order_number ?? '',
    gatewayPaymentId: p.gateway_payment_id ?? '',
    paidAt: formatEventDateTime(p.paid_at),
    currency: p.currency,
    lines: items.map((i) => ({
      description: i.description,
      amountMinor: Number(i.amount_minor),
      gstMinor: Number(i.gst_minor),
      totalMinor: Number(i.total_minor),
    })),
    subtotalMinor: Number(p.subtotal_minor),
    gstMinor: Number(p.gst_minor),
    totalMinor: Number(p.total_minor),
    gstRatePercent: gstRatePercent(),
    registrationSummary: {
      conference: held.conference ? `${held.conference.categoryName}` : null,
      workshops: held.workshops.map((w) => w.name),
      accommodation: held.accommodation ? held.accommodation.description.replace(/^Accommodation – /, '') : null,
      accompanying: held.accompanying.map((a) => [a.title, a.fullName].filter(Boolean).join(' ')),
    },
  };
}

/** Queue participant confirmation + admin notifications for a settled payment (idempotent). */
export async function queuePaymentSuccessEmails(conn: DbOrTrx, paymentId: number): Promise<void> {
  const payload = await buildPaymentEmailPayload(conn, paymentId);
  await enqueueEmail(conn, payload.email, 'registration_confirmation', payload, {
    related: { type: 'payment', id: paymentId },
    dedupeKey: `confirmation:payment:${paymentId}`,
  });
  for (const admin of env.adminNotificationEmails) {
    await enqueueEmail(conn, admin, 'admin_payment_notification', payload, {
      related: { type: 'payment', id: paymentId },
      dedupeKey: `admin-notify:payment:${paymentId}:${admin.toLowerCase()}`,
    });
  }
}
