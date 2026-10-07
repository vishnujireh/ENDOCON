import { createApp } from './app.js';
import { env } from './config/env.js';
import { db } from './db/knex.js';
import { startJobs, stopJobs } from './jobs/runner.js';
import { logger } from './lib/logger.js';
import { catalogue, catalogueFilePath } from './modules/catalogue/catalogue.js';

// Fail fast on a missing / invalid catalogue file rather than at the first checkout.
try {
  const c = catalogue();
  logger.info(`Catalogue loaded from ${catalogueFilePath()} (${c.categories.length} categories, ${c.workshops.length} workshops, ${c.accommodation.length} room types)`);
} catch (e) {
  // eslint-disable-next-line no-console
  console.error((e as Error).message);
  process.exit(1);
}

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`ENDOCON API listening on :${env.PORT} (${env.NODE_ENV}, gateway=${env.PAYMENT_GATEWAY}, email=${env.EMAIL_TRANSPORT})`);
});
// Abstract videos can be up to UPLOAD_MAX_VIDEO_MB: allow slow connections up to an hour per request
// (Node's default cuts every request off after 5 minutes).
server.requestTimeout = 60 * 60 * 1000;

// Warn loudly when the database is behind the code (e.g. `npm run migrate` was not run after an update):
// requests touching new columns would otherwise fail with a generic "Something went wrong".
db.migrate
  .list()
  .then(([, pending]: [unknown[], (string | { file?: string; name?: string })[]]) => {
    if (pending.length) {
      logger.error(
        `Database is NOT up to date – ${pending.length} migration(s) pending: ${pending.map((m) => (typeof m === 'string' ? m : (m.file ?? m.name))).join(', ')}. ` +
          'Stop the server, run "npm run migrate", then start it again.',
      );
    }
  })
  .catch((e: unknown) => logger.error({ err: e }, 'Could not check database migrations'));

if (env.RUN_JOBS) startJobs();

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  stopJobs();
  server.close(async () => {
    await db.destroy();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
