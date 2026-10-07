import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../../db/knex.js';
import { logger } from '../../lib/logger.js';
import { deliverEmails, type EmailDeliveryResult } from './email.worker.js';

/**
 * Reports email delivery in API replies.
 *
 * Every email a request queues (enqueueEmail) is recorded here. When the handler answers with a
 * success envelope, those emails are sent straight away (after the business transaction has
 * committed) and their outcome is added to the reply:
 *
 *   { success: true, message, data, emails: [{ to, type, status: 'sent' | 'failed' | …, error? }] }
 *
 * Emails that fail are still retried by the background worker. Routes that must not reveal
 * whether an account exists (forgot password) call hideEmailStatus(): their reply stays identical
 * for everyone and the worker sends the email as usual (no timing difference either).
 */
interface Tracker {
  ids: Set<number>;
  dedupeKeys: Set<string>;
  hidden: boolean;
}

const storage = new AsyncLocalStorage<Tracker>();

/** Called by enqueueEmail for every queued email. */
export function trackQueuedEmail(id: number | null, dedupeKey: string | null): void {
  const t = storage.getStore();
  if (!t) return;
  if (id) t.ids.add(id);
  else if (dedupeKey) t.dedupeKeys.add(dedupeKey);
}

/**
 * Also report emails queued earlier for the same record (e.g. the payment confirmation that the
 * Razorpay webhook already queued before the browser's verify call arrived).
 */
export async function trackRelatedEmails(type: string, id: number | string, templates: string[]): Promise<void> {
  const t = storage.getStore();
  if (!t) return;
  const ids = await db('email_outbox').where({ related_type: type, related_id: String(id) }).whereIn('template', templates).pluck('id');
  for (const i of ids) t.ids.add(i);
}

/** Keep this request's reply free of email details (account-enumeration protection). */
export function hideEmailStatus(): void {
  const t = storage.getStore();
  if (t) t.hidden = true;
}

/** Admin-only notification templates: participants see "ENDOCON team" instead of the address. */
const TEAM_TEMPLATES = new Set(['admin_payment_notification', 'abstract_admin_notification', 'payment_conflict_admin']);

function forViewer(results: EmailDeliveryResult[], isAdmin: boolean) {
  return results.map(({ to, type, status, error }) => ({
    to: !isAdmin && TEAM_TEMPLATES.has(type) ? 'ENDOCON team' : to,
    type,
    status,
    ...(error ? { error } : {}),
  }));
}

export function emailTracker(req: Request, res: Response, next: NextFunction): void {
  const tracker: Tracker = { ids: new Set(), dedupeKeys: new Set(), hidden: false };
  const json = res.json.bind(res);
  res.json = (body?: unknown) => {
    const queued = tracker.ids.size + tracker.dedupeKeys.size > 0;
    const envelope = body as { success?: boolean } | undefined;
    if (!queued || tracker.hidden || !envelope || envelope.success !== true) return json(body);
    deliverEmails([...tracker.ids], [...tracker.dedupeKeys])
      .then((results) => json({ ...(body as object), emails: forViewer(results, req.auth?.role === 'admin') }))
      .catch((err) => {
        logger.error({ err }, 'Immediate email delivery failed; the worker will retry');
        json({ ...(body as object), emails: [{ status: 'queued', error: 'Delivery will be retried automatically.' }] });
      });
    return res;
  };
  storage.run(tracker, () => next());
}
