import type { Knex } from 'knex';
import argon2 from 'argon2';

/**
 * DEVELOPMENT-ONLY data. Skipped when NODE_ENV=production.
 *
 * - Admin: a local admin account. In production create admins with `npm run admin:create`.
 */
export async function seed(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;

  const email = (process.env.DEV_ADMIN_EMAIL || 'admin@endocon.local').toLowerCase();
  const password = process.env.DEV_ADMIN_PASSWORD || 'ChangeMe@2027';
  const existing = await knex('users').where({ email }).first('id');
  if (!existing) {
    const [id] = await knex('users').insert({
      email,
      password_hash: await argon2.hash(password, { type: argon2.argon2id }),
      role: 'admin',
      status: 'active',
    });
    await knex('user_profiles').insert({ user_id: id, full_name: 'ENDOCON Admin' });
  }
}
