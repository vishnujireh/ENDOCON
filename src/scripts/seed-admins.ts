import { z } from 'zod';
import { env } from '../config/env.js';
import { db } from '../db/knex.js';
import { hashPassword } from '../lib/crypto.js';
import { now } from '../lib/time.js';
import { passwordSchema } from '../modules/auth/auth.schemas.js';
import { revokeAllSessions } from '../modules/auth/session.service.js';

/**
 * Creates / updates the admin accounts listed in .env (same idea as LTSICON):
 *
 *   ADMIN_EMAILS=endocon2027@gmail.com,another@org.in
 *   ADMIN_DEFAULT_PASSWORD=…
 *
 *   npm run seed-admins          (dev)
 *   npm run seed-admins:prod     (server, compiled)
 *
 * For each email: a new admin account is created, or an existing account (e.g. one that signed up
 * normally) becomes an admin. The password is set to ADMIN_DEFAULT_PASSWORD and the account's open
 * sessions are ended – so changing the value and re-running the seed rotates the admin password.
 * Accounts that are no longer listed are NOT demoted automatically.
 */
async function main() {
  const emails = env.adminEmails;
  if (!emails.length) throw new Error('ADMIN_EMAILS is empty in .env – nothing to do.');
  const bad = emails.filter((e) => !z.email().safeParse(e).success);
  if (bad.length) throw new Error(`Not valid email addresses in ADMIN_EMAILS: ${bad.join(', ')}`);

  const password = env.ADMIN_DEFAULT_PASSWORD ?? '';
  const check = passwordSchema.safeParse(password);
  if (!check.success) throw new Error(`ADMIN_DEFAULT_PASSWORD: ${check.error.issues[0].message}`);

  const hash = await hashPassword(password);
  for (const email of emails) {
    await db.transaction(async (trx) => {
      const user = await trx('users').where({ email }).first('id', 'role');
      if (user) {
        await trx('users').where({ id: user.id }).update({ role: 'admin', password_hash: hash, status: 'active' });
        await revokeAllSessions(trx, user.id);
        console.log(`Updated  ${email}${user.role === 'admin' ? '' : ` (was ${user.role}, now admin)`}`);
      } else {
        const [id] = await trx('users').insert({ email, password_hash: hash, role: 'admin', status: 'active' });
        await trx('user_profiles').insert({ user_id: id, full_name: 'ENDOCON Admin' });
        console.log(`Created  ${email}`);
      }
      await trx('audit_logs').insert({
        actor_user_id: null,
        action: 'admin.seeded',
        entity_type: 'user',
        entity_id: email,
        after: JSON.stringify({ role: 'admin', passwordSetFrom: 'ADMIN_DEFAULT_PASSWORD', at: now().toISOString() }),
      });
    });
  }
  console.log(`\n${emails.length} admin account(s) ready. Sign in at ${env.FRONTEND_URL.replace(/\/$/, '')}/admin`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
