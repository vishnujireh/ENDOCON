import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { Errors } from './errors.js';

/** Consistent success envelope: { success: true, message, data }. */
export function ok<T>(res: Response, data: T, message = 'OK', status = 200): Response {
  return res.status(status).json({ success: true, message, data });
}

/** Wrap async handlers so rejections reach the error middleware. */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next);
  };
}

/** Parse + validate input with a zod schema; throws a 422 with field errors. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw Errors.validation(fields);
  }
  return result.data;
}

/** Positive integer route parameter. */
export function idParam(req: Request, name = 'id'): number {
  const raw = req.params[name];
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) throw Errors.notFound();
  return n;
}
