import React, { useEffect, useState } from 'react';
import { Lock, Send } from 'lucide-react';
import { api } from '../../lib/api';
import type { AbstractCategory, AbstractRecord, Profile } from '../../api/types';
import { DEFAULT_LIMITS, FileUploader } from './FileUploader';
import { useSubmissionWindow } from './PublicAbstractForm';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, SelectInput, TextArea, TextInput } from '../../components/ui/Field';
import { Alert, fieldErrors } from '../../components/ui/States';

/**
 * The abstract form, used for a new submission (home page) and for "Revise & resubmit"
 * (My Abstracts). The submitter must be logged in: their name, email and mobile come from the
 * account (the server takes them from the session, never from this form). The server re-checks
 * every rule of the "Abstract Submission Guideline – ENDOCON 2027".
 */

/** Track / Theme options (the server accepts only these). */
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
];

export const ABSTRACT_TYPES: { id: AbstractCategory; name: string }[] = [
  { id: 'plenary', name: 'Plenary Session (SGEI members only)' },
  { id: 'yia', name: 'Young Investigator Award (under 45)' },
  { id: 'oral', name: 'Oral Paper Presentation' },
  { id: 'eposter', name: 'E-Poster Presentation' },
  { id: 'video', name: 'Video Digest Session' },
];


const DECLARATIONS = [
  'The abstract is original, unpublished and not under review elsewhere.',
  'All listed authors have approved the submission and declared any conflicts of interest.',
  'The presenting author will register for the conference if accepted.',
  'I consent to publication of the abstract exactly as submitted.',
];

const MAX_WORDS = 300;

type Form = {
  firstName: string;
  lastName: string;
  institution: string;
  department: string;
  correspondingAuthor: string;
  track: string;
  coAuthors: string;
  sgeiMembershipNo: string;
  category: AbstractCategory | '';
  presentingAuthorAge: string;
  title: string;
  body: string;
  keywords: string;
  declarations: boolean[];
};

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const list = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);

/** "Dr. Ravi K Menon" → first "Ravi", middle "K", last "Menon" (a one-word name has no last name). */
function splitName(full: string) {
  const parts = full.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    middleName: parts.slice(1, -1).join(' ') || null,
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
    email: null,
    institution: null,
  };
}

function initialForm(profile: Profile, initial?: AbstractRecord): Form {
  if (initial) {
    const p = initial.presentingAuthor ?? initial.submittingAuthor;
    return {
      firstName: [p?.firstName, p?.middleName].filter(Boolean).join(' '),
      lastName: p?.lastName ?? '',
      institution: initial.institution ?? '',
      department: initial.department ?? '',
      correspondingAuthor: initial.correspondingAuthor ?? '',
      track: initial.track ?? '',
      coAuthors: initial.coAuthors.map((c) => c.fullName).join(', '),
      sgeiMembershipNo: initial.sgeiMembershipNo ?? '',
      category: initial.category,
      presentingAuthorAge: initial.presentingAuthorAge != null ? String(initial.presentingAuthorAge) : '',
      title: initial.title,
      body: initial.body,
      keywords: initial.keywords.join(', '),
      declarations: DECLARATIONS.map(() => false), // confirmed again for every revision
    };
  }
  const n = splitName(profile.fullName ?? '');
  return {
    firstName: [n.firstName, n.middleName].filter(Boolean).join(' '),
    lastName: n.lastName,
    institution: profile.organization ?? '',
    department: '',
    // Usually the person submitting; can be changed.
    correspondingAuthor: [profile.title, profile.fullName].filter(Boolean).join(' '),
    track: '',
    coAuthors: '',
    sgeiMembershipNo: profile.membershipNo ?? '',
    category: '',
    presentingAuthorAge: '',
    title: '',
    body: '',
    keywords: '',
    declarations: DECLARATIONS.map(() => false),
  };
}

function toPayload(f: Form, email: string) {
  // The account holder is the presenting (and submitting) author and receives all communications;
  // the server replaces the email with the account email in any case.
  const author = { firstName: f.firstName.trim(), middleName: null, lastName: f.lastName.trim(), email, institution: f.institution.trim() || null };
  return {
    category: f.category,
    title: f.title.trim(),
    institution: f.institution.trim(),
    department: f.department.trim(),
    correspondingAuthor: f.correspondingAuthor.trim(),
    track: f.track,
    keywords: list(f.keywords),
    body: f.body,
    sgeiMembershipNo: f.sgeiMembershipNo.trim() || null,
    presentingAuthorAge: f.category === 'yia' && f.presentingAuthorAge ? Number(f.presentingAuthorAge) : null,
    declarationAccepted: f.declarations.every(Boolean),
    submittingAuthor: author,
    presentingAuthor: author,
    coAuthors: list(f.coAuthors).map(splitName),
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-serif text-lg font-bold text-[#580c1e] mb-4">{children}</h3>;
}

export interface AbstractSubmitResult {
  id: number;
  abstractNumber: string;
  title: string;
  revision?: number;
}

export function AbstractForm({
  profile,
  initial,
  preset,
  onSubmitted,
  formId = 'abstract-form',
}: {
  /** The logged-in account (name, email, mobile, institution). */
  profile: Profile;
  /** Set when revising a returned abstract: fields start from it and it is resubmitted. */
  initial?: AbstractRecord;
  /** Category buttons elsewhere on the page pre-select a type: every new `key` applies `category`. */
  preset?: { key: number; category?: AbstractCategory };
  onSubmitted: (r: AbstractSubmitResult) => void;
  formId?: string;
}) {
  const resubmit = !!initial;
  const [form, setForm] = useState<Form>(() => initialForm(profile, initial));
  const [files, setFiles] = useState<File[]>([]);
  // When revising: files of the current revision that are kept (all by default).
  const [keepIds, setKeepIds] = useState<number[]>(() => initial?.files.map((f) => f.id) ?? []);
  const [progress, setProgress] = useState<number | null>(null);
  const limits = useSubmissionWindow().data?.uploadLimits ?? DEFAULT_LIMITS;
  const [local, setLocal] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    // A corrected field stops showing its error straight away.
    setLocal((l) => {
      if (!(k in l)) return l;
      const { [k]: _drop, ...rest } = l;
      return rest;
    });
  };
  const text = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);
  const wc = words(form.body);
  const phone = profile.phoneNumber ? `${profile.phoneCountryCode ?? ''} ${profile.phoneNumber}`.trim() : '—';

  // Server field names → the fields on this form.
  const server = fieldErrors(error);
  const errs: Record<string, string> = {
    ...server,
    ...(server.presentingAuthor && { firstName: server.presentingAuthor }),
    ...(server['presentingAuthor.firstName'] && { firstName: server['presentingAuthor.firstName'] }),
    ...(server['presentingAuthor.lastName'] && { lastName: server['presentingAuthor.lastName'] }),
    ...(server.declarationAccepted && { declarations: server.declarationAccepted }),
    ...local,
  };

  useEffect(() => {
    if (preset?.category) setForm((f) => ({ ...f, category: preset.category! }));
  }, [preset?.key, preset?.category]);

  /** Quick checks before sending; the server re-checks everything. */
  const check = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Enter the first name.';
    if (!form.lastName.trim()) e.lastName = 'Enter the last name.';
    if (!form.institution.trim()) e.institution = 'Enter the institution / affiliation.';
    if (!form.department.trim()) e.department = 'Enter the department.';
    if (!form.correspondingAuthor.trim()) e.correspondingAuthor = 'Enter the corresponding author’s name.';
    if (!form.track) e.track = 'Select a track / theme.';
    if (!form.category) e.category = 'Select the presentation type.';
    if (form.category === 'plenary' && !form.sgeiMembershipNo.trim()) e.sgeiMembershipNo = 'Plenary sessions are open to SGEI members only – enter the membership number.';
    if (form.category === 'yia') {
      const age = Number(form.presentingAuthorAge);
      if (!form.presentingAuthorAge) e.presentingAuthorAge = 'Enter the presenting author’s age.';
      else if (age >= 45) e.presentingAuthorAge = 'The presenting author must be under 45 years of age.';
    }
    if (form.title.trim().length < 5) e.title = 'Enter the abstract title.';
    if (wc > MAX_WORDS) e.body = `The abstract must not exceed ${MAX_WORDS} words (currently ${wc}).`;
    const kw = list(form.keywords).length;
    if (kw < 3 || kw > 4) e.keywords = 'Enter 3–4 keywords.';
    if (!form.declarations.every(Boolean)) e.declarations = 'Please confirm all the declarations.';
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = check();
    setError(null);
    setLocal(e);
    if (Object.keys(e).length) {
      setTimeout(() => document.querySelector(`#${formId} [aria-invalid="true"], #${formId} [role="alert"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('data', JSON.stringify({ ...toPayload(form, profile.email), ...(resubmit && { keepFileIds: keepIds }) }));
      for (const f of files) fd.append('files', f);
      setProgress(files.length ? 0 : null);
      const res = await api.upload<AbstractSubmitResult>(resubmit ? `/abstracts/mine/${initial!.id}/resubmit` : '/abstracts/submit', fd, files.length ? setProgress : undefined);
      if (!resubmit) {
        // Start a fresh form straight away (the caller shows the success message).
        setForm(initialForm(profile));
        setFiles([]);
      }
      onSubmitted(res.data);
    } catch (err) {
      setError(err);
      setTimeout(() => document.getElementById(`${formId}-errors`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id={formId} noValidate onSubmit={submit} className="space-y-9">
      <div id={`${formId}-errors`}>
        {error != null && (
          <Alert tone="error">
            {(error as Error).message}
            {Object.keys(server).length > 0 && (
              <ul className="list-disc pl-4 mt-1">
                {[...new Set(Object.values(server))].map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
      </div>

      <section>
        <SectionTitle>Presenting Author</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <Field label="First name" name="firstName" required error={errs.firstName}>
            <TextInput name="firstName" autoComplete="given-name" value={form.firstName} onChange={text('firstName')} invalid={!!errs.firstName} placeholder="First name" />
          </Field>
          <Field label="Last name" name="lastName" required error={errs.lastName}>
            <TextInput name="lastName" autoComplete="family-name" value={form.lastName} onChange={text('lastName')} invalid={!!errs.lastName} placeholder="Last name" />
          </Field>
          <Field label="Email" name="accountEmail" hint={<span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> From your account – all communications go here</span>}>
            <TextInput name="accountEmail" value={profile.email} disabled readOnly />
          </Field>
          <Field label="Mobile" name="accountPhone" hint={<span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> From your account</span>}>
            <TextInput name="accountPhone" value={phone} disabled readOnly />
          </Field>
          <Field label="Institution / Affiliation" name="institution" required error={errs.institution}>
            <TextInput name="institution" value={form.institution} onChange={text('institution')} invalid={!!errs.institution} placeholder="Institution / Affiliation" />
          </Field>
          <Field label="Department" name="department" required error={errs.department}>
            <TextInput name="department" value={form.department} onChange={text('department')} invalid={!!errs.department} placeholder="e.g. Gastroenterology" />
          </Field>
          <Field label="Corresponding author name" name="correspondingAuthor" required error={errs.correspondingAuthor} className="sm:col-span-2">
            <TextInput name="correspondingAuthor" value={form.correspondingAuthor} onChange={text('correspondingAuthor')} invalid={!!errs.correspondingAuthor} placeholder="Full name of the corresponding author" />
          </Field>
          <Field label="Co-authors" name="coAuthors" error={errs.coAuthors} className="sm:col-span-2">
            <TextInput name="coAuthors" value={form.coAuthors} onChange={text('coAuthors')} placeholder="Comma-separated list" />
          </Field>
          <Field label="SGEI membership number" name="sgeiMembershipNo" required={form.category === 'plenary'} error={errs.sgeiMembershipNo} className="sm:col-span-2">
            <TextInput name="sgeiMembershipNo" value={form.sgeiMembershipNo} onChange={text('sgeiMembershipNo')} invalid={!!errs.sgeiMembershipNo} placeholder="Membership number" />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>Abstract Details</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Presentation type" name="category" required error={errs.category}>
            <SelectInput name="category" value={form.category} onChange={text('category')} invalid={!!errs.category}>
              <option value="" disabled>
                Select type
              </option>
              {ABSTRACT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Track / Theme" name="track" required error={errs.track}>
            <SelectInput name="track" value={form.track} onChange={text('track')} invalid={!!errs.track}>
              <option value="" disabled>
                Select track / theme
              </option>
              {ABSTRACT_TRACKS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
          </Field>
          {form.category === 'yia' && (
            <Field label="Presenting author's age" name="presentingAuthorAge" required error={errs.presentingAuthorAge}>
              <TextInput name="presentingAuthorAge" inputMode="numeric" maxLength={3} value={form.presentingAuthorAge} onChange={text('presentingAuthorAge')} invalid={!!errs.presentingAuthorAge} placeholder="Age" />
            </Field>
          )}
          <Field label="Abstract title" name="title" required error={errs.title} className="sm:col-span-2">
            <TextInput name="title" value={form.title} onChange={text('title')} invalid={!!errs.title} placeholder="Abstract title" />
          </Field>
          <Field
            label="Abstract body"
            name="body"
            optional
            error={errs.body}
            className="sm:col-span-2"
            hint={wc > 0 ? <span className={wc > MAX_WORDS ? 'text-red-700 font-bold' : ''}>{wc} / {MAX_WORDS} words</span> : undefined}
          >
            <TextArea name="body" rows={6} value={form.body} onChange={text('body')} invalid={wc > MAX_WORDS || !!errs.body} placeholder={`Background, Methods, Results, Conclusion (max ${MAX_WORDS} words)`} />
          </Field>
          <Field label="Keywords" name="keywords" required error={errs.keywords} className="sm:col-span-2">
            <TextInput name="keywords" value={form.keywords} onChange={text('keywords')} invalid={!!errs.keywords} placeholder="3–4 keywords, comma-separated" />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>
          Files <span className="font-sans text-sm font-medium text-[#665e5d]">(optional)</span>
        </SectionTitle>
        <p className="text-xs text-[#665e5d] -mt-2 mb-4">
          Upload your abstract or full manuscript and any figures, and for a video presentation the video itself. {resubmit && 'Your current files are kept unless you remove them.'}
        </p>
        <FileUploader
          files={files}
          onFilesChange={(f) => {
            setFiles(f);
            setLocal(({ files: _drop, ...rest }) => rest);
          }}
          kept={initial?.files.map((f) => ({ id: f.id, originalName: f.originalName, kind: f.kind, sizeBytes: f.sizeBytes }))}
          keepIds={keepIds}
          onKeepIdsChange={setKeepIds}
          limits={limits}
          error={errs.files}
          disabled={submitting}
        />
      </section>

      <section>
        <SectionTitle>Declarations</SectionTitle>
        <div className="space-y-2.5">
          {DECLARATIONS.map((d, i) => (
            <Checkbox key={d} label={d} checked={form.declarations[i]} onChange={(e) => set('declarations', form.declarations.map((x, j) => (j === i ? e.target.checked : x)))} />
          ))}
        </div>
        {errs.declarations && (
          <p className="text-[11px] text-red-700 mt-2" role="alert">
            {errs.declarations}
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={submitting} icon={<Send className="w-4 h-4" />}>
          {resubmit ? 'Resubmit Abstract' : 'Submit Abstract'}
        </Button>
        {submitting && progress !== null && (
          <div className="flex-1 min-w-[200px] max-w-sm" role="status" aria-live="polite">
            <div className="flex justify-between text-[11px] text-[#665e5d] mb-1">
              <span>{progress < 100 ? 'Uploading files… please keep this page open' : 'Saving your abstract…'}</span>
              <span className="font-semibold text-[#580c1e]">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-black/[0.07] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#580c1e] to-[#c89e37] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
