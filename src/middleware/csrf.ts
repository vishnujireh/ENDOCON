import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { safeEqual } from '../lib/crypto.js';
import { AppError } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOrigins(): Set<string> {
  const set = new Set<string>();
  for (const u of [...env.corsOrigins, env.APP_URL]) {
    try {
      set.add(new URL(u).origin);
    } catch {
      /* ignore malformed */
    }
  }
  return set;
}

/**
 * CSRF protection for state-changing requests:
 *  1. If an Origin (or Referer) header is present it must be one of our origins.
 *  2. Authenticated requests must carry X-CSRF-Token equal to the session's token
 *     (for /api/reviewer/* the reviewer session's token, checked in requireReviewer)
 *     (the token is only readable by our own frontend via /api/auth/me).
 * The session cookie is also SameSite=Lax. The payment webhook is mounted before this.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin') ?? (req.get('referer') ? safeOrigin(req.get('referer')!) : undefined);
  if (origin && !allowedOrigins().has(origin)) {
    return next(new AppError(403, 'CSRF_ORIGIN', 'Request origin not allowed.'));
  }

  // Reviewer routes use the reviewer session's own CSRF token (checked by requireReviewer), so a
  // browser that is also logged in as a delegate / admin is not blocked here.
  if (req.auth && !req.path.startsWith('/reviewer/')) {
    const header = req.get('x-csrf-token') ?? '';
    if (!header || !safeEqual(header, req.auth.csrfToken)) {
      return next(new AppError(403, 'CSRF_TOKEN', 'Your session security token is missing or expired. Please refresh the page.'));
    }
  }
  next();
}

function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
