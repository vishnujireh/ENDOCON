import { createInterface } from 'node:readline/promises';
import { db } from '../db/knex.js';
import { hashPassword } from '../lib/crypto.js';

/**
 * Create (or promote) an admin account.
 *   npm run admin:create -- admin@example.org "Full Name"
 * The password is read interactively so it never lands in shell history.
 */
async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  if (!email) throw new Error('Usage: npm run admin:create -- <email> "<full name>"');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question('Password (min 8 chars, letters + numbers): ');
  rl.close();
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password)) throw new Error('Weak password.');
  const normalized = email.trim().toLowerCase();
  const hash = await hashPassword(password);
  const existing = await db('users').where({ email: normalized }).first('id');
  if (existing) {
    await db('users').where({ id: existing.id }).update({ role: 'admin', password_hash: hash, status: 'active' });
    console.log(`Updated ${normalized} → admin`);
  } else {
    const [id] = await db('users').insert({ email: normalized, password_hash: hash, role: 'admin' });
    await db('user_profiles').insert({ user_id: id, full_name: nameParts.join(' ') || 'Admin' });
    console.log(`Created admin ${normalized}`);
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
