import { db } from '../../db/knex.js';
import { pricingNow } from '../../lib/time.js';
import { catalogue } from '../catalogue/catalogue.js';
import { workshopSeatsTaken } from '../catalogue/catalogue.service.js';
import { currentPeriod } from '../catalogue/pricing.service.js';
import { Errors } from '../../lib/errors.js';
import { getProfileRow, toProfileDto } from '../profile/profile.service.js';
import { loadEntitlements } from './entitlements.repository.js';

export type NextStep = 'personal' | 'conference' | 'workshops' | 'accommodation' | 'complete';

export async function listUserPayments(userId: number) {
  const payments = await db('payments as p')
    .leftJoin('invoices as i', 'i.payment_id', 'p.id')
    .where('p.user_id', userId)
    .whereIn('p.status', ['success', 'refunded', 'partially_refunded', 'conflict', 'failed', 'created', 'pending'])
    .orderBy('p.id', 'desc')
    .limit(50)
    .select(
      'p.id',
      'p.status',
      'p.purpose',
      'p.subtotal_minor',
      'p.gst_minor',
      'p.total_minor',
      'p.currency',
      'p.gateway_payment_id',
      'p.paid_at',
      'p.created_at',
      'p.failure_reason',
      'i.id as invoice_id',
      'i.invoice_number',
    );
  const ids = payments.map((p) => p.id);
  const items = ids.length
    ? await db('payment_items').whereIn('payment_id', ids).orderBy('id').select('payment_id', 'item_type', 'description', 'amount_minor', 'gst_minor', 'total_minor')
    : [];
  return payments.map((p) => ({
    id: p.id,
    status: p.status,
    purpose: p.purpose,
    subtotalMinor: Number(p.subtotal_minor),
    gstMinor: Number(p.gst_minor),
    totalMinor: Number(p.total_minor),
    currency: p.currency,
    gatewayPaymentId: p.gateway_payment_id,
    paidAt: p.paid_at,
    createdAt: p.created_at,
    failureReason: p.failure_reason,
    invoice: p.invoice_id ? { id: p.invoice_id, number: p.invoice_number } : null,
    items: items
      .filter((i) => i.payment_id === p.id)
      .map((i) => ({
        itemType: i.item_type,
        description: i.description,
        amountMinor: Number(i.amount_minor),
        gstMinor: Number(i.gst_minor),
        totalMinor: Number(i.total_minor),
      })),
  }));
}

/**
 * The single source of truth for the resumable registration UI. The frontend rebuilds its
 * whole state from this on every visit.
 */
export async function getRegistrationStatus(userId: number) {
  const profileRow = await getProfileRow(db, userId);
  if (!profileRow) throw Errors.notFound('Account not found.');
  const held = await loadEntitlements(db, userId);
  const payments = await listUserPayments(userId);

  const cat = catalogue();
  const workshopsOffered = cat.workshops.length;
  const workshopsRemaining = Math.max(0, workshopsOffered - held.workshops.length);

  const profileComplete = !!profileRow.completed_at;
  let nextStep: NextStep;
  if (!profileComplete) nextStep = 'personal';
  else if (!held.conference) nextStep = 'conference';
  else if (held.workshops.length === 0 && workshopsRemaining > 0) nextStep = 'workshops';
  else if (!held.accommodation) nextStep = 'accommodation';
  else nextStep = 'complete';

  // Seats left, only for workshops that have a capacity in the catalogue.
  const capped = cat.workshops.filter((w) => w.capacity != null);
  const taken = capped.length ? await workshopSeatsTaken(db, capped.map((w) => w.code)) : new Map<string, number>();
  const workshopSeatsLeft = Object.fromEntries(capped.map((w) => [w.code, Math.max(0, w.capacity! - (taken.get(w.code) ?? 0))]));

  // The pricing period in force now, by SERVER time (the browser clock is never used for pricing).
  const now = pricingNow();
  let pricingPeriod: string | null = null;
  try {
    pricingPeriod = currentPeriod(now).code;
  } catch {
    pricingPeriod = null;
  }

  const openPayment = payments.find((p) => p.status === 'created' || p.status === 'pending') ?? null;
  const paidTotalMinor = payments.filter((p) => p.status === 'success').reduce((a, p) => a + p.totalMinor, 0);

  return {
    profile: toProfileDto(profileRow),
    order: held.order
      ? {
          id: held.order.id,
          orderNumber: held.order.orderNumber,
          status: held.order.status,
          confirmedAt: held.order.confirmedAt,
        }
      : null,
    conference: held.conference,
    workshops: held.workshops,
    accommodation: held.accommodation,
    accompanying: held.accompanying,
    payments,
    openPayment,
    paidTotalMinor,
    steps: {
      personal: profileComplete ? 'complete' : 'incomplete',
      conference: held.conference ? 'purchased' : 'not_purchased',
      workshops: { purchased: held.workshops.length, remaining: workshopsRemaining, offered: workshopsOffered },
      accommodation: held.accommodation ? 'purchased' : 'not_purchased',
    },
    nextStep,
    pricing: { periodCode: pricingPeriod, serverTime: now.toISOString() },
    workshopSeatsLeft,
  };
}
