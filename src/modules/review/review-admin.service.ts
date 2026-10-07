import type { Request } from 'express';
import type { Knex } from 'knex';
import { db, type DbOrTrx } from '../../db/knex.js';
import { audit } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { nextSequenceValue, pad } from '../../lib/sequences.js';
import { now } from '../../lib/time.js';
import { CATEGORY_LABELS, type AbstractCategory } from '../abstracts/abstract.schemas.js';
import { STATUS_LABELS, loadAbstract } from '../abstracts/abstract.service.js';
import { filtered } from '../admin/admin.abstracts.service.js';
import type { ReviewAbstractFilters, ReviewStatus } from './review.schemas.js';
import { revokeReviewerSessions } from './reviewer-auth.service.js';

/**
 * Admin side of the Online Abstract Review Module: reviewers, scoring criteria, assignment /
 * reassignment of abstracts to reviewers and review monitoring. All routes require an admin.
 */

const isDuplicate = (e: unknown) => (e as { code?: string })?.code === 'ER_DUP_ENTRY';

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = { pending: 'Pending', completed: 'Completed', coi: 'COI' };

// ---------------------------------------------------------------------------------------------
// Reviewers
// ---------------------------------------------------------------------------------------------

const countWhere = (status?: ReviewStatus) =>
  db('abstract_assignments as x')
    .count('*')
    .whereRaw('x.reviewer_id = r.id')
    .whereNull('x.removed_at')
    .modify((q) => (status ? q.where('x.status', status) : q));

function reviewerDto(r: Record<string, any>) {
  return {
    id: r.id as number,
    reviewerCode: r.reviewer_code as string,
    name: r.name as string,
    email: r.email as string,
    status: r.status as 'active' | 'inactive',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(r.assigned !== undefined && {
      counts: { assigned: Number(r.assigned), pending: Number(r.pending), completed: Number(r.completed), coi: Number(r.coi) },
    }),
  };
}

export async function listReviewers(f: { q?: string; status?: 'active' | 'inactive' }) {
  const q = db('reviewers as r').select(
    'r.*',
    countWhere().as('assigned'),
    countWhere('pending').as('pending'),
    countWhere('completed').as('completed'),
    countWhere('coi').as('coi'),
  );
  if (f.status) q.where('r.status', f.status);
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    q.where((w) => w.where('r.name', 'like', like).orWhere('r.email', 'like', like).orWhere('r.reviewer_code', 'like', like));
  }
  return (await q.orderBy('r.name')).map(reviewerDto);
}

export async function createReviewer(adminId: number, input: { name: string; email: string; status: 'active' | 'inactive' }, req: Request) {
  if (await db('reviewers').where({ email: input.email }).first('id')) throw Errors.validation({ email: 'A reviewer with this email already exists.' });
  try {
    const id = await db.transaction(async (trx) => {
      const code = `REV-${pad(await nextSequenceValue(trx, 'reviewer_code'), 3)}`;
      const [newId] = await trx('reviewers').insert({ reviewer_code: code, name: input.name, email: input.email, status: input.status, created_by: adminId });
      await audit(trx, { actorUserId: adminId, action: 'reviewer.created', entityType: 'reviewer', entityId: newId, after: { code, ...input }, req });
      return newId as number;
    });
    return reviewerDto(await db('reviewers').where({ id }).first());
  } catch (e) {
    if (isDuplicate(e)) throw Errors.validation({ email: 'A reviewer with this email already exists.' });
    throw e;
  }
}

export async function updateReviewer(adminId: number, id: number, input: { name?: string; email?: string; status?: 'active' | 'inactive' }, req: Request) {
  const before = await db('reviewers').where({ id }).first();
  if (!before) throw Errors.notFound('Reviewer not found.');
  if (input.email && input.email !== before.email && (await db('reviewers').where({ email: input.email }).first('id'))) {
    throw Errors.validation({ email: 'A reviewer with this email already exists.' });
  }
  try {
    await db.transaction(async (trx) => {
      await trx('reviewers').where({ id }).update(input);
      await audit(trx, { actorUserId: adminId, action: 'reviewer.updated', entityType: 'reviewer', entityId: id, before: { name: before.name, email: before.email, status: before.status }, after: input, req });
    });
  } catch (e) {
    if (isDuplicate(e)) throw Errors.validation({ email: 'A reviewer with this email already exists.' });
    throw e;
  }
  // Deactivated (or email changed): end their sessions and cancel outstanding login codes.
  if (input.status === 'inactive' || (input.email && input.email !== before.email)) {
    await revokeReviewerSessions(id);
    await db('reviewer_otps').where({ reviewer_id: id }).whereNull('verified_at').whereNull('invalidated_at').update({ invalidated_at: now() });
  }
  return reviewerDto(await db('reviewers').where({ id }).first());
}

/** A reviewer's current assignments (optionally only pending / completed / COI). */
export async function reviewerAssignments(reviewerId: number, status?: ReviewStatus) {
  const r = await db('reviewers').where({ id: reviewerId }).first();
  if (!r) throw Errors.notFound('Reviewer not found.');
  const q = db('abstract_assignments as x')
    .join('abstracts as a', 'a.id', 'x.abstract_id')
    .leftJoin('judge_reviews as jr', 'jr.assignment_id', 'x.id')
    .where('x.reviewer_id', reviewerId)
    .whereNull('x.removed_at')
    .select('x.id', 'x.abstract_id', 'x.status', 'x.assigned_at', 'a.abstract_number', 'a.title', 'a.category', 'a.track', 'jr.state', 'jr.total_score', 'jr.max_total', 'jr.submitted_at')
    .orderBy('x.assigned_at', 'desc');
  if (status) q.where('x.status', status);
  const rows = await q;
  return {
    reviewer: reviewerDto(r),
    assignments: rows.map((x) => ({
      assignmentId: x.id as number,
      abstractId: x.abstract_id as number,
      abstractNumber: x.abstract_number as string,
      title: x.title as string,
      categoryLabel: CATEGORY_LABELS[x.category as AbstractCategory],
      track: x.track as string | null,
      status: x.status as ReviewStatus,
      statusLabel: REVIEW_STATUS_LABELS[x.status as ReviewStatus],
      draftSaved: x.state === 'draft',
      score: x.total_score === null || x.total_score === undefined ? null : Number(x.total_score),
      maxScore: x.max_total === null || x.max_total === undefined ? null : Number(x.max_total),
      assignedAt: x.assigned_at,
      submittedAt: x.submitted_at,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Scoring criteria (configurable; the review form is built from the active ones)
// ---------------------------------------------------------------------------------------------

function criterionDto(c: Record<string, any>) {
  return {
    id: c.id as number,
    name: c.name as string,
    description: c.description as string | null,
    maxScore: Number(c.max_score),
    displayOrder: Number(c.display_order),
    status: c.status as 'active' | 'inactive',
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

export async function listCriteria(onlyActive = false) {
  const q = db('review_criteria').orderBy('display_order').orderBy('id');
  if (onlyActive) q.where({ status: 'active' });
  return (await q).map(criterionDto);
}

type CriterionInput = { name?: string; description?: string | null; maxScore?: number; displayOrder?: number; status?: 'active' | 'inactive' };
const criterionColumns = (i: CriterionInput) => ({
  ...(i.name !== undefined && { name: i.name }),
  ...(i.description !== undefined && { description: i.description }),
  ...(i.maxScore !== undefined && { max_score: i.maxScore }),
  ...(i.displayOrder !== undefined && { display_order: i.displayOrder }),
  ...(i.status !== undefined && { status: i.status }),
});

export async function createCriterion(adminId: number, input: CriterionInput, req: Request) {
  const id = await db.transaction(async (trx) => {
    const [newId] = await trx('review_criteria').insert(criterionColumns(input));
    await audit(trx, { actorUserId: adminId, action: 'review_criterion.created', entityType: 'review_criterion', entityId: newId, after: input, req });
    return newId as number;
  });
  return criterionDto(await db('review_criteria').where({ id }).first());
}

/** Edits never change submitted reviews: each score keeps a snapshot of the criterion name and maximum. */
export async function updateCriterion(adminId: number, id: number, input: CriterionInput, req: Request) {
  const before = await db('review_criteria').where({ id }).first();
  if (!before) throw Errors.notFound('Criterion not found.');
  await db.transaction(async (trx) => {
    await trx('review_criteria').where({ id }).update(criterionColumns(input));
    await audit(trx, { actorUserId: adminId, action: 'review_criterion.updated', entityType: 'review_criterion', entityId: id, before: criterionDto(before), after: input, req });
  });
  return criterionDto(await db('review_criteria').where({ id }).first());
}

// ---------------------------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------------------------

async function lockAbstract(trx: Knex.Transaction, abstractId: number) {
  const a = await trx('abstracts').where({ id: abstractId }).forUpdate().first('id', 'abstract_number');
  if (!a) throw Errors.notFound('Abstract not found.');
  return a;
}

async function activeReviewer(conn: DbOrTrx, reviewerId: number) {
  const r = await conn('reviewers').where({ id: reviewerId }).first('id', 'name', 'status');
  if (!r) throw Errors.notFound('Reviewer not found.');
  if (r.status !== 'active') throw Errors.conflict(`${r.name} is inactive and cannot be assigned.`, 'REVIEWER_INACTIVE');
  return r;
}

/** Adds (or re-activates) an assignment. Returns false when the reviewer is already actively assigned. */
async function addAssignment(trx: Knex.Transaction, adminId: number, abstractId: number, reviewerId: number) {
  const t = now();
  const existing = await trx('abstract_assignments').where({ abstract_id: abstractId, reviewer_id: reviewerId }).forUpdate().first();
  if (existing && !existing.removed_at) return false;
  if (existing) {
    // Same reviewer again after removal: restore the assignment together with any earlier review.
    await trx('abstract_assignments')
      .where({ id: existing.id })
      .update({ removed_at: null, removed_by: null, replaced_by_reviewer_id: null, assigned_by: adminId, assigned_at: t });
  } else {
    await trx('abstract_assignments').insert({ abstract_id: abstractId, reviewer_id: reviewerId, status: 'pending', assigned_by: adminId, assigned_at: t });
  }
  return true;
}

export async function assignReviewers(adminId: number, abstractId: number, reviewerIds: number[], req: Request) {
  const ids = [...new Set(reviewerIds)];
  await db.transaction(async (trx) => {
    await lockAbstract(trx, abstractId);
    const duplicates: string[] = [];
    for (const rid of ids) {
      const r = await activeReviewer(trx, rid);
      if (!(await addAssignment(trx, adminId, abstractId, rid))) duplicates.push(r.name);
    }
    if (duplicates.length) {
      throw Errors.conflict(`Already assigned to this abstract: ${duplicates.join(', ')}.`, 'DUPLICATE_ASSIGNMENT');
    }
    await audit(trx, { actorUserId: adminId, action: 'abstract.reviewers_assigned', entityType: 'abstract', entityId: abstractId, after: { reviewerIds: ids }, req });
  });
  return getAbstractReviews(abstractId);
}

/** Reviewer A → Reviewer B. A's assignment (and any review they wrote) is kept as history, not deleted. */
export async function reassignReviewer(adminId: number, abstractId: number, fromReviewerId: number, toReviewerId: number, req: Request) {
  if (fromReviewerId === toReviewerId) throw Errors.badRequest('Choose a different reviewer.', 'SAME_REVIEWER');
  await db.transaction(async (trx) => {
    await lockAbstract(trx, abstractId);
    const from = await trx('abstract_assignments').where({ abstract_id: abstractId, reviewer_id: fromReviewerId }).whereNull('removed_at').forUpdate().first();
    if (!from) throw Errors.notFound('That reviewer is not assigned to this abstract.');
    const to = await activeReviewer(trx, toReviewerId);
    if (!(await addAssignment(trx, adminId, abstractId, toReviewerId))) {
      throw Errors.conflict(`${to.name} is already assigned to this abstract.`, 'DUPLICATE_ASSIGNMENT');
    }
    await trx('abstract_assignments').where({ id: from.id }).update({ removed_at: now(), removed_by: adminId, replaced_by_reviewer_id: toReviewerId });
    await audit(trx, { actorUserId: adminId, action: 'abstract.reviewer_reassigned', entityType: 'abstract', entityId: abstractId, before: { reviewerId: fromReviewerId, status: from.status }, after: { reviewerId: toReviewerId }, req });
  });
  return getAbstractReviews(abstractId);
}

/** Removes a reviewer from an abstract (soft: their review, if any, stays in the history). */
export async function removeReviewer(adminId: number, abstractId: number, reviewerId: number, req: Request) {
  await db.transaction(async (trx) => {
    await lockAbstract(trx, abstractId);
    const a = await trx('abstract_assignments').where({ abstract_id: abstractId, reviewer_id: reviewerId }).whereNull('removed_at').forUpdate().first();
    if (!a) throw Errors.notFound('That reviewer is not assigned to this abstract.');
    await trx('abstract_assignments').where({ id: a.id }).update({ removed_at: now(), removed_by: adminId });
    await audit(trx, { actorUserId: adminId, action: 'abstract.reviewer_removed', entityType: 'abstract', entityId: abstractId, before: { reviewerId, status: a.status }, req });
  });
  return getAbstractReviews(abstractId);
}

// ---------------------------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------------------------

export interface AssignmentView {
  assignmentId: number;
  reviewerId: number;
  reviewerCode: string;
  reviewerName: string;
  reviewerEmail: string;
  status: ReviewStatus;
  statusLabel: string;
  active: boolean;
  assignedAt: Date;
  removedAt: Date | null;
  replacedBy: string | null;
  review: null | {
    state: 'draft' | 'submitted';
    coi: boolean;
    coiReason: string | null;
    comments: string | null;
    recommendedCategory: string | null;
    recommendedCategoryLabel: string | null;
    totalScore: number | null;
    maxTotal: number | null;
    abstractRevision: number;
    submittedAt: Date | null;
    scores: { criterionId: number; criterionName: string; maxScore: number; score: number }[];
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Abstract-level summary from its ACTIVE assignments. Average / total use submitted, scored reviews only (never COI). */
export function summarize(assignments: Pick<AssignmentView, 'active' | 'status' | 'review'>[]) {
  const active = assignments.filter((a) => a.active);
  const pending = active.filter((a) => a.status === 'pending').length;
  const completed = active.filter((a) => a.status === 'completed').length;
  const coi = active.filter((a) => a.status === 'coi').length;
  const scored = active.filter((a) => a.status === 'completed' && a.review?.state === 'submitted' && a.review.totalScore !== null);
  const totalScore = scored.reduce((s, a) => s + (a.review!.totalScore ?? 0), 0);
  const maxes = [...new Set(scored.map((a) => a.review!.maxTotal))];
  const progress = active.length === 0 ? 'not_assigned' : pending > 0 ? 'in_review' : 'completed';
  return {
    assigned: active.length,
    pending,
    completed,
    coi,
    scoredReviews: scored.length,
    totalScore: scored.length ? totalScore : null,
    averageScore: scored.length ? round2(totalScore / scored.length) : null,
    /** Maximum per review, when all scored reviews used the same maximum. */
    maxPerReview: maxes.length === 1 ? maxes[0] : null,
    progress,
    progressLabel:
      progress === 'not_assigned' ? 'Not assigned' : progress === 'in_review' ? `In review (${completed + coi} of ${active.length})` : 'Review complete',
  };
}

/** All assignments (active and removed) of the given abstracts, with each reviewer's own review. */
export async function assignmentsFor(abstractIds: number[]): Promise<Map<number, AssignmentView[]>> {
  const map = new Map<number, AssignmentView[]>();
  if (!abstractIds.length) return map;
  const rows = await db('abstract_assignments as x')
    .join('reviewers as r', 'r.id', 'x.reviewer_id')
    .leftJoin('reviewers as rb', 'rb.id', 'x.replaced_by_reviewer_id')
    .leftJoin('judge_reviews as jr', 'jr.assignment_id', 'x.id')
    .whereIn('x.abstract_id', abstractIds)
    .orderBy('x.assigned_at')
    .orderBy('x.id')
    .select('x.*', 'r.reviewer_code', 'r.name as reviewer_name', 'r.email as reviewer_email', 'rb.name as replaced_by_name', 'jr.id as review_id', 'jr.state', 'jr.coi', 'jr.coi_reason', 'jr.comments', 'jr.recommended_category', 'jr.total_score', 'jr.max_total', 'jr.abstract_revision', 'jr.submitted_at');
  const reviewIds = rows.map((r) => r.review_id).filter(Boolean);
  const scores = reviewIds.length ? await db('judge_review_scores').whereIn('review_id', reviewIds).orderBy('id') : [];
  for (const x of rows) {
    const list = map.get(x.abstract_id) ?? [];
    list.push({
      assignmentId: x.id,
      reviewerId: x.reviewer_id,
      reviewerCode: x.reviewer_code,
      reviewerName: x.reviewer_name,
      reviewerEmail: x.reviewer_email,
      status: x.status,
      statusLabel: REVIEW_STATUS_LABELS[x.status as ReviewStatus],
      active: !x.removed_at,
      assignedAt: x.assigned_at,
      removedAt: x.removed_at,
      replacedBy: x.replaced_by_name ?? null,
      review: x.review_id
        ? {
            state: x.state,
            coi: !!x.coi,
            coiReason: x.coi_reason,
            comments: x.comments,
            recommendedCategory: x.recommended_category ?? null,
            recommendedCategoryLabel: x.recommended_category ? CATEGORY_LABELS[x.recommended_category as AbstractCategory] : null,
            totalScore: x.total_score === null ? null : Number(x.total_score),
            maxTotal: x.max_total === null ? null : Number(x.max_total),
            abstractRevision: x.abstract_revision,
            submittedAt: x.submitted_at,
            scores: scores
              .filter((s) => s.review_id === x.review_id)
              .map((s) => ({ criterionId: s.criterion_id, criterionName: s.criterion_name, maxScore: Number(s.max_score), score: Number(s.score) })),
          }
        : null,
    });
    map.set(x.abstract_id, list);
  }
  return map;
}

const activeAssignment = () => db('abstract_assignments as ax').whereRaw('ax.abstract_id = a.id').whereNull('ax.removed_at');

function applyReviewFilter(q: Knex.QueryBuilder, review?: ReviewAbstractFilters['review']) {
  if (review === 'not_assigned') q.whereNotExists(activeAssignment());
  else if (review === 'in_review') q.whereExists(activeAssignment().where('ax.status', 'pending'));
  else if (review === 'completed') q.whereExists(activeAssignment()).whereNotExists(activeAssignment().where('ax.status', 'pending'));
  else if (review === 'has_coi') q.whereExists(activeAssignment().where('ax.status', 'coi'));
  return q;
}

const presenterName = db.raw(
  `(SELECT CONCAT_WS(' ', aa.first_name, aa.middle_name, aa.last_name) FROM abstract_authors aa WHERE aa.abstract_id = a.id AND aa.role = 'presenting' ORDER BY aa.sort LIMIT 1) as presenter`,
);

/** Abstracts matching the (existing) admin filters, with their review assignments – one row per abstract. */
export async function abstractRows(f: ReviewAbstractFilters, paged: boolean) {
  const base = applyReviewFilter(filtered(f), f.review);
  const countRow = paged ? await db.from(base.clone().clearSelect().distinct('a.id').as('x')).count({ n: '*' }).first() : null;
  const q = base
    .clone()
    .distinct('a.id', 'a.abstract_number', 'a.title', 'a.category', 'a.track', 'a.status', 'a.institution', 'a.submitted_at', 'p.full_name', 'u.email')
    .select(presenterName)
    .orderBy('a.submitted_at', 'desc')
    .orderBy('a.id', 'desc');
  if (paged) q.limit(f.pageSize).offset((f.page - 1) * f.pageSize);
  const rows: Record<string, any>[] = await q;
  const assignments = await assignmentsFor(rows.map((r) => r.id));
  const list = rows.map((r, i) => {
    const as = assignments.get(r.id) ?? [];
    return {
      slNo: paged ? (f.page - 1) * f.pageSize + i + 1 : i + 1,
      id: r.id as number,
      abstractNumber: r.abstract_number as string,
      title: r.title as string,
      category: r.category as AbstractCategory,
      categoryLabel: CATEGORY_LABELS[r.category as AbstractCategory],
      track: r.track as string | null,
      decision: r.status as keyof typeof STATUS_LABELS,
      decisionLabel: STATUS_LABELS[r.status as keyof typeof STATUS_LABELS],
      submitter: (r.full_name as string | null) || (r.email as string),
      presenter: (r.presenter as string | null) || (r.full_name as string | null) || '',
      institution: r.institution as string,
      submittedAt: r.submitted_at,
      assignments: as,
      summary: summarize(as),
    };
  });
  return { total: Number(countRow?.n ?? list.length), rows: list };
}

export async function listAbstractsForReview(f: ReviewAbstractFilters) {
  const { total, rows } = await abstractRows(f, true);
  // Keep the list light: judges' names + statuses + totals (full reviews are in the details view).
  return {
    total,
    page: f.page,
    pageSize: f.pageSize,
    rows: rows.map((r) => ({
      ...r,
      assignments: r.assignments
        .filter((a) => a.active)
        .map((a) => ({ reviewerId: a.reviewerId, reviewerCode: a.reviewerCode, reviewerName: a.reviewerName, status: a.status, statusLabel: a.statusLabel, score: a.review?.state === 'submitted' ? a.review.totalScore : null, maxScore: a.review?.maxTotal ?? null })),
    })),
  };
}

/** "View Review Details": the abstract, every assignment (incl. removed) with its review, and the summary. */
export async function getAbstractReviews(abstractId: number) {
  const abstract = await loadAbstract(db, abstractId);
  if (!abstract) throw Errors.notFound('Abstract not found.');
  const assignments = (await assignmentsFor([abstractId])).get(abstractId) ?? [];
  return { abstract, assignments, summary: summarize(assignments) };
}

export async function reviewSummary() {
  const [reviewers, abstracts, byStatus, assignedAbstracts] = await Promise.all([
    db('reviewers').select('status').count({ n: '*' }).groupBy('status'),
    db('abstracts').count({ n: '*' }).first(),
    db('abstract_assignments').whereNull('removed_at').select('status').count({ n: '*' }).groupBy('status'),
    db('abstract_assignments').whereNull('removed_at').countDistinct({ n: 'abstract_id' }).first(),
  ]);
  const n = (rows: Record<string, any>[], key: string) => Number(rows.find((r) => r.status === key)?.n ?? 0);
  const totalAbstracts = Number(abstracts?.n ?? 0);
  const assigned = Number(assignedAbstracts?.n ?? 0);
  return {
    reviewers: { active: n(reviewers, 'active'), inactive: n(reviewers, 'inactive') },
    abstracts: { total: totalAbstracts, assigned, notAssigned: totalAbstracts - assigned },
    reviews: { pending: n(byStatus, 'pending'), completed: n(byStatus, 'completed'), coi: n(byStatus, 'coi') },
    criteriaConfigured: Number((await db('review_criteria').where({ status: 'active' }).count({ n: '*' }).first())?.n ?? 0),
  };
}
