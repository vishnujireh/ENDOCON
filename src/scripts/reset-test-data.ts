import { createInterface } from 'node:readline/promises';
import { appendFile, cp, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Knex } from 'knex';
import { env } from '../config/env.js';
import { db } from '../db/knex.js';

/**
 * Removes ALL participant / test data before go-live and restarts the numbering, keeping:
 *   - admin accounts (users.role = 'admin') with their profiles and sessions,
 *   - the scoring criteria (review_criteria),
 *   - the migrations table.
 * Conference / workshop / accommodation prices live in shared/catalogue.json, not in the database,
 * so they are not touched.
 *
 *   npm run data:reset-test            (dev, TypeScript)
 *   npm run data:reset-test:prod       (server, compiled)
 *
 * Without --confirm it only REPORTS what would be deleted. With --confirm it:
 *   1. writes a restorable SQL backup of every row it is about to delete
 *      (backups/test-data-reset-<timestamp>/backup.sql),
 *   2. asks you to type the database name,
 *   3. deletes everything in ONE transaction (all or nothing),
 *   4. moves everything in the upload storage folder (abstract files, invoice PDFs) into the backup folder,
 *   5. clears the number sequences so Order IDs, invoices, abstracts and reviewer codes start at 0001.
 */

/** Tables emptied completely (children first). */
const CLEAR_ALL = [
  'payment_events',
  'email_outbox',
  'invoices',
  'order_accompanying_persons',
  'order_accommodations',
  'order_workshops',
  'conference_registrations',
  'payment_items',
  'payments',
  'orders',
  'judge_review_scores',
  'judge_reviews',
  'abstract_assignments',
  'reviewer_sessions',
  'reviewer_otps',
  'reviewers',
  'abstract_reviews',
  'abstract_versions',
  'abstract_files',
  'abstract_authors',
  'abstracts',
  'audit_logs',
  'sequences',
];

/** Tables where only non-admin rows are removed: [table, where-clause builder]. */
const ADMINS = () => db('users').where({ role: 'admin' }).select('id');
const PARTIAL: [string, (q: Knex.QueryBuilder) => Knex.QueryBuilder][] = [
  ['sessions', (q) => q.whereNotIn('user_id', ADMINS())],
  ['password_reset_tokens', (q) => q.whereNotIn('user_id', ADMINS())],
  ['user_profiles', (q) => q.whereNotIn('user_id', ADMINS())],
  ['users', (q) => q.whereNot({ role: 'admin' })],
];

const KEPT = ['users (admins)', 'user_profiles (admins)', 'review_criteria', 'knex_migrations'];

async function existingTables(): Promise<Set<string>> {
  const [rows] = await db.raw("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'");
  return new Set((rows as { t: string }[]).map((r) => r.t));
}

/** Rows as raw strings (exact DATETIME / JSON / DECIMAL text), Buffers for binary columns. */
async function rawRows(table: string, filter?: (q: Knex.QueryBuilder) => Knex.QueryBuilder) {
  const q = filter ? filter(db(table).select('*')) : db(table).select('*');
  return (await q.options({
    typeCast(field: { type: string; buffer(): Buffer | null; string(): string | null }) {
      if (['BLOB', 'TINY_BLOB', 'MEDIUM_BLOB', 'LONG_BLOB', 'GEOMETRY', 'BIT'].includes(field.type)) return field.buffer();
      // JSON arrives with the binary charset – decode it as UTF-8 ourselves (₹, –, accented names).
      if (field.type === 'JSON') return field.buffer()?.toString('utf8') ?? null;
      return field.string();
    },
  })) as Record<string, unknown>[];
}

async function count(table: string, filter?: (q: Knex.QueryBuilder) => Knex.QueryBuilder): Promise<number> {
  const q = filter ? filter(db(table)) : db(table);
  const [r] = await q.count<{ n: number }[]>({ n: '*' });
  return Number(r.n);
}

function fmtInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Moves everything in the upload storage folder (abstract files, invoice PDFs) except tmp/
 * into the backup folder – with no participant data left, every stored file is test data.
 */
async function moveStorage(destRoot: string): Promise<number> {
  const root = path.resolve(env.STORAGE_LOCAL_DIR);
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return 0;
  }
  let files = 0;
  const countFiles = async (p: string): Promise<number> => {
    const s = await stat(p);
    if (!s.isDirectory()) return 1;
    let n = 0;
    for (const e of await readdir(p)) n += await countFiles(path.join(p, e));
    return n;
  };
  await mkdir(destRoot, { recursive: true });
  for (const e of entries) {
    if (e === 'tmp') continue; // the running app's upload scratch folder – must stay in place
    const src = path.join(root, e);
    files += await countFiles(src);
    try {
      await rename(src, path.join(destRoot, e));
    } catch {
      // Different disk: copy then remove.
      await cp(src, path.join(destRoot, e), { recursive: true });
      await rm(src, { recursive: true, force: true });
    }
  }
  return files;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const tables = await existingTables();
  const clearAll = CLEAR_ALL.filter((t) => tables.has(t));
  const partial = PARTIAL.filter(([t]) => tables.has(t));

  console.log(`\nDatabase: ${env.DB_NAME} on ${env.DB_HOST}:${env.DB_PORT}  (NODE_ENV=${env.NODE_ENV})`);
  console.log(`Storage:  ${path.resolve(env.STORAGE_LOCAL_DIR)}\n`);

  // ---- Report ----
  const counts: [string, number][] = [];
  for (const t of clearAll) counts.push([t, await count(t)]);
  for (const [t, f] of partial) counts.push([`${t} (non-admin)`, await count(t, f)]);
  const total = counts.reduce((s, [, n]) => s + n, 0);
  console.log('Rows that will be DELETED:');
  for (const [t, n] of counts) if (n) console.log(`  ${t.padEnd(32)} ${n}`);
  if (!total) console.log('  (nothing – the database has no participant data)');

  const admins = await db('users').where({ role: 'admin' }).select('email');
  console.log(`\nKept: ${KEPT.join(', ')}`);
  console.log(`Admin accounts kept (${admins.length}): ${admins.map((a) => a.email).join(', ') || 'NONE'}`);
  if (tables.has('review_criteria')) console.log(`Scoring criteria kept: ${await count('review_criteria')}`);

  const [paid] = tables.has('payments')
    ? await db('payments').where({ status: 'success' }).select(db.raw('COUNT(*) AS n'), db.raw('COALESCE(SUM(total_minor),0) AS amt'))
    : [{ n: 0, amt: 0 }];
  if (Number(paid.n)) {
    console.log(`\n⚠  ${paid.n} SUCCESSFUL payment(s) totalling ${fmtInr(Number(paid.amt) / 100)} will be deleted, with their invoices.`);
    console.log('   Make sure every one of them is a test payment. (Records at the payment gateway are not affected.)');
    const list = await db('payments as p')
      .join('orders as o', 'o.id', 'p.order_id')
      .join('users as u', 'u.id', 'p.user_id')
      .where('p.status', 'success')
      .orderBy('p.id')
      .select('o.order_number', 'u.email', 'p.total_minor', 'p.gateway_payment_id', 'p.paid_at');
    for (const p of list) console.log(`   - ${p.order_number}  ${p.email}  ${fmtInr(Number(p.total_minor) / 100)}  ${p.gateway_payment_id ?? ''}`);
  }
  if (!admins.length) {
    console.error('\nNo admin account exists – refusing to continue (you would be locked out). Create one with admin:create first.');
    process.exitCode = 1;
    return;
  }

  if (!confirm) {
    console.log('\nDry run only – nothing was changed. Run again with --confirm to delete.\n');
    return;
  }
  if (!total) return;

  // ---- Backup (before anything is changed) ----
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve('backups', `test-data-reset-${stamp}`);
  await mkdir(backupDir, { recursive: true });
  const sqlFile = path.join(backupDir, 'backup.sql');
  await writeFile(sqlFile, `-- ENDOCON test-data reset backup ${new Date().toISOString()} – database ${env.DB_NAME}\n-- Restore: mysql ${env.DB_NAME} < backup.sql\nSET NAMES utf8mb4;\nSET time_zone = '+00:00';\nSET FOREIGN_KEY_CHECKS = 0;\n`);
  const backupTable = async (t: string, f?: (q: Knex.QueryBuilder) => Knex.QueryBuilder) => {
    const rows = await rawRows(t, f);
    for (let i = 0; i < rows.length; i += 200) await appendFile(sqlFile, `${db(t).insert(rows.slice(i, i + 200)).toString()};\n`);
    return rows.length;
  };
  for (const t of clearAll) await backupTable(t);
  for (const [t, f] of partial) await backupTable(t, f);
  await appendFile(sqlFile, 'SET FOREIGN_KEY_CHECKS = 1;\n');
  console.log(`\nBackup written: ${sqlFile}`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = (await rl.question(`\nThis permanently deletes the rows listed above.\nType the database name (${env.DB_NAME}) to continue: `)).trim();
  rl.close();
  if (typed !== env.DB_NAME) {
    console.log('Name did not match – nothing was deleted. (The backup file can be removed.)');
    return;
  }

  // ---- Delete (one transaction: all or nothing) ----
  await db.transaction(async (trx) => {
    await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const t of clearAll) await trx(t).del();
      for (const [t, f] of partial) await f(trx(t)).del();
    } finally {
      await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
    }
  });
  // Internal ids restart too (DDL, so after the transaction). The audit trail gets one entry.
  for (const t of clearAll) await db.raw('ALTER TABLE ?? AUTO_INCREMENT = 1', [t]);
  await db('audit_logs').insert({
    actor_user_id: null,
    action: 'data.test_reset',
    entity_type: 'system',
    entity_id: 'test-data',
    after: JSON.stringify({ deleted: Object.fromEntries(counts.filter(([, n]) => n)), backup: path.basename(backupDir) }),
  });
  console.log('Database cleared. Numbering restarts at 0001.');

  // ---- Files ----
  const moved = await moveStorage(path.join(backupDir, 'files'));
  console.log(`Moved ${moved} stored file(s) (abstract uploads, invoice PDFs) to ${path.join(backupDir, 'files')}`);
  console.log('\nDone. Keep the backup folder until you are sure, then delete it (it contains personal data).\n');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
