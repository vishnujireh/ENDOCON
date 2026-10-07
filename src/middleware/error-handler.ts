import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Not found.' });
}

/** Consistent error envelope; internal details are logged, never returned. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, path: req.path }, err.message);
    res.status(err.status).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { errors: err.details } : {}),
    });
    return;
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `A file is too large. Videos can be up to ${env.UPLOAD_MAX_VIDEO_MB} MB; documents and images up to ${env.UPLOAD_MAX_MB} MB.`
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Too many files. Please upload at most 5 files.'
          : 'Invalid file upload.';
    res.status(400).json({ success: false, code: 'UPLOAD_ERROR', message });
    return;
  }

  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, code: 'INVALID_JSON', message: 'Malformed JSON body.' });
    return;
  }
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large.' });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong on our side. Please try again.',
  });
}
