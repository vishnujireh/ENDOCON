import { env } from '../../config/env.js';
import { db, type DbOrTrx, type Trx } from '../../db/knex.js';
import { AppError, Errors } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { nextSequenceValue, pad } from '../../lib/sequences.js';
import { addHours, addMinutes, now, toIsoDate } from '../../lib/time.js';
import { findWorkshop } from '../catalogue/catalogue.js';
import { enqueueEmail } from '../email/outbox.js';
import { createInvoiceForPayment } from '../invoices/invoice.service.js';
import { priceCart, type CartInput } from '../registration/cart.service.js';
import { getOrCreateOrder } from '../registration/entitlements.repository.js';
import { getGateway } from './gateway/index.js';
import type { GatewayPayment } from './gateway/gateway.js';
import { queuePaymentSuccessEmails } from './payment-notifications.js';

/**
 * Payment lifecycle
 * -----------------
 *  checkout()  -> payments row (status=created) + payment_items snapshot + gateway order
 *  verify()    -> checkout-handler callback: signature check + server-side fetch from gateway
 *  webhook     -> gateway event (HMAC verified, de-duplicated)
 *  reconcile() -> periodic poll for payments whose browser closed and webhook was missed
 *
 * All three verification paths funnel into applyGatewayPayment() -> settlePayment(), which is
 * idempotent (row lock + terminal-status check) and is the ONLY code that grants entitlements.
 */

const SETTLED = new Set(['success', 'refunded', 'partially_refunded', 'conflict']);
const OPEN = new Set(['created', 'pending']);

class GrantConflict extends Error {}

// ---------------------------------------------------------------------------------------------
// Events log
// ---------------------------------------------------------------------------------------------

export async function logPaymentEvent(
  conn: DbOrTrx,
  e: {
    source: 'webhook' | 'verify' | 'reconcile' | 'checkout' | 'client';
    type: string;
    paymentId?: number | null;
    gatewayOrderId?: string | null;
    gatewayPaymentId?: string | null;
    eventId?: string | null;
    signatureValid?: boolean | null;
    payload?: unknown;
    error?: string | null;
    processed?: boolean;
  },
): Promise<number> {
  const [id] = await conn('payment_events').insert({
    gateway: getGateway().name,
    source: e.source,
    gateway_event_id: e.eventId ?? null,
    event_type: e.type.slice(0, 80),
    payment_id: e.paymentId ?? null,
    gateway_order_id: e.gatewayOrderId ?? null,
    gateway_payment_id: e.gatewayPaymentId ?? null,
    signature_valid: e.signatureValid ?? null,
    payload: e.payload === undefined ? null : JSON.stringify(e.payload),
    error: e.error?.slice(0, 500) ?? null,
    processed_at: e.processed ? now() : null,
  });
  return id as number;
}

// ---------------------------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------------------------

export async function checkout(userId: number, cart: CartInput, idempotencyKey?: string) {
  const gateway = getGateway();

  const paymentId = await db.transaction(async (trx) => {
    const order = await getOrCreateOrder(trx, userId);
    // Serialise all checkouts of this user (double-click, two tabs).
    await trx('orders').where({ id: order.id }).forUpdate().first('id');

    const priced = await priceCart(trx, userId, cart);

    if (idempotencyKey) {
      const existing = await trx('payments').where({ user_id: userId, idempotency_key: idempotencyKey }).first();
      if (existing) {
        if (existing.cart_hash !== priced.cartHash) {
          throw Errors.conflict('This checkout key was already used for a different selection. Please try again.', 'IDEMPOTENCY_KEY_REUSED');
        }
        if (OPEN.has(existing.status)) return existing.id as number;
        if (existing.status === 'success') throw Errors.conflict('This payment has already been completed.', 'PAYMENT_ALREADY_COMPLETED');
        throw Errors.conflict('This checkout has ended. Please review your selection and try again.', 'CHECKOUT_ENDED');
      }
    }

    const inFlight = await trx('payments')
      .where({ order_id: order.id, status: 'pending' })
      .where('updated_at', '>', addHours(now(), -2))
      .first('id');
    if (inFlight) {
      throw Errors.conflict(
        'A payment for your registration is currently being processed. Please wait a few minutes and refresh this page.',
        'PAYMENT_IN_PROGRESS',
      );
    }

    // Re-use an open checkout for the identical cart (retry / refresh / second tab).
    const reusable = await trx('payments')
      .where({ order_id: order.id, status: 'created', cart_hash: priced.cartHash })
      .where('created_at', '>', addHours(now(), -env.PAYMENT_EXPIRE_AFTER_HOURS))
      .orderBy('id', 'desc')
      .first('id');
    if (reusable) return reusable.id as number;

    // A different cart supersedes older open checkouts. (If one of them is still paid, the
    // settlement logic will still honour it or flag it for refund – money is never ignored.)
    await trx('payments')
      .where({ order_id: order.id, status: 'created' })
      .update({ status: 'cancelled', failure_reason: 'Superseded by a newer checkout' });

    const [id] = await trx('payments').insert({
      order_id: order.id,
      user_id: userId,
      gateway: gateway.name,
      subtotal_minor: priced.subtotalMinor,
      gst_minor: priced.gstMinor,
      total_minor: priced.totalMinor,
      currency: priced.currency,
      status: 'created',
      purpose: priced.purpose,
      cart_hash: priced.cartHash,
      idempotency_key: idempotencyKey ?? null,
    });
    await trx('payment_items').insert(
      priced.lines.map((l) => ({
        payment_id: id,
        item_type: l.itemType,
        item_code: l.itemCode,
        item_name: l.itemName,
        region: l.region,
        occupancy: l.occupancy,
        check_in: l.checkIn,
        check_out: l.checkOut,
        guest_title: l.guestTitle,
        guest_name: l.guestName,
        description: l.description,
        pricing_period_code: l.pricingPeriodCode,
        original_currency: l.originalCurrency,
        original_unit_amount_minor: l.originalUnitAmountMinor,
        fx_rate: l.fxRate,
        unit_amount_minor: l.unitAmountMinor,
        quantity: l.quantity,
        amount_minor: l.amountMinor,
        gst_rate_bps: l.gstRateBps,
        gst_minor: l.gstMinor,
        total_minor: l.totalMinor,
      })),
    );
    return id as number;
  });

  let payment = await db('payments').where({ id: paymentId }).first();
  if (!payment.gateway_order_id) {
    const go = await gateway.createOrder({
      amountMinor: Number(payment.total_minor),
      currency: payment.currency,
      receipt: `endocon_pay_${paymentId}`,
      notes: { payment_id: String(paymentId), user_id: String(userId), purpose: payment.purpose },
    });
    // Only the first concurrent request wins; the others adopt its gateway order.
    await db('payments').where({ id: paymentId }).whereNull('gateway_order_id').update({ gateway_order_id: go.id });
    await logPaymentEvent(db, { source: 'checkout', type: 'order.created', paymentId, gatewayOrderId: go.id, processed: true });
    payment = await db('payments').where({ id: paymentId }).first();
  }

  return checkoutDto(payment);
}

async function checkoutDto(payment: Record<string, any>) {
  const gateway = getGateway();
  const profile = await db('user_profiles as p')
    .join('users as u', 'u.id', 'p.user_id')
    .where('p.user_id', payment.user_id)
    .first('p.title', 'p.full_name', 'p.phone_country_code', 'p.phone_number', 'u.email');
  const items = await db('payment_items').where({ payment_id: payment.id }).orderBy('id');
  return {
    paymentId: payment.id,
    status: payment.status,
    gateway: gateway.name,
    keyId: gateway.publicKey(),
    gatewayOrderId: payment.gateway_order_id,
    amountMinor: Number(payment.total_minor),
    currency: payment.currency,
    merchantName: 'ENDOCON 2027',
    description: payment.purpose === 'registration' ? 'Conference registration' : 'Registration add-ons',
    prefill: {
      name: [profile?.title, profile?.full_name].filter(Boolean).join(' '),
      email: profile?.email ?? '',
      contact: profile?.phone_number ? `${profile.phone_country_code ?? ''}${profile.phone_number}` : '',
    },
    summary: {
      lines: items.map((i) => ({
        itemType: i.item_type,
        description: i.description,
        amountMinor: Number(i.amount_minor),
        gstMinor: Number(i.gst_minor),
        totalMinor: Number(i.total_minor),
      })),
      subtotalMinor: Number(payment.subtotal_minor),
      gstMinor: Number(payment.gst_minor),
      totalMinor: Number(payment.total_minor),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Verification paths
// ---------------------------------------------------------------------------------------------

export async function verifyCheckout(
  userId: number,
  input: { paymentId: number; gatewayOrderId: string; gatewayPaymentId: string; signature: string },
) {
  const gateway = getGateway();
  const payment = await db('payments').where({ id: input.paymentId, user_id: userId }).first();
  if (!payment) throw Errors.notFound('Payment not found.');
  if (payment.gateway_order_id !== input.gatewayOrderId) {
    throw Errors.badRequest('Payment details do not match this checkout.', 'PAYMENT_MISMATCH');
  }

  const signatureValid = gateway.verifyCheckoutSignature(input);
  await logPaymentEvent(db, {
    source: 'verify',
    type: 'checkout.callback',
    paymentId: payment.id,
    gatewayOrderId: input.gatewayOrderId,
    gatewayPaymentId: input.gatewayPaymentId,
    signatureValid,
    processed: true,
  });
  if (!signatureValid) {
    throw Errors.badRequest(
      'We could not verify this payment. If money was debited it will be confirmed automatically within a few minutes, otherwise it will be refunded.',
      'INVALID_SIGNATURE',
    );
  }

  // The signature proves the callback came from checkout; the server-side fetch proves the money.
  const gp = await gateway.fetchPayment(input.gatewayPaymentId);
  await db('payments').where({ id: payment.id }).update({ gateway_signature: input.signature.slice(0, 255) });
  await applyGatewayPayment(payment.id, gp, 'verify');
  return getPaymentForUser(userId, payment.id);
}

/** Apply an authoritative gateway payment state to our payment row. */
export async function applyGatewayPayment(paymentId: number, gp: GatewayPayment, source: 'verify' | 'webhook' | 'reconcile'): Promise<void> {
  const payment = await db('payments').where({ id: paymentId }).first();
  if (!payment) return;
  if (gp.orderId && payment.gateway_order_id && gp.orderId !== payment.gateway_order_id) {
    logger.warn({ paymentId, gp: gp.id }, 'Gateway payment belongs to a different order; ignoring');
    return;
  }

  if (gp.status === 'refunded' && !SETTLED.has(payment.status)) {
    // Refunded before we ever settled it (e.g. manual refund, late event): never grant items.
    await db('payments')
      .where({ id: paymentId })
      .update({ status: 'refunded', gateway_payment_id: gp.id, refunded_minor: gp.amountRefundedMinor, last_checked_at: now(), failure_reason: 'Refunded before confirmation.' });
    return;
  }

  if (gp.status === 'authorized') {
    if (gp.amountMinor !== Number(payment.total_minor) || gp.currency !== payment.currency) {
      // Never capture an amount we did not charge; settlement records it as a conflict.
      await settlePayment(paymentId, gp, source);
      return;
    }
    // Normally auto-captured by the Razorpay account settings; capture defensively otherwise.
    {
      try {
        const captured = await getGateway().capturePayment(gp.id, gp.amountMinor, gp.currency);
        await settlePayment(paymentId, captured, source);
        return;
      } catch (err) {
        logger.warn({ err, paymentId }, 'Capture failed; marking pending');
      }
    }
    await db('payments').where({ id: paymentId }).whereIn('status', ['created', 'cancelled', 'failed']).update({ status: 'pending', gateway_payment_id: gp.id });
    return;
  }
  if (gp.status === 'captured' || gp.status === 'refunded') {
    await settlePayment(paymentId, gp, source);
    if (gp.amountRefundedMinor > 0) await syncRefund(gp.id);
    return;
  }
  if (gp.status === 'failed') {
    await markAttemptFailed(paymentId, gp);
  }
}

// ---------------------------------------------------------------------------------------------
// Settlement: the only place entitlements are created
// ---------------------------------------------------------------------------------------------

export async function settlePayment(paymentId: number, gp: GatewayPayment, source: string): Promise<'success' | 'conflict' | 'already'> {
  return db.transaction(async (trx) => {
    // Lock order: orders row first, then payment – same order as checkout() to avoid deadlocks.
    const ref = await trx('payments').where({ id: paymentId }).first('order_id');
    if (!ref) throw Errors.notFound('Payment not found.');
    const order = await trx('orders').where({ id: ref.order_id }).forUpdate().first();
    const payment = await trx('payments').where({ id: paymentId }).forUpdate().first();

    if (SETTLED.has(payment.status)) {
      if (payment.gateway_payment_id && payment.gateway_payment_id !== gp.id && gp.status === 'captured') {
        // A second successful attempt against the same gateway order – money must be returned.
        await flagConflict(trx, payment, gp.id, 'Duplicate capture: this gateway order was already paid by another payment.', false);
      }
      return 'already';
    }

    const t = now();
    const base = { gateway_payment_id: gp.id, method: gp.method, paid_at: t, last_checked_at: t };

    if (gp.amountMinor !== Number(payment.total_minor) || gp.currency !== payment.currency) {
      await trx('payments').where({ id: paymentId }).update({ ...base, status: 'conflict', failure_code: 'AMOUNT_MISMATCH' });
      await flagConflict(trx, { ...payment, order_number: order.order_number }, gp.id, `Amount mismatch: gateway ${gp.amountMinor} ${gp.currency}, expected ${payment.total_minor} ${payment.currency}.`, true);
      return 'conflict';
    }

    const items = await trx('payment_items').where({ payment_id: paymentId }).orderBy('id');
    let conflictReason: string | null = null;
    try {
      await trx.transaction(async (sp) => grantItems(sp, payment, items));
    } catch (err) {
      if (err instanceof GrantConflict) conflictReason = err.message;
      else if ((err as { code?: string }).code === 'ER_DUP_ENTRY') conflictReason = 'One or more items in this payment were already purchased.';
      else throw err;
    }

    if (conflictReason) {
      await trx('payments').where({ id: paymentId }).update({ ...base, status: 'conflict', failure_code: 'ITEMS_UNAVAILABLE', failure_reason: conflictReason });
      await flagConflict(trx, { ...payment, order_number: order.order_number }, gp.id, conflictReason, true);
      logger.warn({ paymentId, conflictReason, source }, 'Payment settled as conflict');
      return 'conflict';
    }

    let orderNumber: string = order.order_number;
    if (!orderNumber) {
      orderNumber = `${env.ORDER_NUMBER_PREFIX}-${pad(await nextSequenceValue(trx, 'order_number'))}`;
    }
    const hasConference = await trx('conference_registrations').where({ order_id: order.id, status: 'active' }).first('id');
    await trx('orders')
      .where({ id: order.id })
      .update({ order_number: orderNumber, status: hasConference ? 'active' : order.status, confirmed_at: order.confirmed_at ?? t });
    await trx('payments').where({ id: paymentId }).update({ ...base, status: 'success', failure_code: null, failure_reason: null });

    await createInvoiceForPayment(trx, paymentId, orderNumber);
    await queuePaymentSuccessEmails(trx, paymentId);
    logger.info({ paymentId, orderNumber, source }, 'Payment settled');
    return 'success';
  });
}

async function grantItems(trx: Trx, payment: Record<string, any>, items: Record<string, any>[]): Promise<void> {
  for (const i of items.filter((x) => x.item_type === 'workshop')) {
    const w = findWorkshop(i.item_code);
    if (!w || w.capacity == null) continue;
    // Locks this workshop's bookings (and, via InnoDB next-key locks on the index, the gap for new
    // ones) so concurrent settlements cannot oversell the capacity set in the catalogue.
    const booked = await trx('order_workshops').where({ workshop_code: w.code, status: 'active' }).forUpdate().select('id');
    if (booked.length >= w.capacity) throw new GrantConflict(`Workshop "${w.name}" became fully booked before the payment completed.`);
  }

  for (const i of items) {
    const amounts = {
      description: i.description,
      pricing_period_code: i.pricing_period_code,
      original_currency: i.original_currency,
      original_unit_amount_minor: i.original_unit_amount_minor,
      fx_rate: i.fx_rate,
      unit_amount_minor: i.unit_amount_minor,
      quantity: i.quantity,
      amount_minor: i.amount_minor,
      gst_rate_bps: i.gst_rate_bps,
      gst_minor: i.gst_minor,
      total_minor: i.total_minor,
      payment_id: payment.id,
      payment_item_id: i.id,
    };
    switch (i.item_type) {
      case 'conference': {
        const exists = await trx('conference_registrations').where({ user_id: payment.user_id }).first('id');
        if (exists) throw new GrantConflict('A conference registration already exists for this participant.');
        await trx('conference_registrations').insert({
          ...amounts,
          order_id: payment.order_id,
          user_id: payment.user_id,
          category_code: i.item_code,
          category_name: i.item_name,
          region: i.region,
          source: 'payment',
        });
        break;
      }
      case 'workshop': {
        const exists = await trx('order_workshops').where({ order_id: payment.order_id, workshop_code: i.item_code }).first('id');
        if (exists) throw new GrantConflict('A selected workshop was already purchased.');
        await trx('order_workshops').insert({
          ...amounts,
          order_id: payment.order_id,
          user_id: payment.user_id,
          workshop_code: i.item_code,
          workshop_name: i.item_name,
        });
        break;
      }
      case 'accommodation': {
        const exists = await trx('order_accommodations').where({ order_id: payment.order_id }).first('id');
        if (exists) throw new GrantConflict('Accommodation was already booked.');
        await trx('order_accommodations').insert({
          ...amounts,
          order_id: payment.order_id,
          user_id: payment.user_id,
          accommodation_code: i.item_code,
          hotel_name: i.item_name,
          occupancy: i.occupancy,
          check_in: toIsoDate(i.check_in),
          check_out: toIsoDate(i.check_out),
        });
        break;
      }
      case 'accompanying': {
        await trx('order_accompanying_persons').insert({
          ...amounts,
          order_id: payment.order_id,
          user_id: payment.user_id,
          category_code: i.item_code,
          category_name: i.item_name,
          title: i.guest_title,
          full_name: i.guest_name,
        });
        break;
      }
      default:
        throw new Error(`Unknown item type ${i.item_type}`);
    }
  }

  // Add-ons must hang off a conference registration (it may have been granted just above).
  const hasAddOns = items.some((i) => i.item_type !== 'conference');
  if (hasAddOns) {
    const conf = await trx('conference_registrations').where({ order_id: payment.order_id, status: 'active' }).first('id');
    if (!conf) throw new GrantConflict('Add-ons were paid without an active conference registration.');
  }
}

async function flagConflict(trx: Trx, payment: Record<string, any>, gatewayPaymentId: string, reason: string, alreadyUpdated: boolean): Promise<void> {
  if (!alreadyUpdated) {
    await logPaymentEvent(trx, { source: 'reconcile', type: 'conflict.duplicate_capture', paymentId: payment.id, gatewayPaymentId, error: reason, processed: true });
  }
  const user = await trx('users').where({ id: payment.user_id }).first('email');
  for (const admin of env.adminNotificationEmails) {
    await enqueueEmail(
      trx,
      admin,
      'payment_conflict_admin',
      { paymentId: payment.id, gatewayPaymentId, orderNumber: payment.order_number ?? null, email: user?.email ?? '', reason },
      { related: { type: 'payment', id: payment.id }, dedupeKey: `conflict:${gatewayPaymentId}:${admin.toLowerCase()}` },
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Failure / cancel / refund
// ---------------------------------------------------------------------------------------------

export async function markAttemptFailed(paymentId: number, gp: GatewayPayment | null, reason?: string): Promise<void> {
  await db.transaction(async (trx) => {
    const payment = await trx('payments').where({ id: paymentId }).forUpdate().first();
    if (!payment || !OPEN.has(payment.status)) return;
    await trx('payments').where({ id: paymentId }).update({
      status: 'failed',
      failure_code: gp?.errorCode?.slice(0, 80) ?? 'PAYMENT_FAILED',
      failure_reason: (gp?.errorDescription ?? reason ?? 'Payment was not completed.').slice(0, 500),
      last_checked_at: now(),
    });
    const profile = await trx('user_profiles as p').join('users as u', 'u.id', 'p.user_id').where('p.user_id', payment.user_id).first('p.full_name', 'u.email');
    // Delayed + re-checked by the worker: the customer may still retry successfully on the same order.
    await enqueueEmail(
      trx,
      profile.email,
      'payment_failed',
      {
        paymentId,
        fullName: profile.full_name || 'Participant',
        totalMinor: Number(payment.total_minor),
        currency: payment.currency,
        retryUrl: `${env.FRONTEND_URL.replace(/\/$/, '')}/registration`,
        reason: gp?.errorDescription ?? null,
      },
      { related: { type: 'payment', id: paymentId }, dedupeKey: `payment-failed:${paymentId}`, sendAfter: addMinutes(now(), 30) },
    );
  });
}

/** User closed the checkout without paying. Does not prevent a late capture from settling. */
export async function cancelCheckout(userId: number, paymentId: number, reason: string | null) {
  const payment = await db('payments').where({ id: paymentId, user_id: userId }).first();
  if (!payment) throw Errors.notFound('Payment not found.');
  await logPaymentEvent(db, { source: 'client', type: 'checkout.dismissed', paymentId, gatewayOrderId: payment.gateway_order_id, payload: { reason }, processed: true });
  if (payment.status === 'created') {
    await db('payments').where({ id: paymentId, status: 'created' }).update({ status: 'cancelled', failure_reason: (reason ?? 'Payment was cancelled.').slice(0, 500) });
  }
  return getPaymentForUser(userId, paymentId);
}

export async function syncRefund(gatewayPaymentId: string): Promise<void> {
  const payment = await db('payments').where({ gateway_payment_id: gatewayPaymentId }).first();
  if (!payment) return;
  const gp = await getGateway().fetchPayment(gatewayPaymentId);
  await db.transaction(async (trx) => {
    const locked = await trx('payments').where({ id: payment.id }).forUpdate().first();
    const refunded = gp.amountRefundedMinor;
    if (refunded <= 0 || refunded === Number(locked.refunded_minor)) return;
    const full = refunded >= Number(locked.total_minor);
    await trx('payments').where({ id: payment.id }).update({
      refunded_minor: refunded,
      status: full ? 'refunded' : 'partially_refunded',
    });
    if (full) {
      for (const table of ['conference_registrations', 'order_workshops', 'order_accommodations', 'order_accompanying_persons']) {
        await trx(table).where({ payment_id: payment.id, status: 'active' }).update({ status: 'refunded' });
      }
    }
    await trx('audit_logs').insert({
      actor_user_id: null,
      action: full ? 'payment.refunded' : 'payment.partially_refunded',
      entity_type: 'payment',
      entity_id: String(payment.id),
      before: JSON.stringify({ status: locked.status, refunded_minor: locked.refunded_minor }),
      after: JSON.stringify({ refunded_minor: refunded }),
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------------------------

export async function handleWebhook(rawBody: Buffer, signature: string, eventIdHeader?: string): Promise<'processed' | 'duplicate' | 'ignored'> {
  const gateway = getGateway();
  const signatureValid = gateway.verifyWebhookSignature(rawBody, signature);
  if (!signatureValid) {
    logger.warn({ eventId: eventIdHeader }, 'Webhook with invalid signature rejected');
    throw new AppError(400, 'INVALID_SIGNATURE', 'Invalid signature.');
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw Errors.badRequest('Invalid JSON.');
  }
  const evt = gateway.parseWebhook(body, { eventId: eventIdHeader });

  let eventRowId: number;
  if (evt.eventId) {
    const existing = await db('payment_events').where({ gateway_event_id: evt.eventId }).first('id', 'processed_at');
    if (existing?.processed_at) return 'duplicate';
    if (existing) {
      eventRowId = existing.id;
    } else {
      try {
        eventRowId = await logPaymentEvent(db, {
          source: 'webhook',
          type: evt.type,
          eventId: evt.eventId,
          gatewayOrderId: evt.gatewayOrderId,
          gatewayPaymentId: evt.payment?.id ?? evt.refund?.paymentId ?? null,
          signatureValid: true,
          payload: body,
        });
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') return 'duplicate'; // concurrent delivery
        throw err;
      }
    }
  } else {
    eventRowId = await logPaymentEvent(db, { source: 'webhook', type: evt.type, gatewayOrderId: evt.gatewayOrderId, signatureValid: true, payload: body });
  }

  try {
    const outcome = await processWebhookEvent(evt);
    await db('payment_events').where({ id: eventRowId }).update({ processed_at: now(), error: outcome === 'ignored' ? 'ignored' : null });
    return outcome;
  } catch (err) {
    await db('payment_events').where({ id: eventRowId }).update({ error: String((err as Error).message).slice(0, 500) });
    throw err; // non-2xx -> Razorpay retries; the unprocessed row lets the retry run again
  }
}

async function processWebhookEvent(evt: ReturnType<ReturnType<typeof getGateway>['parseWebhook']>): Promise<'processed' | 'ignored'> {
  if (evt.type.startsWith('refund.')) {
    if (evt.type === 'refund.processed' && evt.refund) {
      await syncRefund(evt.refund.paymentId);
      return 'processed';
    }
    return 'ignored';
  }
  if (!['payment.captured', 'payment.authorized', 'payment.failed', 'order.paid'].includes(evt.type) || !evt.payment) return 'ignored';
  const orderId = evt.payment.orderId ?? evt.gatewayOrderId;
  if (!orderId) return 'ignored';
  const payment = await db('payments').where({ gateway_order_id: orderId }).first('id');
  if (!payment) return 'ignored'; // not ours (e.g. another integration on the same account)
  await db('payment_events').where({ gateway_event_id: evt.eventId ?? '__none__' }).update({ payment_id: payment.id });
  await applyGatewayPayment(payment.id, evt.payment, 'webhook');
  return 'processed';
}

// ---------------------------------------------------------------------------------------------
// Reconciliation job
// ---------------------------------------------------------------------------------------------

export async function reconcilePayments(limit = 50): Promise<{ checked: number; settled: number; expired: number }> {
  const gateway = getGateway();
  const t = now();
  const staleBefore = addMinutes(t, -env.PAYMENT_STALE_AFTER_MINUTES);
  const rows = await db('payments')
    .whereIn('status', ['created', 'pending', 'failed', 'cancelled'])
    .whereNotNull('gateway_order_id')
    .where('created_at', '<', staleBefore)
    .where('created_at', '>', addHours(t, -72))
    .where((q) => q.whereNull('last_checked_at').orWhere('last_checked_at', '<', staleBefore))
    .orderBy('id')
    .limit(limit);

  let settled = 0;
  let expired = 0;
  for (const row of rows) {
    try {
      const attempts = await gateway.fetchOrderPayments(row.gateway_order_id);
      await db('payments').where({ id: row.id }).update({ last_checked_at: now() });
      const winner = attempts.find((a) => a.status === 'captured') ?? attempts.find((a) => a.status === 'authorized');
      if (winner) {
        await applyGatewayPayment(row.id, winner, 'reconcile');
        settled++;
        continue;
      }
      if (row.status === 'pending' && new Date(row.updated_at) < addHours(t, -env.PAYMENT_EXPIRE_AFTER_HOURS)) {
        await db('payments').where({ id: row.id, status: 'pending' }).update({ status: 'failed', failure_reason: 'Payment was not captured.' });
        continue;
      }
      if (row.status === 'created' && new Date(row.created_at) < addHours(t, -env.PAYMENT_EXPIRE_AFTER_HOURS)) {
        await db('payments').where({ id: row.id, status: 'created' }).update({ status: 'expired', failure_reason: 'Checkout expired without payment.' });
        expired++;
      }
    } catch (err) {
      logger.error({ err, paymentId: row.id }, 'Reconciliation failed for payment');
    }
  }
  return { checked: rows.length, settled, expired };
}

// ---------------------------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------------------------

export async function getPaymentDetails(paymentId: number) {
  const p = await db('payments as p')
    .join('orders as o', 'o.id', 'p.order_id')
    .leftJoin('invoices as i', 'i.payment_id', 'p.id')
    .where('p.id', paymentId)
    .first('p.*', 'o.order_number', 'i.id as invoice_id', 'i.invoice_number');
  if (!p) return null;
  const items = await db('payment_items').where({ payment_id: paymentId }).orderBy('id');
  return {
    id: p.id,
    userId: p.user_id as number,
    status: p.status as string,
    purpose: p.purpose,
    orderNumber: p.status === 'success' || SETTLED.has(p.status) ? p.order_number : null,
    gatewayOrderId: p.gateway_order_id,
    gatewayPaymentId: p.gateway_payment_id,
    method: p.method,
    currency: p.currency,
    subtotalMinor: Number(p.subtotal_minor),
    gstMinor: Number(p.gst_minor),
    totalMinor: Number(p.total_minor),
    refundedMinor: Number(p.refunded_minor),
    failureReason: p.failure_reason,
    paidAt: p.paid_at,
    createdAt: p.created_at,
    invoice: p.invoice_id ? { id: p.invoice_id, number: p.invoice_number } : null,
    items: items.map((i) => ({
      itemType: i.item_type,
      description: i.description,
      quantity: i.quantity,
      unitAmountMinor: Number(i.unit_amount_minor),
      amountMinor: Number(i.amount_minor),
      gstMinor: Number(i.gst_minor),
      totalMinor: Number(i.total_minor),
      pricingPeriodCode: i.pricing_period_code,
    })),
  };
}

export async function getPaymentForUser(userId: number, paymentId: number) {
  const p = await getPaymentDetails(paymentId);
  if (!p || p.userId !== userId) throw Errors.notFound('Payment not found.');
  const { userId: _omit, ...rest } = p;
  return rest;
}

/**
 * Called by the result page while a payment is still open: asks the gateway directly so the
 * user sees the outcome even if the webhook is delayed.
 */
export async function refreshPaymentForUser(userId: number, paymentId: number) {
  const payment = await db('payments').where({ id: paymentId, user_id: userId }).first();
  if (!payment) throw Errors.notFound('Payment not found.');
  const recentlyChecked = payment.last_checked_at && new Date(payment.last_checked_at) > new Date(now().getTime() - 10_000);
  if (OPEN.has(payment.status) && payment.gateway_order_id && !recentlyChecked) {
    const attempts = await getGateway().fetchOrderPayments(payment.gateway_order_id);
    const winner = attempts.find((a) => a.status === 'captured') ?? attempts.find((a) => a.status === 'authorized');
    if (winner) await applyGatewayPayment(payment.id, winner, 'reconcile');
    await db('payments').where({ id: paymentId }).update({ last_checked_at: now() });
  }
  return getPaymentForUser(userId, paymentId);
}
