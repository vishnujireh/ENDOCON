import { z } from 'zod';
import { db } from '../../db/knex.js';
import { Errors } from '../../lib/errors.js';
import { now } from '../../lib/time.js';
import { deliverEmails, deliveryStatus } from '../email/email.worker.js';

/**
 * Admin email log: every email the platform sent or tried to send (email_outbox), with its
 * delivery status and the provider's error. The message body/payload is never returned – it can
 * contain password-reset links.
 */
export const emailLogFiltersSchema = z.object({
  q: z.string().trim().max(254).optional(),
  status: z.enum(['sent', 'failed', 'retrying', 'scheduled', 'queued', 'skipped']).optional(),
  type: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type EmailLogFilters = z.infer<typeof emailLogFiltersSchema>;

function filtered(f: EmailLogFilters) {
  const q = db('email_outbox');
  if (f.q) q.where('to_email', 'like', `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (f.type) q.where('template', f.type);
  switch (f.status) {
    case 'sent':
      q.where('status', 'sent').where((w) => w.whereNull('last_error').orWhere('last_error', 'not like', 'skipped%'));
      break;
    case 'skipped':
      q.where('status', 'sent').where('last_error', 'like', 'skipped%');
      break;
    case 'failed':
      q.where('status', 'failed');
      break;
    case 'retrying':
      q.where('status', 'pending').where('attempts', '>', 0).whereNotNull('last_error');
      break;
    case 'scheduled':
      q.where('status', 'pending').where('send_after', '>', now()).where((w) => w.where('attempts', 0).orWhereNull('last_error'));
      break;
    case 'queued':
      q.where((w) => w.where('status', 'sending').orWhere((p) => p.where('status', 'pending').where('send_after', '<=', now()).where((x) => x.where('attempts', 0).orWhereNull('last_error'))));
      break;
  }
  return q;
}

export async function listEmailLog(f: EmailLogFilters) {
  const [{ n }] = await filtered(f).clone().count<{ n: number }[]>({ n: '*' });
  const rows = await filtered(f)
    .orderBy('id', 'desc')
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize)
    .select('id', 'to_email', 'template', 'status', 'attempts', 'last_error', 'send_after', 'sent_at', 'related_type', 'related_id', 'created_at');
  const counts = await db('email_outbox').select('status').count<{ status: string; n: number }[]>({ n: '*' }).groupBy('status');
  return {
    rows: rows.map((r) => ({
      id: r.id,
      to: r.to_email,
      type: r.template,
      ...deliveryStatus(r),
      attempts: r.attempts,
      related: r.related_type ? { type: r.related_type, id: r.related_id } : null,
      createdAt: r.created_at,
      sentAt: r.sent_at,
      nextAttemptAt: r.status === 'pending' ? r.send_after : null,
    })),
    total: Number(n),
    page: f.page,
    pageSize: f.pageSize,
    totals: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
  };
}

/** Sends a failed / waiting email again right now and returns the outcome. */
export async function retryEmail(id: number) {
  const row = await db('email_outbox').where({ id }).first('id', 'status', 'template');
  if (!row) throw Errors.notFound('Email not found.');
  if (row.template === 'reviewer_otp') throw Errors.conflict('Login codes cannot be resent from here – the reviewer can request a new code.', 'EMAIL_NOT_RETRYABLE');
  if (row.status === 'sent') throw Errors.conflict('This email was already sent.', 'EMAIL_ALREADY_SENT');
  if (row.status === 'sending') throw Errors.conflict('This email is being sent right now.', 'EMAIL_SENDING');
  await db('email_outbox').where({ id }).update({ status: 'pending', send_after: now() });
  const [result] = await deliverEmails([id]);
  return result;
}
