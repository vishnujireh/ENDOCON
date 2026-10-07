import { z } from 'zod';
import { abstractFiltersSchema } from '../admin/admin.abstracts.service.js';
import { ABSTRACT_CATEGORIES } from '../abstracts/abstract.schemas.js';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')).pipe(z.string().max(254));

// ---- Reviewer login ----
export const otpRequestSchema = z.object({ email });
export const otpVerifySchema = z.object({ email, code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.') });

// ---- Admin: reviewers ----
export const reviewerCreateSchema = z.object({
  name: z.string().trim().min(2, 'Enter the reviewer’s name.').max(150),
  email,
  status: z.enum(['active', 'inactive']).default('active'),
});
export const reviewerUpdateSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter the reviewer’s name.').max(150).optional(),
    email: email.optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });
export const reviewerListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export const REVIEW_STATUSES = ['pending', 'completed', 'coi'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const assignmentListSchema = z.object({ status: z.enum(REVIEW_STATUSES).optional() });

// ---- Admin: scoring criteria (configurable – none are built in) ----
export const criterionSchema = z.object({
  name: z.string().trim().min(2, 'Enter the criterion name.').max(150),
  description: z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
  maxScore: z.coerce.number().int('Whole numbers only.').min(1, 'At least 1.').max(1000),
  displayOrder: z.coerce.number().int().min(0).max(1000).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});
export const criterionUpdateSchema = criterionSchema.partial();

// ---- Admin: assignment ----
export const assignSchema = z.object({
  reviewerIds: z.array(z.coerce.number().int().positive()).min(1, 'Select at least one reviewer.').max(20),
});
export const reassignSchema = z.object({ newReviewerId: z.coerce.number().int().positive() });

/** The existing abstract filters + review progress. */
export const REVIEW_PROGRESS = ['not_assigned', 'in_review', 'completed', 'has_coi'] as const;
export const reviewAbstractFiltersSchema = abstractFiltersSchema.extend({
  review: z.enum(REVIEW_PROGRESS).optional(),
});
export type ReviewAbstractFilters = z.infer<typeof reviewAbstractFiltersSchema>;

// ---- Reviewer: evaluation ----
export const evaluationSchema = z.object({
  coi: z.boolean().default(false),
  coiReason: z.string().trim().max(3000).optional().nullable().transform((v) => v || null),
  comments: z.string().trim().max(5000).optional().nullable().transform((v) => v || null),
  /** Category the judge recommends for the abstract (scoring sheet "Category"). Required on a scored submit. */
  recommendedCategory: z.union([z.enum(ABSTRACT_CATEGORIES, { message: 'Select a category.' }), z.literal('')]).optional().nullable().transform((v) => v || null),
  scores: z
    .array(z.object({ criterionId: z.coerce.number().int().positive(), score: z.coerce.number().int('Whole numbers only.').min(0) }))
    .max(50)
    .default([]),
});
export type EvaluationInput = z.infer<typeof evaluationSchema>;
