import { createRequire } from 'node:module';
import pino from 'pino';
import { env } from '../config/env.js';

/** Pretty console output in development – only if pino-pretty is installed (servers omit dev packages). */
function hasPrettyPrinter(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

/** Structured logger. Secrets and personal tokens are redacted. */
export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
      'req.headers["x-razorpay-signature"]',
      '*.password',
      '*.newPassword',
      '*.currentPassword',
      '*.token',
      '*.razorpay_signature',
      '*.password_hash',
    ],
    censor: '[redacted]',
  },
  transport:
    !env.isProduction && !env.isTest && hasPrettyPrinter()
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
      : undefined,
});
