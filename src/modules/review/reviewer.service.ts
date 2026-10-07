import type { Knex } from 'knex';
import { db, type DbOrTrx } from '../../db/knex.js';
import { Errors } from '../../lib/errors.js';
import { now } from '../../lib/time.js';
import { getStorage } from '../storage/storage.js';
import { CATEGORY_LABELS, type AbstractCategory } from '../abstracts/abstract.schemas.js';
import { loadAbstract } from '../abstracts/abstract.service.js';
import type { EvaluationInput, ReviewStatus } from './review.schemas.js';
import { REVIEW_STATUS_LABELS, listCriteria } from './review-admin.service.js';

/**
 * Reviewer (judge) portal. EVERY function starts from the authenticated reviewer id and an
 * ACTIVE assignment of that reviewer to the abstract – an abstract ID from the URL alone is never
 * enough. A reviewer only ever sees their own review, never another judge's.
 */

/** The reviewer's active assignment for this abstract, or 404 (no hint whether the abstract exists). */
async function assignmentOf(conn: DbOrTrx, reviewerId: number, abstractId: number, lock = false) {
  const q = conn('abstract_assignments').where({ abstract_id: abstractId, reviewer_id: reviewerId }).whereNull('removed_at');
  if (lock) q.forUpdate();
  const a = await q.first();
  if (!a) throw Errors.notFound('Abstract not found.');
  return a;
}

export async function reviewerDashboard(reviewerId: number) {
  const rows = await db('abstract_assignments as x')
    .join('abstracts as a', 'a.id', 'x.abstract_id')
    .leftJoin('judge_reviews as jr', 'jr.assignment_id', 'x.id')
    .where('x.reviewer_id', reviewerId)
    .whereNull('x.removed_at')
    .orderByRaw("FIELD(x.status, 'pending', 'completed', 'coi')")
    .orderBy('x.assigned_at')
    .select('x.abstract_id', 'x.status', 'x.assigned_at', 'a.abstract_number', 'a.title', 'a.category', 'a.track', 'jr.state', 'jr.submitted_at');
  const abstracts = rows.map((r) => ({
    abstractId: r.abstract_id as number,
    abstractNumber: r.abstract_number as string,
    title: r.title as string,
    category: r.category as AbstractCategory,
    categoryLabel: CATEGORY_LABELS[r.category as AbstractCategory],
    track: r.track as string | null,
    status: r.status as ReviewStatus,
    statusLabel: REVIEW_STATUS_LABELS[r.status as ReviewStatus],
    draftSaved: r.state === 'draft',
    assignedAt: r.assigned_at,
    submittedAt: r.submitted_at,
  }));
  return {
    counts: {
      assigned: abstracts.length,
      pending: abstracts.filter((a) => a.status === 'pending').length,
      completed: abstracts.filter((a) => a.status === 'completed').length,
      coi: abstracts.filter((a) => a.status === 'coi').length,
    },
    abstracts,
  };
}

async function myReview(conn: DbOrTrx, assignmentId: number) {
  const r = await conn('judge_reviews').where({ assignment_id: assignmentId }).first();
  if (!r) return null;
  const scores = await conn('judge_review_scores').where({ review_id: r.id }).orderBy('id');
  return {
    state: r.state as 'draft' | 'submitted',
    coi: !!r.coi,
    coiReason: r.coi_reason as string | null,
    comments: r.comments as string | null,
    recommendedCategory: r.recommended_category as AbstractCategory | null,
    recommendedCategoryLabel: r.recommended_category ? CATEGORY_LABELS[r.recommended_category as AbstractCategory] : null,
    totalScore: r.total_score === null ? null : Number(r.total_score),
    maxTotal: r.max_total === null ? null : Number(r.max_total),
    submittedAt: r.submitted_at,
    scores: scores.map((s) => ({ criterionId: s.criterion_id as number, criterionName: s.criterion_name as string, maxScore: Number(s.max_score), score: Number(s.score) })),
  };
}

/** The abstract (read-only, without the submitter's private contact details), the criteria and MY review. */
export async function reviewerAbstract(reviewerId: number, abstractId: number) {
  const assignment = await assignmentOf(db, reviewerId, abstractId);
  const a = await loadAbstract(db, abstractId);
  if (!a) throw Errors.notFound('Abstract not found.');
  const review = await myReview(db, assignment.id);
  return {
    abstract: {
      id: a.id,
      abstractNumber: a.abstractNumber,
      category: a.category,
      categoryLabel: a.categoryLabel,
      track: a.track,
      title: a.title,
      institution: a.institution,
      department: a.department,
      correspondingAuthor: a.correspondingAuthor,
      keywords: a.keywords,
      body: a.body,
      wordCount: a.wordCount,
      referencesText: a.referencesText,
      conflictOfInterest: a.conflictOfInterest,
      presentingAuthorAge: a.presentingAuthorAge,
      sgeiMembershipNo: a.sgeiMembershipNo,
      videoObjectives: a.videoObjectives,
      techniqueJustification: a.techniqueJustification,
      // Authors without their email addresses.
      submittingAuthor: a.submittingAuthor ? { ...a.submittingAuthor, email: null } : null,
      presentingAuthor: a.presentingAuthor ? { ...a.presentingAuthor, email: null } : null,
      coAuthors: a.coAuthors.map((c) => ({ ...c, email: null })),
      files: a.files,
      revision: a.revision,
      submittedAt: a.submittedAt,
      resubmittedAt: a.resubmittedAt,
    },
    assignment: { status: assignment.status as ReviewStatus, statusLabel: REVIEW_STATUS_LABELS[assignment.status as ReviewStatus], assignedAt: assignment.assigned_at },
    // Scoring form: the active criteria (a submitted review shows its own snapshot instead).
    criteria: review?.state === 'submitted' ? [] : await listCriteria(true),
    review,
  };
}

type Criterion = Awaited<ReturnType<typeof listCriteria>>[number];

/** Validates scores against the active criteria. `complete` = every criterion must be scored. */
function checkScores(input: EvaluationInput, criteria: Criterion[], complete: boolean) {
  const errors: Record<string, string> = {};
  const byId = new Map(criteria.map((c) => [c.id, c]));
  const seen = new Set<number>();
  for (const s of input.scores) {
    const c = byId.get(s.criterionId);
    if (!c) {
      errors.scores = 'The scoring criteria have changed. Please refresh the page.';
      continue;
    }
    if (seen.has(s.criterionId)) errors[`score.${c.id}`] = 'Scored twice.';
    seen.add(s.criterionId);
    if (s.score > c.maxScore) errors[`score.${c.id}`] = `Maximum ${c.maxScore}.`;
  }
  if (complete) for (const c of criteria) if (!seen.has(c.id)) errors[`score.${c.id}`] = `Enter a score (0–${c.maxScore}).`;
  return errors;
}

async function writeReview(
  trx: Knex.Transaction,
  assignment: Record<string, any>,
  reviewerId: number,
  input: EvaluationInput,
  criteria: Criterion[],
  submit: boolean,
) {
  const abstract = await trx('abstracts').where({ id: assignment.abstract_id }).first('revision');
  const scored = input.coi ? [] : input.scores;
  const total = scored.reduce((s, x) => s + x.score, 0);
  const t = now();
  const columns = {
    state: submit ? 'submitted' : 'draft',
    coi: input.coi,
    coi_reason: input.coi ? input.coiReason : null,
    comments: input.comments,
    recommended_category: input.coi ? null : input.recommendedCategory,
    total_score: submit && !input.coi && criteria.length ? total : null,
    max_total: submit && !input.coi && criteria.length ? criteria.reduce((s, c) => s + c.maxScore, 0) : null,
    abstract_revision: abstract.revision,
    submitted_at: submit ? t : null,
  };
  let review = await trx('judge_reviews').where({ assignment_id: assignment.id }).first('id');
  if (review) {
    await trx('judge_reviews').where({ id: review.id }).update(columns);
  } else {
    const [id] = await trx('judge_reviews').insert({ ...columns, assignment_id: assignment.id, abstract_id: assignment.abstract_id, reviewer_id: reviewerId });
    review = { id };
  }
  await trx('judge_review_scores').where({ review_id: review.id }).del();
  const byId = new Map(criteria.map((c) => [c.id, c]));
  for (const s of scored) {
    const c = byId.get(s.criterionId)!;
    await trx('judge_review_scores').insert({ review_id: review.id, criterion_id: c.id, criterion_name: c.name, max_score: c.maxScore, score: s.score });
  }
  if (submit) await trx('abstract_assignments').where({ id: assignment.id }).update({ status: input.coi ? 'coi' : 'completed' });
}

const ALREADY_SUBMITTED = () => Errors.conflict('You have already submitted your review for this abstract. It cannot be submitted again.', 'REVIEW_ALREADY_SUBMITTED');

/** Save as draft (partial scores allowed). Not possible after submission. */
export async function saveDraft(reviewerId: number, abstractId: number, input: EvaluationInput) {
  const criteria = await listCriteria(true);
  const errors = checkScores(input, criteria, false);
  if (Object.keys(errors).length) throw Errors.validation(errors);
  await db.transaction(async (trx) => {
    const assignment = await assignmentOf(trx, reviewerId, abstractId, true);
    const existing = await trx('judge_reviews').where({ assignment_id: assignment.id }).first('state');
    if (existing?.state === 'submitted') throw ALREADY_SUBMITTED();
    await writeReview(trx, assignment, reviewerId, input, criteria, false);
  });
  return reviewerAbstract(reviewerId, abstractId);
}

/**
 * Final submission – once only. The assignment row is locked, so a double click, a second tab or a
 * repeated request finds the review already submitted and is refused.
 */
export async function submitReview(reviewerId: number, abstractId: number, input: EvaluationInput) {
  const criteria = await listCriteria(true);
  const errors: Record<string, string> = {};
  if (input.coi) {
    if (!input.coiReason || input.coiReason.length < 5) errors.coiReason = 'Please describe the conflict of interest.';
  } else {
    if (!criteria.length) throw Errors.conflict('The scoring criteria have not been set up yet. Please contact the organising team.', 'NO_CRITERIA');
    Object.assign(errors, checkScores(input, criteria, true));
    if (!input.recommendedCategory) errors.recommendedCategory = 'Select a category.';
  }
  if (Object.keys(errors).length) throw Errors.validation(errors);
  await db.transaction(async (trx) => {
    const assignment = await assignmentOf(trx, reviewerId, abstractId, true);
    const existing = await trx('judge_reviews').where({ assignment_id: assignment.id }).first('state');
    if (existing?.state === 'submitted') throw ALREADY_SUBMITTED();
    await writeReview(trx, assignment, reviewerId, input, criteria, true);
  });
  return reviewerAbstract(reviewerId, abstractId);
}

/** A file of an abstract assigned to this reviewer (current revision only). */
export async function reviewerFile(reviewerId: number, fileId: number) {
  const f = await db('abstract_files as f').join('abstracts as a', 'a.id', 'f.abstract_id').where('f.id', fileId).whereRaw('f.revision = a.revision').first('f.*');
  if (!f) throw Errors.notFound('File not found.');
  await assignmentOf(db, reviewerId, f.abstract_id).catch(() => {
    throw Errors.notFound('File not found.');
  });
  return { ...(await getStorage().readStream(f.storage_key)), name: f.original_name as string, mime: f.mime_type as string };
}
