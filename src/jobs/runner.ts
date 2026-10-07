import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { processEmailOutbox } from '../modules/email/email.worker.js';
import { reconcilePayments } from '../modules/payments/payment.service.js';

/**
 * Minimal in-process scheduler (no Redis needed). Each job never overlaps with itself.
 * Safe to run on several instances: the email worker uses SKIP LOCKED and settlement is idempotent.
 */
type Job = { name: string; everyMs: number; run: () => Promise<unknown> };

const timers: NodeJS.Timeout[] = [];

export function startJobs(): void {
  const jobs: Job[] = [
    { name: 'email-outbox', everyMs: env.EMAIL_WORKER_INTERVAL_SECONDS * 1000, run: processEmailOutbox },
    { name: 'payment-reconcile', everyMs: env.PAYMENT_RECONCILE_INTERVAL_SECONDS * 1000, run: () => reconcilePayments() },
  ];
  for (const job of jobs) {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await job.run();
      } catch (err) {
        logger.error({ err, job: job.name }, 'Background job failed');
      } finally {
        running = false;
      }
    };
    timers.push(setInterval(tick, job.everyMs));
    setTimeout(tick, 2000);
  }
  logger.info('Background jobs started');
}

export function stopJobs(): void {
  for (const t of timers.splice(0)) clearInterval(t);
}
