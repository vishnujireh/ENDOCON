import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { db, type DbOrTrx } from '../../db/knex.js';
import { randomToken, sha256Hex } from '../../lib/crypto.js';
import { addHours, addMinutes, now } from '../../lib/time.js';

export interface SessionContext {
  sessionId: number;
  userId: number;
  role: 'participant' | 'admin';
  email: string;
  csrfToken: string;
}

const SLIDE_EVERY_MINUTES = 5;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax' as const,
    path: '/',
    domain: env.COOKIE_DOMAIN || undefined,
    expires,
  };
}

/** Create a new session (rotating any presented token) and set the cookie. */
export async function createSession(req: Request, res: Response, userId: number): Promise<{ csrfToken: string }> {
  const token = randomToken(32);
  const csrfToken = randomToken(32);
  const t = now();
  const expiresAt = addHours(t, env.SESSION_TTL_HOURS);
  const absoluteExpiresAt = addHours(t, env.SESSION_ABSOLUTE_TTL_HOURS);

  // Session fixation defence: revoke whatever session this browser presented.
  const presented = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (typeof presented === 'string' && presented) {
    await db('sessions').where({ token_hash: sha256Hex(presented) }).update({ revoked_at: t });
  }

  await db('sessions').insert({
    user_id: userId,
    token_hash: sha256Hex(token),
    csrf_token: csrfToken,
    ip: req.ip?.slice(0, 45) ?? null,
    user_agent: req.get('user-agent')?.slice(0, 255) ?? null,
    last_seen_at: t,
    expires_at: expiresAt,
    absolute_expires_at: absoluteExpiresAt,
  });

  res.cookie(env.SESSION_COOKIE_NAME, token, cookieOptions(expiresAt < absoluteExpiresAt ? expiresAt : absoluteExpiresAt));
  return { csrfToken };
}

/** Resolve the session from the cookie; slides the idle expiry. Returns null when invalid. */
export async function resolveSession(req: Request, res: Response): Promise<SessionContext | null> {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;

  const t = now();
  const row = await db('sessions as s')
    .join('users as u', 'u.id', 's.user_id')
    .where('s.token_hash', sha256Hex(token))
    .whereNull('s.revoked_at')
    .where('s.expires_at', '>', t)
    .where('s.absolute_expires_at', '>', t)
    .where('u.status', 'active')
    .first(
      's.id as sessionId',
      's.user_id as userId',
      's.csrf_token as csrfToken',
      's.last_seen_at as lastSeenAt',
      's.absolute_expires_at as absoluteExpiresAt',
      'u.role',
      'u.email',
    );

  if (!row) {
    res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/', domain: env.COOKIE_DOMAIN || undefined });
    return null;
  }

  if (new Date(row.lastSeenAt) < addMinutes(t, -SLIDE_EVERY_MINUTES)) {
    const idle = addHours(t, env.SESSION_TTL_HOURS);
    const absolute = new Date(row.absoluteExpiresAt);
    const expiresAt = idle < absolute ? idle : absolute;
    await db('sessions').where({ id: row.sessionId }).update({ last_seen_at: t, expires_at: expiresAt });
    res.cookie(env.SESSION_COOKIE_NAME, token, cookieOptions(expiresAt));
  }

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    role: row.role,
    email: row.email,
    csrfToken: row.csrfToken,
  };
}

export async function revokeSession(sessionId: number): Promise<void> {
  await db('sessions').where({ id: sessionId }).update({ revoked_at: now() });
}

export async function revokeAllSessions(conn: DbOrTrx, userId: number, exceptSessionId?: number): Promise<void> {
  const q = conn('sessions').where({ user_id: userId }).whereNull('revoked_at');
  if (exceptSessionId) q.whereNot({ id: exceptSessionId });
  await q.update({ revoked_at: now() });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/', domain: env.COOKIE_DOMAIN || undefined });
}
