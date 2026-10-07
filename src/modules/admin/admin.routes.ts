import { Router, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, idParam, ok, parse } from '../../lib/http.js';
import { currentUserId, requireRole } from '../../middleware/auth.js';
import { readFile } from '../abstracts/abstract.service.js';
import { sendFile } from '../abstracts/abstract.routes.js';
import { abstractReviewSchema } from '../abstracts/abstract.schemas.js';
import { adminReviewRouter } from '../review/review.routes.js';
import {
  abstractFiltersSchema,
  exportAbstractsCsv,
  getAbstractForAdmin,
  listAbstractAuthors,
  listUserAbstracts,
  reviewAbstract,
} from './admin.abstracts.service.js';
import {
  adminProfileEditSchema,
  editRegistrationProfile,
  exportRegistrationsCsv,
  getRegistrationDetail,
  getStats,
  listRegistrations,
  registrationFiltersSchema,
  resendConfirmation,
} from './admin.registrations.service.js';
import { emailLogFiltersSchema, listEmailLog, retryEmail } from './admin.emails.service.js';

/** Everything under /api/admin requires an authenticated admin (role-based). */
export const adminRouter = Router();
adminRouter.use(requireRole('admin'));
adminRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

const stamp = () => new Date().toISOString().slice(0, 10);

// ---- Online abstract review: reviewers, criteria, assignment, monitoring, Excel export ----
adminRouter.use(adminReviewRouter);

// ---- Dashboard ----
adminRouter.get('/stats', asyncHandler(async (_req, res) => ok(res, await getStats())));

// ---- Registrations ----
adminRouter.get(
  '/registrations',
  asyncHandler(async (req, res) => ok(res, await listRegistrations(parse(registrationFiltersSchema, req.query)))),
);
adminRouter.get(
  '/registrations/export.csv',
  asyncHandler(async (req, res) => sendCsv(res, `endocon-registrations-${stamp()}.csv`, await exportRegistrationsCsv(parse(registrationFiltersSchema, req.query)))),
);
adminRouter.get(
  '/registrations/:userId',
  asyncHandler(async (req, res) => ok(res, await getRegistrationDetail(idParam(req, 'userId')))),
);
adminRouter.patch(
  '/registrations/:userId',
  asyncHandler(async (req, res) =>
    ok(res, await editRegistrationProfile(currentUserId(req), idParam(req, 'userId'), parse(adminProfileEditSchema, req.body), req), 'Participant details updated.'),
  ),
);
adminRouter.post(
  '/registrations/:userId/resend-confirmation',
  asyncHandler(async (req, res) => {
    const { paymentId } = parse(z.object({ paymentId: z.number().int().positive().optional() }), req.body ?? {});
    return ok(res, await resendConfirmation(currentUserId(req), idParam(req, 'userId'), paymentId, req), 'Confirmation email processed – see the delivery status in "emails".');
  }),
);

// ---- Email log (delivery status of every email; never the message content) ----
adminRouter.get('/emails', asyncHandler(async (req, res) => ok(res, await listEmailLog(parse(emailLogFiltersSchema, req.query)))));
adminRouter.post(
  '/emails/:id/retry',
  asyncHandler(async (req, res) => {
    const result = await retryEmail(idParam(req));
    return ok(res, result, result?.status === 'sent' ? 'Email sent.' : 'Email could not be sent – see the error.');
  }),
);

// ---- Abstracts ----
adminRouter.get(
  '/abstract-authors',
  asyncHandler(async (req, res) => ok(res, await listAbstractAuthors(parse(abstractFiltersSchema, req.query)))),
);
adminRouter.get(
  '/abstract-authors/:userId',
  asyncHandler(async (req, res) => ok(res, await listUserAbstracts(idParam(req, 'userId')))),
);
adminRouter.get(
  '/abstracts/export.csv',
  asyncHandler(async (req, res) => sendCsv(res, `endocon-abstracts-${stamp()}.csv`, await exportAbstractsCsv(parse(abstractFiltersSchema, req.query)))),
);
adminRouter.get('/abstracts/:id', asyncHandler(async (req, res) => ok(res, await getAbstractForAdmin(idParam(req)))));
/** Accept / Reject / Duplicate (comment required for Reject and Duplicate; emailed to the author). */
adminRouter.post(
  '/abstracts/:id/review',
  asyncHandler(async (req, res) =>
    ok(res, await reviewAbstract(currentUserId(req), idParam(req), parse(abstractReviewSchema, req.body), req), 'Decision saved and the author has been notified.'),
  ),
);
adminRouter.get(
  '/abstract-files/:fileId',
  asyncHandler(async (req, res) => {
    sendFile(res, await readFile(idParam(req, 'fileId')));
  }),
);
