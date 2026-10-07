import { z } from 'zod';

/**
 * Abstract submission – from "Abstract Submission Guideline – ENDOCON 2027".
 * Drafts accept partial data; submission applies the full guideline rules (see validateForSubmit).
 */
export const ABSTRACT_CATEGORIES = ['plenary', 'yia', 'oral', 'eposter', 'video'] as const;
export type AbstractCategory = (typeof ABSTRACT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AbstractCategory, string> = {
  plenary: 'Plenary Session',
  yia: 'Young Investigator Award (YIA)',
  oral: 'Oral Paper Presentation',
  eposter: 'E-Poster Presentation',
  video: 'Endoscopy – Video Digest Session',
};

/**
 * Uploads are not tied to the presentation type: every abstract has 1–MAX_FILES files of any
 * accepted type. `kind` is decided on the server from the file's real content (never its name).
 *  - document: PDF, Word (.doc / .docx)          – up to UPLOAD_MAX_MB
 *  - image:    JPG, PNG                          – up to UPLOAD_MAX_MB
 *  - video:    MP4, MOV, WebM (one per abstract) – up to UPLOAD_MAX_VIDEO_MB
 */
export const FILE_KINDS = ['document', 'image', 'video'] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export const MAX_FILES = 5;
export const MAX_VIDEOS = 1;

/** Track / Theme options on the abstract form. */
export const ABSTRACT_TRACKS = [
  'Transplant & HPB Surgery',
  'Hepatology',
  'Anaesthesia & Critical Care',
  'Interventional Radiology',
  'Pathology & Immunology',
  'Pediatric Liver Transplant',
  'Transplant Oncology',
  'Nursing & Coordination',
  'Translational/Basic Science',
  'Diagnostic/Transplant Radiology',
] as const;

export const MAX_WORDS = 300;

const name = z.string().trim().max(80);

export const authorSchema = z.object({
  firstName: name.min(1, 'Enter the first name.'),
  middleName: name.optional().nullable().transform((v) => v || null),
  lastName: name.min(1, 'Enter the last name.'),
  email: z
    .union([z.email('Enter a valid email address.'), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => v || null),
  institution: z.string().trim().max(250).optional().nullable().transform((v) => v || null),
});
export type AuthorInput = z.infer<typeof authorSchema>;

/** Co-authors are entered as a comma-separated list of names, so a single-word name is allowed. */
export const coAuthorSchema = authorSchema.extend({ lastName: name.default('') });

const text = (max: number) => z.string().max(max).optional().nullable().transform((v) => v ?? null);

export const abstractDraftSchema = z.object({
  category: z.enum(ABSTRACT_CATEGORIES, { message: 'Select an abstract category.' }),
  title: z.string().trim().max(300).default(''),
  institution: z.string().trim().max(250).default(''),
  department: z.string().trim().max(200).default(''),
  correspondingAuthor: z.string().trim().max(200).default(''),
  track: z.union([z.enum(ABSTRACT_TRACKS, { message: 'Select a track / theme.' }), z.literal('')]).default(''),
  keywords: z.array(z.string().trim().min(1).max(60)).max(6, 'Provide 3–4 keywords.').default([]),
  body: z.string().max(20_000).default(''),
  referencesText: text(20_000),
  conflictOfInterest: text(2_000),
  presentingAuthorAge: z
    .union([z.coerce.number().int().min(18).max(100), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  sgeiMembershipNo: z.string().trim().max(60).optional().nullable().transform((v) => v || null),
  /** No longer asked for (videos are uploaded as files); accepted for older clients and ignored. */
  videoUrl: z.string().max(500).optional().nullable().transform(() => null),
  videoObjectives: text(5_000),
  techniqueJustification: text(5_000),
  englishNarrationConfirmed: z.boolean().default(false),
  declarationAccepted: z.boolean().default(false),
  submittingAuthor: authorSchema.nullable().optional(),
  presentingAuthor: authorSchema.nullable().optional(),
  coAuthors: z.array(coAuthorSchema).max(20, 'A maximum of 20 co-authors is allowed.').default([]),
  /** Resubmission only: files of the previous revision to keep (the rest are dropped). */
  keepFileIds: z.array(z.coerce.number().int().positive()).max(MAX_FILES).optional().default([]),
});
export type AbstractDraftInput = z.infer<typeof abstractDraftSchema>;

export function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Full guideline validation, run at submission. Returns field -> message. */
export function validateForSubmit(a: AbstractDraftInput, fileCount: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (a.title.length < 5) e.title = 'Enter the abstract title.';
  else if (a.title === a.title.toUpperCase() && /[A-Z]/.test(a.title)) e.title = 'The title must be in sentence case, not all capitals.';
  if (!a.institution) e.institution = 'Enter the institution.';
  if (!a.department) e.department = 'Enter the department.';
  if (!a.correspondingAuthor) e.correspondingAuthor = 'Enter the corresponding author’s name.';
  if (!a.track) e.track = 'Select a track / theme.';
  if (a.keywords.length < 3 || a.keywords.length > 4) e.keywords = 'Provide 3–4 keywords.';
  const words = countWords(a.body);
  // The abstract body is optional (the abstract can be in the uploaded file); when given, max 300 words.
  if (words > MAX_WORDS) e.body = `The abstract must not exceed ${MAX_WORDS} words (currently ${words}).`;
  if (!a.submittingAuthor) e.submittingAuthor = 'Enter the submitting author.';
  else if (!a.submittingAuthor.email) e['submittingAuthor.email'] = 'The submitting author’s email is required (receives all communications).';
  if (!a.presentingAuthor) e.presentingAuthor = 'Enter the presenting author.';
  // One flag covers the declarations on the form (original work, authors' approval and conflict-of-interest
  // disclosure, presenting author will register, consent to publication as submitted).
  if (!a.declarationAccepted) e.declarationAccepted = 'Please confirm all the declarations.';

  if (a.category === 'plenary' && !a.sgeiMembershipNo) e.sgeiMembershipNo = 'Plenary sessions are open to SGEI members only – enter the SGEI membership number.';
  if (a.category === 'yia') {
    if (a.presentingAuthorAge == null) e.presentingAuthorAge = 'Enter the presenting author’s age.';
    else if (a.presentingAuthorAge >= 45) e.presentingAuthorAge = 'The presenting author must be under 45 years of age for YIA.';
  }
  // Files are optional (client decision, Oct 2026); only the maximum is enforced.
  if (fileCount > MAX_FILES) e.files = `Please upload at most ${MAX_FILES} files.`;
  return e;
}

/** Status set used by the review workflow (see migration 20260930000009). */
export const ABSTRACT_STATUSES = ['submitted', 'resubmitted', 'accepted', 'rejected', 'duplicate'] as const;
export type AbstractStatus = (typeof ABSTRACT_STATUSES)[number];
/** The author may revise and resubmit only after one of these decisions. */
export const RESUBMITTABLE: AbstractStatus[] = ['rejected', 'duplicate'];

/**
 * Submission / resubmission by a logged-in delegate. The submitter's name, email and mobile are
 * taken from the account on the server – never from the request.
 */
export const abstractSubmissionSchema = abstractDraftSchema;
export type AbstractSubmissionInput = z.infer<typeof abstractSubmissionSchema>;

/** Admin decision. A comment is required for Reject and Duplicate – it is sent to the author. */
export const abstractReviewSchema = z
  .object({
    decision: z.enum(['accepted', 'rejected', 'duplicate'], { message: 'Choose Accept, Reject or Duplicate.' }),
    comment: z.string().trim().max(3000).optional().nullable().transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (v.decision !== 'accepted' && (!v.comment || v.comment.length < 5)) {
      ctx.addIssue({ code: 'custom', path: ['comment'], message: 'Please enter a comment for the author (it is sent to them).' });
    }
  });
export type AbstractReviewInput = z.infer<typeof abstractReviewSchema>;
