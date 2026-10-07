import type { NextFunction, Request, Response } from 'express';
import { Errors } from '../lib/errors.js';
import { resolveSession, type SessionContext } from '../modules/auth/session.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: SessionContext;
  }
}

/** Attaches req.auth when a valid session cookie is present. Never rejects. */
export async function loadSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    req.auth = (await resolveSession(req, res)) ?? undefined;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) return next(Errors.unauthorized());
  next();
}

export function requireRole(role: 'admin') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(Errors.unauthorized());
    if (req.auth.role !== role) return next(Errors.forbidden());
    next();
  };
}

/** The authenticated user id. The user id is NEVER taken from the request body/query. */
export function currentUserId(req: Request): number {
  if (!req.auth) throw Errors.unauthorized();
  return req.auth.userId;
}
