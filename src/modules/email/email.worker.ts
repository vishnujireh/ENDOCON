import { db } from '../../db/knex.js';
import { logger } from '../../lib/logger.js';
import { addMinutes, now } from '../../lib/time.js';
import { getInvoicePdf } from '../invoices/invoice.service.js';
import { getEmailProvider, type OutgoingEmail } from './provider.js';
import { renderEmail, type EmailTemplateName, type EmailTemplatePayloads } from './templates.js';

const MAX_ATTEMPTS = 8;
const BATCH = 10;

function parsePayload(v: unknown) {
  return typeof v === 'string' ? JSON.parse(v) : v;
}

/** Claims due rows atomically (SKIP LOCKED) so several workers can run safely. */
async function claimBatch(): Promise<{ id: number; to_email: string; template: string; payload: unknown; attempts: number }[]> {
  return db.transaction(async (trx) => {
    const rows = await trx('email_outbox')
      .where({ status: 'pending' })
      .where('send_after', '<=', now())
      .orderBy('id')
      .limit(BATCH)
      .forUpdate()
      .skipLocked()
      .select('id', 'to_email', 'template', 'payload', 'attempts');
    if (rows.length) {
      await trx('email_outbox').whereIn('id', rows.map((r) => r.id)).update({ status: 'sending', attempts: trx.raw('attempts + 1') });
    }
    return rows;
  });
}

/** Returns a reason string when the email should no longer be sent. */
async function shouldSkip(template: string, payload: Record<string, unknown>): Promise<string | null> {
  if (template === 'payment_failed') {
    const p = await db('payments').where({ id: payload.paymentId as number }).first('status', 'order_id');
    if (!p || !['failed', 'cancelled', 'expired'].includes(p.status)) return `skipped: payment is now ${p?.status ?? 'missing'}`;
    // The participant retried (new checkout) and paid successfully afterwards.
    const later = await db('payments').where({ order_id: p.order_id, status: 'success' }).where('id', '>', payload.paymentId as number).first('id');
    if (later) return `skipped: later payment ${later.id} succeeded`;
  }
  return null;
}

async function buildMessage(template: EmailTemplateName, to: string, payload: Record<string, unknown>): Promise<OutgoingEmail> {
  const rendered = renderEmail(template, payload as EmailTemplatePayloads[typeof template]);
  const message: OutgoingEmail = { to, ...rendered };
  if (template === 'registration_confirmation' && payload.invoiceId) {
    const pdf = await getInvoicePdf(payload.invoiceId as number);
    message.attachments = [{ filename: pdf.filename, content: pdf.buffer, contentType: 'application/pdf' }];
  }
  return message;
}

type OutboxRow = { id: number; to_email: string; template: string; payload: unknown; attempts: number };

/** Renders and sends one claimed row, then records the outcome. */
async function sendRow(row: OutboxRow): Promise<void> {
  const payload = parsePayload(row.payload) as Record<string, unknown>;
  try {
    const skip = await shouldSkip(row.template, payload);
    if (skip) {
      await db('email_outbox').where({ id: row.id }).update({ status: 'sent', sent_at: now(), last_error: skip });
      return;
    }
    const message = await buildMessage(row.template as EmailTemplateName, row.to_email, payload);
    await getEmailProvider().send(message);
    await db('email_outbox').where({ id: row.id }).update({ status: 'sent', sent_at: now(), last_error: null });
  } catch (err) {
    const attempts = row.attempts + 1;
    const failed = attempts >= MAX_ATTEMPTS;
    logger.error({ err, emailId: row.id, template: row.template, attempts }, 'Email send failed');
    await db('email_outbox')
      .where({ id: row.id })
      .update({
        status: failed ? 'failed' : 'pending',
        last_error: String((err as Error).message).slice(0, 1000),
        send_after: addMinutes(now(), Math.min(2 ** attempts, 240)),
      });
  }
}

export async function processEmailOutbox(): Promise<number> {
  // Crash recovery: rows stuck in "sending" for >10 min go back to the queue.
  await db('email_outbox').where({ status: 'sending' }).where('updated_at', '<', addMinutes(now(), -10)).update({ status: 'pending' });

  const rows = await claimBatch();
  for (const row of rows) await sendRow(row);
  return rows.length;
}

/**
 * Delivery outcome of one email, as reported in API replies and the admin email log.
 *   sent       – accepted by the email provider
 *   failed     – gave up after all retries
 *   retrying   – this attempt failed; the worker tries again later (error says why)
 *   scheduled  – deliberately delayed (e.g. the payment-failed notice waits 30 minutes)
 *   queued     – waiting for / being processed by the background worker
 *   skipped    – no longer needed (e.g. the payment succeeded on a retry)
 */
export type EmailDeliveryStatus = 'sent' | 'failed' | 'retrying' | 'scheduled' | 'queued' | 'skipped';
export interface EmailDeliveryResult {
  id: number;
  to: string;
  type: string;
  status: EmailDeliveryStatus;
  error?: string;
}

export function deliveryStatus(r: { status: string; attempts: number; last_error: string | null; send_after: Date | string }): {
  status: EmailDeliveryStatus;
  error?: string;
} {
  if (r.status === 'sent') return r.last_error?.startsWith('skipped') ? { status: 'skipped', error: r.last_error } : { status: 'sent' };
  if (r.status === 'failed') return { status: 'failed', error: r.last_error ?? undefined };
  if (r.status === 'pending' && r.attempts > 0 && r.last_error) return { status: 'retrying', error: r.last_error };
  if (r.status === 'pending' && new Date(r.send_after).getTime() > now().getTime()) return { status: 'scheduled' };
  return { status: 'queued' };
}

/**
 * Sends the given outbox rows now (those that are due and not already taken by the worker) and
 * returns the delivery outcome of each. Used to report email results in API replies.
 */
export async function deliverEmails(ids: number[], dedupeKeys: string[] = []): Promise<EmailDeliveryResult[]> {
  if (!ids.length && !dedupeKeys.length) return [];
  const found = await db('email_outbox')
    .where((q) => {
      if (ids.length) q.whereIn('id', ids);
      if (dedupeKeys.length) q.orWhereIn('dedupe_key', dedupeKeys);
    })
    .pluck('id');
  if (!found.length) return [];

  const claimed: OutboxRow[] = await db.transaction(async (trx) => {
    const rows = await trx('email_outbox')
      .whereIn('id', found)
      .where({ status: 'pending' })
      .where('send_after', '<=', now())
      .forUpdate()
      .skipLocked()
      .select('id', 'to_email', 'template', 'payload', 'attempts');
    if (rows.length) await trx('email_outbox').whereIn('id', rows.map((r) => r.id)).update({ status: 'sending', attempts: trx.raw('attempts + 1') });
    return rows;
  });
  for (const row of claimed) await sendRow(row);

  const rows = await db('email_outbox').whereIn('id', found).orderBy('id').select('id', 'to_email', 'template', 'status', 'attempts', 'last_error', 'send_after');
  return rows.map((r) => ({ id: r.id, to: r.to_email, type: r.template, ...deliveryStatus(r) }));
}
