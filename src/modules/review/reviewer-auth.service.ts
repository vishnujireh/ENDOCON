import { randomInt } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { db } from '../../db/knex.js';
import { randomToken, safeEqual, sha256Hex } from '../../lib/crypto.js';
import { AppError, Errors } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { addHours, addMinutes, now } from '../../lib/time.js';
import { getEmailProvider } from '../email/provider.js';
import { renderEmail } from '../email/templates.js';

/**
 * Reviewer (judge) authentication: emailed one-time code → reviewer session.
 * Reviewers are separate from user accounts and have their own cookie, so a judge can also be a
 * delegate in the same browser without the two sessions interfering.
 *
 * - Codes: 6 digits, stored only as a hash, valid REVIEWER_OTP_TTL_MINUTES, single use,
 *   cancelled after REVIEWER_OTP_MAX_ATTEMPTS wrong entries, and a new code can be requested only
 *   every REVIEWER_OTP_RESEND_SECONDS. Requesting a code never reveals whether the email is a reviewer.
 * - Sessions: random token in an httpOnly cookie (only its hash is stored) + a CSRF token.
 */

export const REVIEWER_COOKIE = `${env.SESSION_COOKIE_NAME}_rv`;
export const OTP_SENT_MESSAGE = 'If this email belongs to an active reviewer, a login code has been sent to it.';

const otpHash = (reviewerId: number, code: string) => sha256Hex(`reviewer-otp:${reviewerId}:${code}`);

function cookieOptions(expires: Date) {
  return { httpOnly: true, secure: env.cookieSecure, sameSite: 'lax' as const, path: '/', domain: env.COOKIE_DOMAIN || undefined, expires };
}

export interface ReviewerContext {
  sessionId: number;
  reviewerId: number;
  reviewerCode: string;
  name: string;
  email: string;
  csrfToken: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    reviewer?: ReviewerContext;
  }
}

/** Sends a login code. Always resolves the same way whether or not the email is a reviewer. */
export async function requestOtp(email: string, ip: string | undefined): Promise<void> {
  const reviewer = await db('reviewers').where({ email, status: 'active' }).first('id', 'name', 'email');
  if (!reviewer) return;

  const t = now();
  const last = await db('reviewer_otps').where({ reviewer_id: reviewer.id }).orderBy('id', 'desc').first('created_at');
  // Resend cooldown – silently ignored (same response) so it cannot be used to probe emails.
  if (last && new Date(last.created_at).getTime() > t.getTime() - env.REVIEWER_OTP_RESEND_SECONDS * 1000) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.transaction(async (trx) => {
    // Only the newest code is valid.
    await trx('reviewer_otps').where({ reviewer_id: reviewer.id }).whereNull('verified_at').whereNull('invalidated_at').update({ invalidated_at: t });
    await trx('reviewer_otps').insert({
      reviewer_id: reviewer.id,
      otp_hash: otpHash(reviewer.id, code),
      expires_at: addMinutes(t, env.REVIEWER_OTP_TTL_MINUTES),
      requested_ip: ip?.slice(0, 45) ?? null,
      created_at: t,
    });
  });

  // Sent straight away (not through the outbox) so the code is never stored in plain text.
  const mail = renderEmail('reviewer_otp', { name: reviewer.name, code, expiresMinutes: env.REVIEWER_OTP_TTL_MINUTES });
  let error: string | null = null;
  try {
    await getEmailProvider().send({ to: reviewer.email, ...mail });
  } catch (err) {
    error = String((err as Error).message).slice(0, 1000);
    logger.error({ err, reviewerId: reviewer.id }, 'Could not send reviewer login code');
  }
  // Recorded for the admin email log only – without the code (the payload stays empty).
  await db('email_outbox')
    .insert({
      to_email: reviewer.email,
      template: 'reviewer_otp',
      payload: '{}',
      status: error ? 'failed' : 'sent',
      attempts: 1,
      last_error: error,
      sent_at: error ? null : now(),
      related_type: 'reviewer',
      related_id: String(reviewer.id),
    })
    .catch((err) => logger.error({ err }, 'Could not log reviewer login code email'));
}

const INVALID_CODE = () => new AppError(401, 'INVALID_OTP', 'The code is incorrect or has expired. Please check it or request a new code.');

/** Verifies the code and starts a reviewer session. */
export async function verifyOtp(req: Request, res: Response, email: string, code: string): Promise<{ reviewer: PublicReviewer; csrfToken: string }> {
  const t = now();
  const result = await db.transaction(async (trx) => {
    const reviewer = await trx('reviewers').where({ email, status: 'active' }).first('id');
    if (!reviewer) return { ok: false as const };
    const otp = await trx('reviewer_otps')
      .where({ reviewer_id: reviewer.id })
      .whereNull('verified_at')
      .whereNull('invalidated_at')
      .where('expires_at', '>', t)
      .orderBy('id', 'desc')
      .forUpdate()
      .first();
    if (!otp) return { ok: false as const };
    if (!safeEqual(otp.otp_hash, otpHash(reviewer.id, code))) {
      const attempts = Number(otp.attempt_count) + 1;
      await trx('reviewer_otps')
        .where({ id: otp.id })
        .update({ attempt_count: attempts, ...(attempts >= env.REVIEWER_OTP_MAX_ATTEMPTS ? { invalidated_at: t } : {}) });
      return { ok: false as const };
    }
    await trx('reviewer_otps').where({ id: otp.id }).update({ verified_at: t }); // single use
    return { ok: true as const, reviewerId: reviewer.id as number };
  });
  if (!result.ok) throw INVALID_CODE();

  // New session (rotate whatever reviewer session this browser presented).
  const presented = req.cookies?.[REVIEWER_COOKIE];
  if (typeof presented === 'string' && presented) await db('reviewer_sessions').where({ token_hash: sha256Hex(presented) }).update({ revoked_at: t });
  const token = randomToken(32);
  const csrfToken = randomToken(32);
  const expiresAt = addHours(t, env.REVIEWER_SESSION_TTL_HOURS);
  await db('reviewer_sessions').insert({
    reviewer_id: result.reviewerId,
    token_hash: sha256Hex(token),
    csrf_token: csrfToken,
    ip: req.ip?.slice(0, 45) ?? null,
    user_agent: req.get('user-agent')?.slice(0, 255) ?? null,
    last_seen_at: t,
    expires_at: expiresAt,
    created_at: t,
  });
  res.cookie(REVIEWER_COOKIE, token, cookieOptions(expiresAt));
  return { reviewer: (await publicReviewer(result.reviewerId))!, csrfToken };
}

export interface PublicReviewer {
  id: number;
  reviewerCode: string;
  name: string;
  email: string;
}

async function publicReviewer(id: number): Promise<PublicReviewer | null> {
  const r = await db('reviewers').where({ id }).first('id', 'reviewer_code', 'name', 'email');
  return r ? { id: r.id, reviewerCode: r.reviewer_code, name: r.name, email: r.email } : null;
}

/** Attaches req.reviewer when a valid reviewer session cookie is present. */
export async function loadReviewer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[REVIEWER_COOKIE];
    if (typeof token === 'string' && token.length >= 20 && token.length <= 100) {
      const t = now();
      const row = await db('reviewer_sessions as s')
        .join('reviewers as r', 'r.id', 's.reviewer_id')
        .where('s.token_hash', sha256Hex(token))
        .whereNull('s.revoked_at')
        .where('s.expires_at', '>', t)
        .where('r.status', 'active') // deactivating a reviewer ends their sessions immediately
        .first('s.id as sessionId', 's.reviewer_id as reviewerId', 's.csrf_token as csrfToken', 'r.reviewer_code', 'r.name', 'r.email');
      if (row) {
        req.reviewer = { sessionId: row.sessionId, reviewerId: row.reviewerId, reviewerCode: row.reviewer_code, name: row.name, email: row.email, csrfToken: row.csrfToken };
      } else {
        res.clearCookie(REVIEWER_COOKIE, { path: '/', domain: env.COOKIE_DOMAIN || undefined });
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Reviewer-only routes: a valid reviewer session, and the reviewer CSRF token on every change. */
export function requireReviewer(req: Request, _res: Response, next: NextFunction): void {
  if (!req.reviewer) return next(new AppError(401, 'REVIEWER_UNAUTHORIZED', 'Please log in as a reviewer to continue.'));
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const header = req.get('x-csrf-token') ?? '';
    if (!header || !safeEqual(header, req.reviewer.csrfToken)) {
      return next(new AppError(403, 'CSRF_TOKEN', 'Your session security token is missing or expired. Please refresh the page.'));
    }
  }
  next();
}

export function currentReviewerId(req: Request): number {
  if (!req.reviewer) throw Errors.unauthorized();
  return req.reviewer.reviewerId;
}

export async function logoutReviewer(req: Request, res: Response): Promise<void> {
  if (req.reviewer) await db('reviewer_sessions').where({ id: req.reviewer.sessionId }).update({ revoked_at: now() });
  res.clearCookie(REVIEWER_COOKIE, { path: '/', domain: env.COOKIE_DOMAIN || undefined });
}

export async function revokeReviewerSessions(reviewerId: number): Promise<void> {
  await db('reviewer_sessions').where({ reviewer_id: reviewerId }).whereNull('revoked_at').update({ revoked_at: now() });
}
