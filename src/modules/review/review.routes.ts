import { Router, type Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { asyncHandler, idParam, ok, parse } from '../../lib/http.js';
import { currentUserId } from '../../middleware/auth.js';
import { sendFile } from '../abstracts/abstract.routes.js';
import {
  assignReviewers,
  createCriterion,
  createReviewer,
  getAbstractReviews,
  listAbstractsForReview,
  listCriteria,
  listReviewers,
  reassignReviewer,
  removeReviewer,
  reviewSummary,
  reviewerAssignments,
  updateCriterion,
  updateReviewer,
} from './review-admin.service.js';
import { finalReportXlsx, reviewExportXlsx } from './review-export.service.js';
import {
  assignSchema,
  assignmentListSchema,
  criterionSchema,
  criterionUpdateSchema,
  evaluationSchema,
  otpRequestSchema,
  otpVerifySchema,
  reassignSchema,
  reviewAbstractFiltersSchema,
  reviewerCreateSchema,
  reviewerListSchema,
  reviewerUpdateSchema,
} from './review.schemas.js';
import { OTP_SENT_MESSAGE, currentReviewerId, loadReviewer, logoutReviewer, requestOtp, requireReviewer, verifyOtp } from './reviewer-auth.service.js';
import { reviewerAbstract, reviewerDashboard, reviewerFile, saveDraft, submitReview } from './reviewer.service.js';

// ---- Rate limits for the OTP login (in addition to the per-code attempt limit) ----
const limiter = (windowMs: number, limit: number, key: (req: any) => string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: key,
    skip: () => env.isTest && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== 'true',
    handler: (_req, res) => res.status(429).json({ success: false, code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' }),
  });
const ip = (req: any) => ipKeyGenerator(req.ip ?? '0.0.0.0');
const otpRequestLimiter = limiter(15 * 60_000, 10, (req) => `${ip(req)}:${String(req.body?.email ?? '').toLowerCase().slice(0, 254)}`);
const otpRequestIpLimiter = limiter(15 * 60_000, 30, ip);
const otpVerifyLimiter = limiter(15 * 60_000, 30, ip);

// ---------------------------------------------------------------------------------------------
// Reviewer portal: /api/reviewer/*
// ---------------------------------------------------------------------------------------------

export const reviewerRouter = Router();
reviewerRouter.use(loadReviewer);
reviewerRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

reviewerRouter.post(
  '/auth/request-otp',
  otpRequestIpLimiter,
  otpRequestLimiter,
  asyncHandler(async (req, res) => {
    const { email } = parse(otpRequestSchema, req.body);
    await requestOtp(email, req.ip);
    return ok(res, { sent: true }, OTP_SENT_MESSAGE);
  }),
);

reviewerRouter.post(
  '/auth/verify-otp',
  otpVerifyLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = parse(otpVerifySchema, req.body);
    return ok(res, await verifyOtp(req, res, email, code), 'Logged in.');
  }),
);

reviewerRouter.get('/auth/me', (req, res) => {
  const r = req.reviewer;
  ok(res, r ? { reviewer: { id: r.reviewerId, reviewerCode: r.reviewerCode, name: r.name, email: r.email }, csrfToken: r.csrfToken } : { reviewer: null, csrfToken: null });
});

reviewerRouter.post(
  '/auth/logout',
  requireReviewer,
  asyncHandler(async (req, res) => {
    await logoutReviewer(req, res);
    return ok(res, null, 'Logged out.');
  }),
);

reviewerRouter.get('/dashboard', requireReviewer, asyncHandler(async (req, res) => ok(res, await reviewerDashboard(currentReviewerId(req)))));
reviewerRouter.get('/abstracts/:id', requireReviewer, asyncHandler(async (req, res) => ok(res, await reviewerAbstract(currentReviewerId(req), idParam(req)))));
reviewerRouter.put(
  '/abstracts/:id/review',
  requireReviewer,
  asyncHandler(async (req, res) => ok(res, await saveDraft(currentReviewerId(req), idParam(req), parse(evaluationSchema, req.body)), 'Draft saved.')),
);
reviewerRouter.post(
  '/abstracts/:id/review',
  requireReviewer,
  asyncHandler(async (req, res) =>
    ok(res, await submitReview(currentReviewerId(req), idParam(req), parse(evaluationSchema, req.body)), 'Your review has been submitted. Thank you.'),
  ),
);
reviewerRouter.get('/files/:fileId', requireReviewer, asyncHandler(async (req, res) => sendFile(res, await reviewerFile(currentReviewerId(req), idParam(req, 'fileId')))));

// ---------------------------------------------------------------------------------------------
// Admin: mounted inside the admin router (/api/admin/*, admin role already required there)
// ---------------------------------------------------------------------------------------------

export const adminReviewRouter = Router();

function sendXlsx(res: Response, filename: string, buf: Buffer) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}
const stamp = () => new Date().toISOString().slice(0, 10);

// Reviewers
adminReviewRouter.get('/reviewers', asyncHandler(async (req, res) => ok(res, await listReviewers(parse(reviewerListSchema, req.query)))));
adminReviewRouter.post(
  '/reviewers',
  asyncHandler(async (req, res) => ok(res, await createReviewer(currentUserId(req), parse(reviewerCreateSchema, req.body), req), 'Reviewer added.', 201)),
);
adminReviewRouter.patch(
  '/reviewers/:id',
  asyncHandler(async (req, res) => ok(res, await updateReviewer(currentUserId(req), idParam(req), parse(reviewerUpdateSchema, req.body), req), 'Reviewer updated.')),
);
adminReviewRouter.get(
  '/reviewers/:id/assignments',
  asyncHandler(async (req, res) => ok(res, await reviewerAssignments(idParam(req), parse(assignmentListSchema, req.query).status))),
);

// Scoring criteria
adminReviewRouter.get('/review-criteria', asyncHandler(async (_req, res) => ok(res, await listCriteria())));
adminReviewRouter.post(
  '/review-criteria',
  asyncHandler(async (req, res) => ok(res, await createCriterion(currentUserId(req), parse(criterionSchema, req.body), req), 'Criterion added.', 201)),
);
adminReviewRouter.patch(
  '/review-criteria/:id',
  asyncHandler(async (req, res) => ok(res, await updateCriterion(currentUserId(req), idParam(req), parse(criterionUpdateSchema, req.body), req), 'Criterion updated.')),
);

// The existing abstract table, one row per abstract, with review information
adminReviewRouter.get('/abstracts', asyncHandler(async (req, res) => ok(res, await listAbstractsForReview(parse(reviewAbstractFiltersSchema, req.query)))));
adminReviewRouter.get('/review-summary', asyncHandler(async (_req, res) => ok(res, await reviewSummary())));
adminReviewRouter.get(
  '/review-export.xlsx',
  asyncHandler(async (req, res) => sendXlsx(res, `endocon-abstract-reviews-${stamp()}.xlsx`, await reviewExportXlsx(parse(reviewAbstractFiltersSchema, req.query)))),
);
adminReviewRouter.get(
  '/review-report.xlsx',
  asyncHandler(async (req, res) => sendXlsx(res, `endocon-final-review-report-${stamp()}.xlsx`, await finalReportXlsx(parse(reviewAbstractFiltersSchema, req.query)))),
);

// Assignment / reassignment / details
adminReviewRouter.get('/abstracts/:id/reviews', asyncHandler(async (req, res) => ok(res, await getAbstractReviews(idParam(req)))));
adminReviewRouter.post(
  '/abstracts/:id/reviewers',
  asyncHandler(async (req, res) => ok(res, await assignReviewers(currentUserId(req), idParam(req), parse(assignSchema, req.body).reviewerIds, req), 'Reviewer(s) assigned.')),
);
adminReviewRouter.patch(
  '/abstracts/:id/reviewers/:reviewerId',
  asyncHandler(async (req, res) =>
    ok(res, await reassignReviewer(currentUserId(req), idParam(req), idParam(req, 'reviewerId'), parse(reassignSchema, req.body).newReviewerId, req), 'Abstract reassigned.'),
  ),
);
adminReviewRouter.delete(
  '/abstracts/:id/reviewers/:reviewerId',
  asyncHandler(async (req, res) => ok(res, await removeReviewer(currentUserId(req), idParam(req), idParam(req, 'reviewerId'), req), 'Reviewer removed from this abstract.')),
);
