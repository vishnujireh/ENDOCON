import { rateLimit, ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';

/**
 * In-memory rate limiting. For multiple API instances behind a load balancer,
 * plug in a shared store (e.g. rate-limit-redis) here.
 */
function limiter(opts: Partial<Options>) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.isTest && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== 'true',
    handler: (_req, res) => {
      res.status(429).json({ success: false, code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' });
    },
    ...opts,
  });
}

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? '0.0.0.0');

export const loginLimiter = limiter({
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req) => `${ipKey(req)}:${String(req.body?.email ?? '').toLowerCase().slice(0, 254)}`,
});

export const loginIpLimiter = limiter({ windowMs: 15 * 60_000, limit: 50, keyGenerator: ipKey });
export const registerLimiter = limiter({ windowMs: 60 * 60_000, limit: 20, keyGenerator: ipKey });
export const forgotPasswordLimiter = limiter({ windowMs: 60 * 60_000, limit: 5, keyGenerator: ipKey });
export const resetPasswordLimiter = limiter({ windowMs: 15 * 60_000, limit: 10, keyGenerator: ipKey });
export const checkoutLimiter = limiter({
  windowMs: 10 * 60_000,
  limit: 30,
  keyGenerator: (req) => (req.auth ? `u:${req.auth.userId}` : ipKey(req)),
});
export const apiLimiter = limiter({ windowMs: 60_000, limit: 300, keyGenerator: ipKey });
/** Abstract submission / resubmission: at most 15 per hour per account. */
export const abstractSubmitLimiter = limiter({
  windowMs: 60 * 60_000,
  limit: 15,
  keyGenerator: (req) => (req.auth ? `u:${req.auth.userId}` : ipKey(req)),
});
