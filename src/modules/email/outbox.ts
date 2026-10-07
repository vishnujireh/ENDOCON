import type { DbOrTrx } from '../../db/knex.js';
import { trackQueuedEmail } from './email-tracker.js';
import type { EmailTemplateName, EmailTemplatePayloads } from './templates.js';

export interface EnqueueOptions {
  related?: { type: string; id: string | number };
  /** Prevents the same logical email being queued twice (e.g. webhook + verify both settling). */
  dedupeKey?: string;
  sendAfter?: Date;
}

/**
 * Queue an email. Call with the same transaction as the business change so the email is sent
 * if and only if the change commits (transactional outbox).
 */
export async function enqueueEmail<T extends EmailTemplateName>(
  conn: DbOrTrx,
  to: string,
  template: T,
  payload: EmailTemplatePayloads[T],
  opts: EnqueueOptions = {},
): Promise<void> {
  const row = {
    to_email: to,
    template,
    payload: JSON.stringify(payload),
    related_type: opts.related?.type ?? null,
    related_id: opts.related ? String(opts.related.id) : null,
    dedupe_key: opts.dedupeKey ?? null,
    ...(opts.sendAfter ? { send_after: opts.sendAfter } : {}),
  };
  // insertId is 0 when an identical (dedupe_key) email was queued before – then track it by key.
  const [id] = opts.dedupeKey
    ? await conn('email_outbox').insert(row).onConflict('dedupe_key').ignore()
    : await conn('email_outbox').insert(row);
  trackQueuedEmail(Number(id) || null, opts.dedupeKey ?? null);
}
