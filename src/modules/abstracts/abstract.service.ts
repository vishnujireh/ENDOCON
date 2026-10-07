import { env } from '../../config/env.js';
import { db, type DbOrTrx, type Trx } from '../../db/knex.js';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile as readWholeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { randomToken } from '../../lib/crypto.js';
import { Errors } from '../../lib/errors.js';
import { nextSequenceValue, pad } from '../../lib/sequences.js';
import { formatEventDateTime, now } from '../../lib/time.js';
import { enqueueEmail } from '../email/outbox.js';
import { getStorage } from '../storage/storage.js';
import {
  CATEGORY_LABELS,
  countWords,
  MAX_FILES,
  MAX_VIDEOS,
  RESUBMITTABLE,
  validateForSubmit,
  type AbstractCategory,
  type AbstractStatus,
  type AbstractSubmissionInput,
  type AuthorInput,
  type FileKind,
} from './abstract.schemas.js';

/**
 * Abstract submission for logged-in delegates and the review loop:
 * submit → admin Accept / Reject / Duplicate (comment) → author revises the same abstract → resubmit.
 */

export function submissionWindow() {
  const t = now();
  const opens = new Date(env.ABSTRACT_SUBMISSION_OPENS);
  const closes = new Date(env.ABSTRACT_SUBMISSION_CLOSES);
  return { opensAt: opens.toISOString(), closesAt: closes.toISOString(), isOpen: t >= opens && t <= closes };
}

function assertWindowOpen() {
  if (!submissionWindow().isOpen) throw Errors.conflict('Abstract submission is currently closed.', 'SUBMISSION_CLOSED');
}

function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  return (typeof v === 'string' ? JSON.parse(v) : v) as T;
}

function authorDto(a: Record<string, any>) {
  return {
    firstName: a.first_name,
    middleName: a.middle_name,
    lastName: a.last_name,
    email: a.email,
    institution: a.institution,
    fullName: [a.first_name, a.middle_name, a.last_name].filter(Boolean).join(' '),
  };
}

export const STATUS_LABELS: Record<AbstractStatus, string> = {
  submitted: 'Submitted',
  resubmitted: 'Resubmitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
};

/** The abstract as it is now (current revision), without review history. */
export async function loadAbstract(conn: DbOrTrx, id: number) {
  const a = await conn('abstracts').where({ id }).first();
  if (!a) return null;
  const [authors, files] = await Promise.all([
    conn('abstract_authors').where({ abstract_id: id }).orderBy('sort'),
    conn('abstract_files').where({ abstract_id: id, revision: a.revision }).orderBy('id'),
  ]);
  const category = a.category as AbstractCategory;
  const status = a.status as AbstractStatus;
  return {
    id: a.id as number,
    userId: a.user_id as number,
    contactName: a.contact_name as string,
    contactEmail: a.contact_email as string,
    contactPhone: a.contact_phone as string | null,
    abstractNumber: a.abstract_number as string | null,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    status,
    statusLabel: STATUS_LABELS[status],
    revision: a.revision as number,
    reviewComment: a.review_comment as string | null,
    title: a.title as string,
    institution: a.institution as string,
    department: (a.department as string | null) ?? null,
    correspondingAuthor: (a.corresponding_author as string | null) ?? null,
    track: (a.track as string | null) ?? null,
    keywords: parseJson<string[]>(a.keywords, []),
    body: a.body as string,
    wordCount: a.word_count as number,
    referencesText: a.references_text,
    conflictOfInterest: a.conflict_of_interest,
    presentingAuthorAge: a.presenting_author_age,
    sgeiMembershipNo: a.sgei_membership_no,
    videoUrl: a.video_url,
    videoObjectives: a.video_objectives,
    techniqueJustification: a.technique_justification,
    englishNarrationConfirmed: !!a.english_narration_confirmed,
    declarationAccepted: !!a.declaration_accepted,
    submittingAuthor: authors.find((x) => x.role === 'submitting') ? authorDto(authors.find((x) => x.role === 'submitting')!) : null,
    presentingAuthor: authors.find((x) => x.role === 'presenting') ? authorDto(authors.find((x) => x.role === 'presenting')!) : null,
    coAuthors: authors.filter((x) => x.role === 'co_author').map(authorDto),
    files: files.map((f) => ({ id: f.id as number, kind: f.kind as FileKind, originalName: f.original_name as string, mimeType: f.mime_type as string, sizeBytes: f.size_bytes as number, uploadedAt: f.created_at })),
    submittedAt: a.submitted_at,
    resubmittedAt: a.resubmitted_at,
    reviewedAt: a.reviewed_at,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

export type AbstractDto = NonNullable<Awaited<ReturnType<typeof loadAbstract>>>;

/**
 * Timeline (oldest first): every submitted revision and every admin decision, plus the earlier
 * revisions' snapshots and files so reviewers can compare. `reviewer` is only included for admins.
 */
export async function loadHistory(conn: DbOrTrx, abstractId: number, opts: { forAdmin: boolean }) {
  const [versions, reviews, files] = await Promise.all([
    conn('abstract_versions').where({ abstract_id: abstractId }).orderBy('revision'),
    conn('abstract_reviews as r')
      .leftJoin('user_profiles as p', 'p.user_id', 'r.reviewer_id')
      .where('r.abstract_id', abstractId)
      .orderBy('r.id')
      .select('r.*', 'p.full_name as reviewer_name'),
    conn('abstract_files').where({ abstract_id: abstractId }).orderBy('id'),
  ]);
  type Event =
    | { type: 'submitted' | 'resubmitted'; revision: number; at: Date }
    | { type: 'review'; revision: number; at: Date; decision: 'accepted' | 'rejected' | 'duplicate'; comment: string | null; reviewer?: string | null };
  const events: Event[] = [
    ...versions.map((v) => ({ type: (v.revision === 1 ? 'submitted' : 'resubmitted') as 'submitted' | 'resubmitted', revision: v.revision as number, at: v.submitted_at as Date })),
    ...reviews.map((r) => ({
      type: 'review' as const,
      revision: r.revision as number,
      at: r.created_at as Date,
      decision: r.decision,
      comment: r.comment as string | null,
      ...(opts.forAdmin ? { reviewer: (r.reviewer_name as string | null) ?? null } : {}),
    })),
  ].sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime() || x.revision - y.revision || (x.type === 'review' ? 1 : -1));
  const previousVersions = opts.forAdmin
    ? versions.slice(0, -1).map((v) => ({
        revision: v.revision as number,
        submittedAt: v.submitted_at as Date,
        snapshot: parseJson<Record<string, unknown>>(v.snapshot, {}),
        files: files
          .filter((f) => f.revision === v.revision)
          .map((f) => ({ id: f.id as number, kind: f.kind as FileKind, originalName: f.original_name as string, sizeBytes: f.size_bytes as number })),
      }))
    : [];
  return { events, previousVersions };
}

function columns(input: AbstractSubmissionInput) {
  // Keywords are stored in alphabetical order as the guideline requires.
  const keywords = [...new Set(input.keywords.map((k) => k.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return {
    category: input.category,
    title: input.title,
    institution: input.institution,
    department: input.department,
    corresponding_author: input.correspondingAuthor,
    track: input.track || null,
    keywords: JSON.stringify(keywords),
    body: input.body,
    word_count: countWords(input.body),
    references_text: input.referencesText,
    conflict_of_interest: input.conflictOfInterest,
    presenting_author_age: input.category === 'yia' ? input.presentingAuthorAge : null,
    sgei_membership_no: input.sgeiMembershipNo,
    video_url: input.category === 'video' ? input.videoUrl : null,
    video_objectives: input.category === 'video' ? input.videoObjectives : null,
    technique_justification: input.category === 'video' ? input.techniqueJustification : null,
    english_narration_confirmed: input.category === 'video' ? input.englishNarrationConfirmed : false,
    declaration_accepted: input.declarationAccepted,
  };
}

async function replaceAuthors(conn: DbOrTrx, abstractId: number, input: AbstractSubmissionInput) {
  await conn('abstract_authors').where({ abstract_id: abstractId }).del();
  const rows: Record<string, unknown>[] = [];
  const push = (role: string, a: AuthorInput | null | undefined, sort: number) => {
    if (!a) return;
    rows.push({ abstract_id: abstractId, role, first_name: a.firstName, middle_name: a.middleName, last_name: a.lastName, email: a.email, institution: a.institution, sort });
  };
  push('submitting', input.submittingAuthor, 0);
  push('presenting', input.presentingAuthor, 1);
  input.coAuthors.forEach((c, i) => push('co_author', c, 10 + i));
  if (rows.length) await conn('abstract_authors').insert(rows);
}

// ---- Files ----

/** Accepted file types, recognised from the file's first bytes (never the browser's name / MIME type). */
const TYPES = {
  pdf: { kind: 'document', mime: 'application/pdf' },
  docx: { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  doc: { kind: 'document', mime: 'application/msword' },
  jpg: { kind: 'image', mime: 'image/jpeg' },
  png: { kind: 'image', mime: 'image/png' },
  mp4: { kind: 'video', mime: 'video/mp4' },
  mov: { kind: 'video', mime: 'video/quicktime' },
  webm: { kind: 'video', mime: 'video/webm' },
} as const satisfies Record<string, { kind: FileKind; mime: string }>;
type FileExt = keyof typeof TYPES;

const ACCEPTED_LABEL = 'PDF, Word (.doc/.docx), JPG, PNG, MP4, MOV or WebM';

/** Detect the real file type from its first bytes. `head` should hold at least the first 64 KB. */
export function sniffFileType(head: Buffer): FileExt | null {
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
    // DOCX is a ZIP that contains word/ entries.
    return head.includes(Buffer.from('word/')) ? 'docx' : null;
  }
  if (head.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'doc';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (head.subarray(4, 8).toString('latin1') === 'ftyp') return head.subarray(8, 12).toString('latin1') === 'qt  ' ? 'mov' : 'mp4';
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'webm';
  return null;
}

/** An upload saved to a temporary file by multer (large videos never sit in memory). */
export interface UploadedFile {
  originalname: string;
  path: string;
  size: number;
}

type CheckedFile = { file: UploadedFile; ext: FileExt; kind: FileKind; mime: string };
type WrittenFile = CheckedFile & { key: string; sha256: string };

const MB = 1024 * 1024;
const maxBytes = (kind: FileKind) => (kind === 'video' ? env.UPLOAD_MAX_VIDEO_MB : env.UPLOAD_MAX_MB) * MB;

async function readHead(file: UploadedFile): Promise<Buffer> {
  // A DOCX's "word/" entries can sit anywhere in the ZIP, so small ZIPs are read whole.
  const fh = await open(file.path, 'r');
  try {
    const len = Math.min(file.size, 64 * 1024);
    const head = Buffer.alloc(len);
    await fh.read(head, 0, len, 0);
    if (head[0] === 0x50 && head[1] === 0x4b && file.size <= env.UPLOAD_MAX_MB * MB) return readWholeFile(file.path);
    return head;
  } finally {
    await fh.close();
  }
}

/**
 * Checks the uploads' real types and size limits (videos: UPLOAD_MAX_VIDEO_MB, others: UPLOAD_MAX_MB,
 * at most MAX_VIDEOS videos including kept ones). Problems go to errors.files.
 */
async function checkFiles(files: UploadedFile[], errors: Record<string, string>, keptVideos = 0): Promise<CheckedFile[]> {
  const checked: CheckedFile[] = [];
  const problems: string[] = [];
  for (const file of files) {
    const ext = file.size > 0 ? sniffFileType(await readHead(file)) : null;
    if (!ext) {
      problems.push(`“${file.originalname}” is not an accepted file type. Please upload ${ACCEPTED_LABEL}.`);
      continue;
    }
    const { kind, mime } = TYPES[ext];
    if (file.size > maxBytes(kind)) {
      problems.push(`“${file.originalname}” is too large – ${kind === 'video' ? 'videos' : 'documents and images'} can be up to ${kind === 'video' ? env.UPLOAD_MAX_VIDEO_MB : env.UPLOAD_MAX_MB} MB.`);
      continue;
    }
    checked.push({ file, ext, kind, mime });
  }
  if (keptVideos + checked.filter((c) => c.kind === 'video').length > MAX_VIDEOS) problems.push(`Please upload only ${MAX_VIDEOS} video per abstract.`);
  if (problems.length) errors.files = problems.join(' ');
  return checked;
}

async function sha256OfFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

async function writeFiles(checked: CheckedFile[]): Promise<WrittenFile[]> {
  const written: WrittenFile[] = [];
  for (const c of checked) {
    const sha256 = await sha256OfFile(c.file.path);
    const key = `abstracts/${now().toISOString().slice(0, 10)}/${c.kind}-${randomToken(16)}.${c.ext}`;
    await getStorage().writeFromFile(key, c.file.path);
    written.push({ ...c, key, sha256 });
  }
  return written;
}

async function insertFileRows(trx: Trx, abstractId: number, revision: number, written: WrittenFile[]) {
  for (const w of written) {
    const safeName = w.file.originalname.replace(/[^\w.\- ()]+/g, '_').slice(0, 200) || `file.${w.ext}`;
    await trx('abstract_files').insert({
      abstract_id: abstractId,
      revision,
      kind: w.kind,
      original_name: safeName,
      mime_type: w.mime,
      size_bytes: w.file.size,
      storage_key: w.key,
      sha256: w.sha256,
    });
  }
}

/** Snapshot of the current revision (stored after every submission). */
async function saveVersion(trx: Trx, abstractId: number, revision: number, at: Date) {
  const snap = await loadAbstract(trx, abstractId);
  await trx('abstract_versions').insert({ abstract_id: abstractId, revision, snapshot: JSON.stringify(snap), submitted_at: at });
}

/** Name, email and mobile of the account (the submitter), from the database only. */
async function accountContact(conn: DbOrTrx, userId: number) {
  const u = await conn('users as u')
    .leftJoin('user_profiles as p', 'p.user_id', 'u.id')
    .where('u.id', userId)
    .first('u.email', 'u.role', 'u.status', 'p.title', 'p.full_name', 'p.phone_country_code', 'p.phone_number');
  if (!u || u.status !== 'active') throw Errors.unauthorized();
  if (u.role !== 'participant') throw Errors.forbidden('Admin accounts cannot submit abstracts. Please use a delegate account.');
  return {
    email: String(u.email).toLowerCase(),
    name: [u.title, u.full_name].filter(Boolean).join(' ').trim() || String(u.email),
    phone: u.phone_number ? `${u.phone_country_code ?? ''} ${u.phone_number}`.trim() : null,
  };
}

function notifyPayload(a: { abstractNumber: string; title: string; category: AbstractCategory }, fullName: string, at: Date) {
  return { fullName, abstractNumber: a.abstractNumber, title: a.title, categoryLabel: CATEGORY_LABELS[a.category], submittedAt: formatEventDateTime(at) };
}

const myAbstractsUrl = () => `${env.FRONTEND_URL.replace(/\/$/, '')}/my-abstracts`;

// ---- Submit (new abstract) ----

export async function submitAbstract(userId: number, input: AbstractSubmissionInput, files: UploadedFile[]) {
  assertWindowOpen();
  const contact = await accountContact(db, userId);
  // The submitting author is always the account holder (email locked to the account).
  const withAccount: AbstractSubmissionInput = input.submittingAuthor ? { ...input, submittingAuthor: { ...input.submittingAuthor, email: contact.email } } : input;

  const errors = validateForSubmit(withAccount, files.length);
  const checked = await checkFiles(files, errors);
  if (Object.keys(errors).length) throw Errors.validation(errors, 'Please correct the highlighted fields.');

  const written = await writeFiles(checked);
  try {
    return await db.transaction(async (trx) => {
      const number = `${env.ABSTRACT_NUMBER_PREFIX}-${pad(await nextSequenceValue(trx, 'abstract_number'))}`;
      const t = now();
      const [id] = await trx('abstracts').insert({
        ...columns(withAccount),
        user_id: userId,
        status: 'submitted',
        revision: 1,
        abstract_number: number,
        submitted_at: t,
        contact_name: contact.name,
        contact_email: contact.email,
        contact_phone: contact.phone,
      });
      await replaceAuthors(trx, id, withAccount);
      await insertFileRows(trx, id, 1, written);
      await saveVersion(trx, id, 1, t);

      const payload = notifyPayload({ abstractNumber: number, title: input.title, category: input.category }, contact.name, t);
      await enqueueEmail(trx, contact.email, 'abstract_submitted', { ...payload, myAbstractsUrl: myAbstractsUrl() }, { related: { type: 'abstract', id }, dedupeKey: `abstract-submitted:${id}:1` });
      for (const to of env.adminNotificationEmails) {
        await enqueueEmail(trx, to, 'abstract_admin_notification', { ...payload, kind: 'new', email: contact.email }, { related: { type: 'abstract', id }, dedupeKey: `abstract-admin:${id}:1:${to}` });
      }
      return { id: id as number, abstractNumber: number, title: input.title };
    });
  } catch (err) {
    await Promise.all(written.map((w) => getStorage().remove(w.key).catch(() => undefined)));
    throw err;
  }
}

// ---- Resubmit (after Reject / Duplicate) ----

export async function resubmitAbstract(userId: number, abstractId: number, input: AbstractSubmissionInput, files: UploadedFile[]) {
  assertWindowOpen();
  const contact = await accountContact(db, userId);
  const current = await db('abstracts').where({ id: abstractId, user_id: userId }).first('status', 'revision');
  if (!current) throw Errors.notFound('Abstract not found.');
  if (!RESUBMITTABLE.includes(current.status)) {
    throw Errors.conflict('This abstract can only be revised after the Scientific Committee returns it (Rejected or Duplicate).', 'NOT_RESUBMITTABLE');
  }
  const withAccount: AbstractSubmissionInput = input.submittingAuthor ? { ...input, submittingAuthor: { ...input.submittingAuthor, email: contact.email } } : input;

  // Files of the previous revision the author chose to keep (the rest are dropped from this revision).
  const keep = new Set(input.keepFileIds);
  const kept = ((await db('abstract_files').where({ abstract_id: abstractId, revision: current.revision })) as Record<string, any>[]).filter((f) => keep.has(f.id));
  const errors = validateForSubmit(withAccount, kept.length + files.length);
  const checked = await checkFiles(files, errors, kept.filter((f) => f.kind === 'video').length);
  if (Object.keys(errors).length) throw Errors.validation(errors, 'Please correct the highlighted fields.');

  const written = await writeFiles(checked);
  try {
    return await db.transaction(async (trx) => {
      // Re-check under a row lock (two tabs / double click).
      const row = await trx('abstracts').where({ id: abstractId, user_id: userId }).forUpdate().first('status', 'revision', 'abstract_number');
      if (!row || !RESUBMITTABLE.includes(row.status)) throw Errors.conflict('This abstract has already been resubmitted.', 'NOT_RESUBMITTABLE');
      const revision = Number(row.revision) + 1;
      const t = now();
      await trx('abstracts').where({ id: abstractId }).update({
        ...columns(withAccount),
        status: 'resubmitted',
        revision,
        resubmitted_at: t,
        contact_name: contact.name,
        contact_phone: contact.phone,
      });
      await replaceAuthors(trx, abstractId, withAccount);
      // Carry over the kept files (same stored file, new revision row).
      for (const f of kept) {
        await trx('abstract_files').insert({
          abstract_id: abstractId,
          revision,
          kind: f.kind,
          original_name: f.original_name,
          mime_type: f.mime_type,
          size_bytes: f.size_bytes,
          storage_key: f.storage_key,
          sha256: f.sha256,
        });
      }
      await insertFileRows(trx, abstractId, revision, written);
      await saveVersion(trx, abstractId, revision, t);

      const payload = notifyPayload({ abstractNumber: row.abstract_number, title: input.title, category: input.category }, contact.name, t);
      await enqueueEmail(trx, contact.email, 'abstract_resubmitted', { ...payload, myAbstractsUrl: myAbstractsUrl() }, { related: { type: 'abstract', id: abstractId }, dedupeKey: `abstract-resubmitted:${abstractId}:${revision}` });
      for (const to of env.adminNotificationEmails) {
        await enqueueEmail(trx, to, 'abstract_admin_notification', { ...payload, kind: 'resubmitted', email: contact.email }, { related: { type: 'abstract', id: abstractId }, dedupeKey: `abstract-admin:${abstractId}:${revision}:${to}` });
      }
      return { id: abstractId, abstractNumber: row.abstract_number as string, title: input.title, revision };
    });
  } catch (err) {
    await Promise.all(written.map((w) => getStorage().remove(w.key).catch(() => undefined)));
    throw err;
  }
}

// ---- The author's own abstracts ----

export async function listMyAbstracts(userId: number) {
  const rows = await db('abstracts').where({ user_id: userId }).orderBy('submitted_at', 'desc').orderBy('id', 'desc');
  const window = submissionWindow();
  return {
    window,
    abstracts: rows.map((a) => {
      const status = a.status as AbstractStatus;
      return {
        id: a.id as number,
        abstractNumber: a.abstract_number as string,
        title: a.title as string,
        category: a.category as AbstractCategory,
        categoryLabel: CATEGORY_LABELS[a.category as AbstractCategory],
        status,
        statusLabel: STATUS_LABELS[status],
        revision: a.revision as number,
        reviewComment: RESUBMITTABLE.includes(status) ? (a.review_comment as string | null) : null,
        submittedAt: a.submitted_at,
        resubmittedAt: a.resubmitted_at,
        reviewedAt: a.reviewed_at,
        canResubmit: RESUBMITTABLE.includes(status) && window.isOpen,
      };
    }),
  };
}

export async function getMyAbstract(userId: number, abstractId: number) {
  const a = await loadAbstract(db, abstractId);
  if (!a || a.userId !== userId) throw Errors.notFound('Abstract not found.');
  const history = await loadHistory(db, abstractId, { forAdmin: false });
  return { ...a, history: history.events, canResubmit: RESUBMITTABLE.includes(a.status) && submissionWindow().isOpen };
}

/** Download of one of the author's own current files. */
export async function readMyFile(userId: number, fileId: number) {
  const f = await db('abstract_files as f').join('abstracts as a', 'a.id', 'f.abstract_id').where('f.id', fileId).first('f.*', 'a.user_id');
  if (!f || f.user_id !== userId) throw Errors.notFound('File not found.');
  return { ...(await getStorage().readStream(f.storage_key)), name: f.original_name as string, mime: f.mime_type as string };
}

/** Admin download of any uploaded file (any revision). */
export async function readFile(fileId: number) {
  const f = await db('abstract_files').where({ id: fileId }).first();
  if (!f) throw Errors.notFound('File not found.');
  return { ...(await getStorage().readStream(f.storage_key)), name: f.original_name as string, mime: f.mime_type as string };
}
