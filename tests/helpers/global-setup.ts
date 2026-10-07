import { execSync } from 'node:child_process';

/** Fresh schema + master data once per test run (runs the real migrations via tsx). */
export default function setup() {
  const env = { ...process.env, NODE_ENV: 'test', DB_NAME: process.env.TEST_DB_NAME || 'endocon_test' };
  execSync('npx tsx src/db/cli.ts fresh', { env, stdio: 'inherit' });
  execSync('npx tsx src/db/cli.ts seed', { env, stdio: 'inherit' });
}
