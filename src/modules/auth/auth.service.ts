import { env } from '../../config/env.js';
import { db } from '../../db/knex.js';
import { burnPasswordCheck, hashPassword, randomToken, sha256Hex, verifyPassword } from '../../lib/crypto.js';
import { Errors } from '../../lib/errors.js';
import { addMinutes, now } from '../../lib/time.js';
import { enqueueEmail } from '../email/outbox.js';
import { revokeAllSessions } from './session.service.js';

export interface PublicUser {
  id: number;
  email: string;
  role: 'participant' | 'admin';
  fullName: string;
  title: string | null;
}

export async function getPublicUser(userId: number): Promise<PublicUser | null> {
  const row = await db('users as u')
    .leftJoin('user_profiles as p', 'p.user_id', 'u.id')
    .where('u.id', userId)
    .first('u.id', 'u.email', 'u.role', 'p.full_name', 'p.title');
  if (!row) return null;
  return { id: row.id, email: row.email, role: row.role, fullName: row.full_name ?? '', title: row.title ?? null };
}

export async function registerUser(input: {
  fullName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  password: string;
}): Promise<number> {
  const passwordHash = await hashPassword(input.password);
  try {
    return await db.transaction(async (trx) => {
      const [id] = await trx('users').insert({ email: input.email, password_hash: passwordHash, role: 'participant' });
      await trx('user_profiles').insert({
        user_id: id,
        full_name: input.fullName,
        phone_country_code: input.phoneCountryCode,
        phone_number: input.phoneNumber,
      });
      return id as number;
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      // Trade-off (documented): self-service signup without email verification must tell the
      // user to log in instead. Mitigated by rate limiting on this endpoint.
      throw Errors.conflict('An account with this email already exists. Please log in or reset your password.', 'EMAIL_TAKEN');
    }
    throw err;
  }
}

/** Returns the user id on success. Always the same generic error on failure. */
export async function authenticate(email: string, password: string, requiredRole: 'admin' | 'participant'): Promise<number> {
  const user = await db('users').where({ email }).first('id', 'password_hash', 'status', 'role');
  if (!user) {
    await burnPasswordCheck(password);
    throw invalidCredentials();
  }
  const valid = await verifyPassword(user.password_hash, password);
  if (!valid || user.status !== 'active' || user.role !== requiredRole) {
    throw invalidCredentials();
  }
  await db('users').where({ id: user.id }).update({ last_login_at: now() });
  return user.id;
}

function invalidCredentials() {
  return Errors.badRequest('Invalid email or password.', 'INVALID_CREDENTIALS');
}

export const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for this email, a password reset link has been sent. Please check your inbox (and spam folder).';

/** Never reveals whether the email exists. */
export async function requestPasswordReset(email: string, ip: string | undefined): Promise<void> {
  const user = await db('users as u')
    .leftJoin('user_profiles as p', 'p.user_id', 'u.id')
    .where('u.email', email)
    .where('u.status', 'active')
    .first('u.id', 'u.email', 'p.full_name');
  if (!user) return;

  const token = randomToken(32);
  const t = now();
  await db.transaction(async (trx) => {
    // Only the newest link is valid.
    await trx('password_reset_tokens').where({ user_id: user.id }).whereNull('used_at').update({ used_at: t });
    await trx('password_reset_tokens').insert({
      user_id: user.id,
      token_hash: sha256Hex(token),
      expires_at: addMinutes(t, env.PASSWORD_RESET_TTL_MINUTES),
      requested_ip: ip?.slice(0, 45) ?? null,
    });
    await enqueueEmail(trx, user.email, 'password_reset', {
      fullName: user.full_name || 'Participant',
      // Token in the URL fragment: never sent to servers or leaked via Referer.
      resetUrl: `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password#token=${encodeURIComponent(token)}`,
      expiresMinutes: env.PASSWORD_RESET_TTL_MINUTES,
    }, { related: { type: 'user', id: user.id } });
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const t = now();
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (trx) => {
    const row = await trx('password_reset_tokens as r')
      .join('users as u', 'u.id', 'r.user_id')
      .where('r.token_hash', sha256Hex(token))
      .whereNull('r.used_at')
      .where('r.expires_at', '>', t)
      .where('u.status', 'active')
      .forUpdate()
      .first('r.id', 'r.user_id', 'u.email');
    if (!row) {
      throw Errors.badRequest('This password reset link is invalid or has expired. Please request a new one.', 'INVALID_RESET_TOKEN');
    }
    await trx('users').where({ id: row.user_id }).update({ password_hash: passwordHash, password_changed_at: t });
    await trx('password_reset_tokens').where({ user_id: row.user_id }).whereNull('used_at').update({ used_at: t });
    await revokeAllSessions(trx, row.user_id);
    const profile = await trx('user_profiles').where({ user_id: row.user_id }).first('full_name');
    await enqueueEmail(trx, row.email, 'password_changed', { fullName: profile?.full_name || 'Participant' });
  });
}

export async function changePassword(userId: number, sessionId: number, current: string, next: string): Promise<void> {
  const user = await db('users').where({ id: userId }).first('password_hash', 'email');
  if (!user || !(await verifyPassword(user.password_hash, current))) {
    throw Errors.badRequest('Your current password is incorrect.', 'INVALID_CREDENTIALS');
  }
  const passwordHash = await hashPassword(next);
  await db.transaction(async (trx) => {
    await trx('users').where({ id: userId }).update({ password_hash: passwordHash, password_changed_at: now() });
    await revokeAllSessions(trx, userId, sessionId);
    const profile = await trx('user_profiles').where({ user_id: userId }).first('full_name');
    await enqueueEmail(trx, user.email, 'password_changed', { fullName: profile?.full_name || 'Participant' });
  });
}
