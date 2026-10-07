import { db } from './knex.js';

/** Thin wrapper so migrations/seeds work identically from TS (dev) and compiled JS (prod). */
async function main(): Promise<void> {
  const cmd = process.argv[2];
  try {
    if (cmd === 'migrate') {
      const [batch, files] = await db.migrate.latest();
      console.log(files.length ? `Batch ${batch}: ${files.join(', ')}` : 'Already up to date.');
    } else if (cmd === 'rollback') {
      const [batch, files] = await db.migrate.rollback();
      console.log(files.length ? `Rolled back batch ${batch}: ${files.join(', ')}` : 'Nothing to roll back.');
    } else if (cmd === 'fresh') {
      // Drop EVERY table in the configured database and re-migrate. Refused in production.
      // (Drops tables directly instead of rolling back, so it also works after migrations changed.)
      if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run "fresh" in production.');
      const [rows] = await db.raw('SELECT table_name AS t, table_type AS k FROM information_schema.tables WHERE table_schema = DATABASE()');
      await db.raw('SET FOREIGN_KEY_CHECKS = 0');
      for (const r of rows as { t: string; k: string }[]) await db.raw(r.k === 'VIEW' ? 'DROP VIEW IF EXISTS ??' : 'DROP TABLE IF EXISTS ??', [r.t]);
      await db.raw('SET FOREIGN_KEY_CHECKS = 1');
      const [, files] = await db.migrate.latest();
      console.log(`Re-created schema: ${files.length} migrations`);
    } else if (cmd === 'seed') {
      const [files] = await db.seed.run();
      console.log(`Seeded: ${files.map((f) => f.split(/[\\/]/).pop()).join(', ')}`);
    } else {
      console.error('Usage: cli.ts <migrate|rollback|fresh|seed>');
      process.exitCode = 1;
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
