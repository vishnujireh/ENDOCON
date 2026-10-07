import type { Request } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { db } from '../../db/knex.js';
import { audit } from '../../lib/audit.js';
import { toCsv } from '../../lib/csv.js';
import { Errors } from '../../lib/errors.js';
import { formatEventDateTime, now } from '../../lib/time.js';
import { ABSTRACT_CATEGORIES, ABSTRACT_STATUSES, ABSTRACT_TRACKS, CATEGORY_LABELS, RESUBMITTABLE, type AbstractReviewInput } from '../abstracts/abstract.schemas.js';
import { STATUS_LABELS, loadAbstract, loadHistory, submissionWindow } from '../abstracts/abstract.service.js';
import { enqueueEmail } from '../email/outbox.js';

/** Submitted + Resubmitted = waiting for the Scientific Committee. */
const NEEDS_REVIEW = ['submitted', 'resubmitted'];

export const abstractFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum([...ABSTRACT_STATUSES, 'needs_review'] as [string, ...string[]]).optional(),
  category: z.enum(ABSTRACT_CATEGORIES).optional(),
  institution: z.string().trim().max(100).optional(),
  track: z.enum(ABSTRACT_TRACKS).optional(),
  author: z.string().trim().max(100).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  userId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type AbstractFilters = z.infer<typeof abstractFiltersSchema>;

const esc = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export function filtered(f: AbstractFilters): Knex.QueryBuilder {
  const q = db('abstracts as a').join('users as u', 'u.id', 'a.user_id').leftJoin('user_profiles as p', 'p.user_id', 'a.user_id');
  if (f.status === 'needs_review') q.whereIn('a.status', NEEDS_REVIEW);
  else if (f.status) q.where('a.status', f.status);
  if (f.category) q.where('a.category', f.category);
  if (f.institution) q.where('a.institution', 'like', esc(f.institution));
  if (f.track) q.where('a.track', f.track);
  if (f.userId) q.where('a.user_id', f.userId);
  if (f.from) q.where('a.submitted_at', '>=', new Date(`${f.from}T00:00:00+05:30`));
  if (f.to) q.where('a.submitted_at', '<=', new Date(`${f.to}T23:59:59.999+05:30`));
  if (f.author) {
    const like = esc(f.author);
    q.where((w) =>
      w
        .where('p.full_name', 'like', like)
        .orWhereExists(
          db('abstract_authors as aa')
            .whereRaw('aa.abstract_id = a.id')
            .where((x) => x.whereRaw("CONCAT_WS(' ', aa.first_name, aa.middle_name, aa.last_name) LIKE ?", [like])),
        ),
    );
  }
  if (f.q) {
    const like = esc(f.q);
    q.where((w) =>
      w
        .where('a.title', 'like', like)
        .orWhere('a.abstract_number', 'like', like)
        .orWhere('u.email', 'like', like)
        .orWhere('p.full_name', 'like', like)
        .orWhere('a.institution', 'like', like),
    );
  }
  return q;
}

/** "Paid · ENDO-0003" when the account holds a paid conference registration, else "Not registered". */
export async function registrationLabels(userIds: number[]) {
  if (!userIds.length) return new Map<number, string>();
  const rows = await db('conference_registrations as cr')
    .join('orders as o', 'o.id', 'cr.order_id')
    .whereIn('cr.user_id', userIds)
    .select('cr.user_id', 'cr.status', 'o.order_number');
  const map = new Map<number, string>();
  for (const r of rows) {
    if (r.status === 'active') map.set(r.user_id, `Paid${r.order_number ? ` · ${r.order_number}` : ''}`);
    else if (r.status === 'refunded') map.set(r.user_id, 'Refunded');
  }
  return map;
}

/** One row per submitter (user account): Sl, Author, Email, Institution, No. of Abstracts, review counts, registration. */
export async function listAbstractAuthors(f: AbstractFilters) {
  const q = filtered(f);
  const countRow = await db.from(q.clone().clearSelect().distinct('a.user_id').as('x')).count({ n: '*' }).first();
  const rows: Record<string, any>[] = await q
    .clone()
    .groupBy('a.user_id', 'u.email', 'p.title', 'p.full_name', 'p.phone_country_code', 'p.phone_number')
    .select('a.user_id', 'u.email', 'p.title', 'p.full_name', 'p.phone_country_code', 'p.phone_number')
    .count({ abstracts: 'a.id' })
    .select(db.raw(`SUM(a.status IN ('submitted','resubmitted')) as needs_review`))
    .max({ last_submitted_at: db.raw('COALESCE(a.resubmitted_at, a.submitted_at)') })
    .select(db.raw(`GROUP_CONCAT(DISTINCT a.institution SEPARATOR '; ') as institutions`))
    .orderBy('last_submitted_at', 'desc')
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);
  const reg = await registrationLabels(rows.map((r) => r.user_id));
  return {
    total: Number(countRow?.n ?? 0),
    page: f.page,
    pageSize: f.pageSize,
    rows: rows.map((r, i) => ({
      slNo: (f.page - 1) * f.pageSize + i + 1,
      userId: r.user_id as number,
      author: [r.title, r.full_name].filter(Boolean).join(' ') || r.email,
      email: r.email as string,
      phone: r.phone_number ? `${r.phone_country_code ?? ''} ${r.phone_number}`.trim() : null,
      institution: r.institutions as string | null,
      abstractCount: Number(r.abstracts),
      needsReview: Number(r.needs_review ?? 0),
      registration: reg.get(r.user_id) ?? 'Not registered',
      lastSubmittedAt: r.last_submitted_at,
    })),
  };
}

async function adminAbstract(id: number) {
  const a = await loadAbstract(db, id);
  if (!a) throw Errors.notFound('Abstract not found.');
  const history = await loadHistory(db, id, { forAdmin: true });
  return { ...a, history: history.events, previousVersions: history.previousVersions };
}

/** All abstracts of one account, with review history and earlier revisions. */
export async function listUserAbstracts(userId: number) {
  const u = await db('users as u')
    .leftJoin('user_profiles as p', 'p.user_id', 'u.id')
    .where('u.id', userId)
    .first('u.id', 'u.email', 'p.title', 'p.full_name', 'p.phone_country_code', 'p.phone_number', 'p.organization');
  if (!u) throw Errors.notFound('Account not found.');
  const ids = (await db('abstracts').where({ user_id: userId }).orderBy('submitted_at', 'desc').select('id')) as { id: number }[];
  const abstracts = [];
  for (const r of ids) abstracts.push(await adminAbstract(r.id));
  const reg = await registrationLabels([userId]);
  return {
    author: {
      userId: u.id as number,
      name: [u.title, u.full_name].filter(Boolean).join(' ') || u.email,
      email: u.email as string,
      phone: u.phone_number ? `${u.phone_country_code ?? ''} ${u.phone_number}`.trim() : null,
      organization: (u.organization as string | null) ?? abstracts[0]?.institution ?? null,
      registration: reg.get(userId) ?? 'Not registered',
    },
    abstracts,
  };
}

export async function getAbstractForAdmin(id: number) {
  return adminAbstract(id);
}

/**
 * Accept / Reject / Duplicate. The comment (required for Reject / Duplicate) is stored in the
 * history, shown to the author in My Abstracts and emailed to them.
 */
export async function reviewAbstract(adminId: number, id: number, input: AbstractReviewInput, req: Request) {
  await db.transaction(async (trx) => {
    const a = await trx('abstracts').where({ id }).forUpdate().first();
    if (!a) throw Errors.notFound('Abstract not found.');
    const t = now();
    await trx('abstracts').where({ id }).update({ status: input.decision, review_comment: input.comment, reviewed_at: t });
    await trx('abstract_reviews').insert({ abstract_id: id, revision: a.revision, decision: input.decision, comment: input.comment, reviewer_id: adminId });
    await audit(trx, {
      actorUserId: adminId,
      action: 'abstract.reviewed',
      entityType: 'abstract',
      entityId: id,
      before: { status: a.status, revision: a.revision },
      after: { status: input.decision, comment: input.comment },
      req,
    });
    const window = submissionWindow();
    const reviewCount = await trx('abstract_reviews').where({ abstract_id: id }).count({ n: '*' }).first();
    await enqueueEmail(
      trx,
      a.contact_email,
      'abstract_decision',
      {
        fullName: a.contact_name,
        abstractNumber: a.abstract_number,
        title: a.title,
        categoryLabel: CATEGORY_LABELS[a.category as keyof typeof CATEGORY_LABELS],
        submittedAt: formatEventDateTime(a.resubmitted_at ?? a.submitted_at),
        decision: input.decision,
        comment: input.comment,
        canResubmit: RESUBMITTABLE.includes(input.decision) && window.isOpen,
        closesAt: formatEventDateTime(new Date(window.closesAt)),
        myAbstractsUrl: `${env.FRONTEND_URL.replace(/\/$/, '')}/my-abstracts`,
      },
      { related: { type: 'abstract', id }, dedupeKey: `abstract-decision:${id}:${Number(reviewCount?.n ?? 0)}` },
    );
  });
  return adminAbstract(id);
}

export async function exportAbstractsCsv(f: AbstractFilters): Promise<string> {
  const ids = ((await filtered(f).select('a.id').orderBy('a.submitted_at', 'asc')) as { id: number }[]).map((r) => r.id);
  const header = [
    'Abstract No', 'Status', 'Latest Comment', 'Revision', 'Resubmissions', 'Category', 'Track / Theme', 'Title', 'Institution', 'Department', 'Corresponding Author', 'Keywords', 'Word Count',
    'Abstract', 'Presenting Author', 'Presenting Author Age', 'Co-Authors', 'SGEI Membership No', 'Video Link', 'Files',
    'Account Name', 'Account Email', 'Account Phone', 'Conference Registration', 'Submitted At', 'Resubmitted At', 'Reviewed At',
  ];
  const abstracts = [];
  for (const id of ids) abstracts.push((await loadAbstract(db, id))!);
  const reg = await registrationLabels([...new Set(abstracts.map((a) => a.userId))]);
  const rows = abstracts.map((a) => [
    a.abstractNumber,
    STATUS_LABELS[a.status],
    a.reviewComment,
    a.revision,
    a.revision - 1,
    CATEGORY_LABELS[a.category],
    a.track,
    a.title,
    a.institution,
    a.department,
    a.correspondingAuthor,
    a.keywords.join('; '),
    a.wordCount,
    a.body,
    a.presentingAuthor?.fullName ?? a.submittingAuthor?.fullName,
    a.presentingAuthorAge,
    a.coAuthors.map((c) => (c.institution ? `${c.fullName} (${c.institution})` : c.fullName)).join('; '),
    a.sgeiMembershipNo,
    a.videoUrl,
    a.files.map((x) => `${x.kind}: ${x.originalName}`).join('; '),
    a.contactName,
    a.contactEmail,
    a.contactPhone,
    reg.get(a.userId) ?? 'Not registered',
    formatEventDateTime(a.submittedAt),
    formatEventDateTime(a.resubmittedAt),
    formatEventDateTime(a.reviewedAt),
  ]);
  return toCsv(header, rows);
}
