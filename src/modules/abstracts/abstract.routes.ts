import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { Errors } from '../../lib/errors.js';
import { asyncHandler, idParam, ok, parse } from '../../lib/http.js';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { abstractSubmitLimiter } from '../../middleware/rate-limit.js';
import { abstractSubmissionSchema, MAX_FILES, MAX_VIDEOS } from './abstract.schemas.js';
import {
  getMyAbstract,
  listMyAbstracts,
  readMyFile,
  resubmitAbstract,
  submissionWindow,
  submitAbstract,
  type UploadedFile,
} from './abstract.service.js';

/**
 * Abstract submission for logged-in delegates (the form is on the home page) and the author's
 * "My Abstracts" pages. Admins review under /api/admin/abstract-*.
 */
export const abstractsRouter = Router();

// Uploads go to a temporary folder next to the file store (videos can be hundreds of MB, so they are
// never held in memory) and are moved into storage once validated. Leftovers are always removed.
const tmpDir = path.resolve(env.STORAGE_LOCAL_DIR, 'tmp');
mkdirSync(tmpDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: tmpDir }),
  // The largest allowed file; per-type limits (documents/images vs video) are checked by the service.
  limits: { fileSize: Math.max(env.UPLOAD_MAX_MB, env.UPLOAD_MAX_VIDEO_MB) * 1024 * 1024, files: MAX_FILES, fields: 5, fieldSize: 200 * 1024 },
});
const uploadFiles = upload.array('files', MAX_FILES);

/** multipart/form-data: `data` = JSON with the abstract and authors; `files` = 1–5 files of any accepted type. */
function readSubmission(req: Request) {
  let json: unknown;
  try {
    json = JSON.parse(String(req.body?.data ?? ''));
  } catch {
    throw Errors.badRequest('The submission could not be read. Please refresh the page and try again.', 'INVALID_SUBMISSION');
  }
  const input = parse(abstractSubmissionSchema, json);
  const files: UploadedFile[] = ((req.files ?? []) as Express.Multer.File[]).map((f) => ({ originalname: f.originalname, path: f.path, size: f.size }));
  return { input, files };
}

/** Deletes the request's temporary upload files (those not moved into storage). */
async function cleanupUploads(req: Request) {
  await Promise.all(((req.files ?? []) as Express.Multer.File[]).map((f) => unlink(f.path).catch(() => undefined)));
}

/** Streams a stored file as a download. */
export function sendFile(res: Response, f: { stream: NodeJS.ReadableStream; size: number; name: string; mime: string }) {
  res.setHeader('Content-Type', f.mime);
  res.setHeader('Content-Length', String(f.size));
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);
  res.setHeader('Cache-Control', 'no-store');
  f.stream.pipe(res);
}

/** Whether submissions are open (public – the form shows a notice when closed). */
abstractsRouter.get('/window', (_req, res) =>
  ok(res, {
    ...submissionWindow(),
    // Shown on the form and checked in the browser before uploading (the server checks again).
    uploadLimits: { maxFiles: MAX_FILES, maxVideos: MAX_VIDEOS, maxDocumentMb: env.UPLOAD_MAX_MB, maxVideoMb: env.UPLOAD_MAX_VIDEO_MB },
  }),
);

abstractsRouter.post(
  '/submit',
  requireAuth,
  abstractSubmitLimiter,
  uploadFiles,
  asyncHandler(async (req, res) => {
    try {
      const { input, files } = readSubmission(req);
      const result = await submitAbstract(currentUserId(req), input, files);
      return ok(res, result, 'Your abstract has been submitted. A confirmation email is on its way.', 201);
    } finally {
      await cleanupUploads(req);
    }
  }),
);

abstractsRouter.get('/mine', requireAuth, asyncHandler(async (req, res) => ok(res, await listMyAbstracts(currentUserId(req)))));
abstractsRouter.get('/mine/:id', requireAuth, asyncHandler(async (req, res) => ok(res, await getMyAbstract(currentUserId(req), idParam(req)))));

abstractsRouter.post(
  '/mine/:id/resubmit',
  requireAuth,
  abstractSubmitLimiter,
  uploadFiles,
  asyncHandler(async (req, res) => {
    try {
      const { input, files } = readSubmission(req);
      const result = await resubmitAbstract(currentUserId(req), idParam(req), input, files);
      return ok(res, result, 'Your revised abstract has been resubmitted. A confirmation email is on its way.');
    } finally {
      await cleanupUploads(req);
    }
  }),
);

abstractsRouter.get(
  '/files/:fileId',
  requireAuth,
  asyncHandler(async (req, res) => {
    sendFile(res, await readMyFile(currentUserId(req), idParam(req, 'fileId')));
  }),
);
