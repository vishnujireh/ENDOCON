import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Info, Lock, Save, Send, ShieldAlert } from 'lucide-react';
import { apiUrl, reviewerApi } from '../../lib/api';
import { dateTime } from '../../lib/format';
import type { AbstractCategory, AbstractRecord, JudgeReview, JudgeReviewStatus, ReviewCriterion } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Field, SelectInput, TextArea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Alert, ApiErrorAlert, ErrorState, LoadingState, fieldErrors } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AbstractView } from '../abstracts/AbstractView';
import { PortalPage } from '../registration/RegistrationShell';
import { reviewerKeys } from './ReviewerDashboardPage';

interface ReviewerAbstractData {
  abstract: AbstractRecord;
  assignment: { status: JudgeReviewStatus; statusLabel: string; assignedAt: string };
  criteria: ReviewCriterion[];
  review: JudgeReview | null;
}

function Panel({ title, children, tone = 'bg-white' }: { title: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <section className={`${tone} rounded-2xl border border-black/[0.06] shadow-[0_10px_30px_-12px_rgba(88,12,30,0.15)] p-5 sm:p-7`}>
      <h2 className="font-serif text-lg font-bold text-[#580c1e] mb-5 flex items-center gap-2">{title}</h2>
      {children}
    </section>
  );
}

/** The submitted review, read-only (a reviewer sees only their own). */
function SubmittedReview({ r }: { r: JudgeReview }) {
  return (
    <div className="space-y-4">
      <Alert tone="success">
        <span className="font-semibold">Review submitted {r.submittedAt ? `on ${dateTime(r.submittedAt)}` : ''}. It cannot be changed.</span>
      </Alert>
      {r.coi ? (
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-sm text-violet-900">
          <p className="font-semibold">Conflict of interest declared</p>
          <p className="mt-1 whitespace-pre-wrap">{r.coiReason}</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {r.scores.map((s) => (
              <tr key={s.criterionId} className="border-b border-black/[0.06]">
                <td className="py-2 text-[#4e4443]">{s.criterionName}</td>
                <td className="py-2 text-right font-semibold">
                  {s.score} <span className="text-[#8a8280] font-normal">out of {s.maxScore}</span>
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-bold">Total</td>
              <td className="py-2 text-right font-serif text-lg font-bold text-[#580c1e]">
                {r.totalScore}
                {r.maxTotal ? <span className="text-xs text-[#665e5d]"> out of {r.maxTotal}</span> : null}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {!r.coi && r.recommendedCategoryLabel && (
        <p className="text-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">Category: </span>
          <span className="font-semibold text-[#580c1e]">{r.recommendedCategoryLabel}</span>
        </p>
      )}
      {r.comments && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] mb-1">Your comment</p>
          <p className="text-sm whitespace-pre-wrap bg-[#faf8f5] rounded-xl px-3 py-2">{r.comments}</p>
        </div>
      )}
    </div>
  );
}

/** Categories a judge can recommend (scoring sheet "Category"); defaults to the submitted one. */
const CATEGORY_OPTIONS: [AbstractCategory, string][] = [
  ['plenary', 'Plenary Session'],
  ['yia', 'Young Investigator Award (YIA)'],
  ['oral', 'Oral Paper Presentation'],
  ['eposter', 'E-Poster Presentation'],
  ['video', 'Video Digest Session'],
];

/** ⓘ Instruction for a criterion (the criterion description set by the admin). */
function Instruction({ id, text }: { id: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label="Instruction"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8b6a1f] hover:bg-[#fef3c7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89e37]/50 cursor-pointer"
      >
        <Info className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Instruction</span>
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute right-0 top-full mt-1.5 z-20 w-64 max-w-[calc(100vw-4rem)] rounded-xl bg-[#1a1918] text-[#faf8f5] text-xs leading-relaxed px-3 py-2 shadow-xl whitespace-pre-wrap normal-case tracking-normal font-normal">
          {text}
        </span>
      )}
    </span>
  );
}

/** Score picker: one button per point (0–max) for short scales, a number box for long ones. */
function ScorePicker({ c, value, onChange, error }: { c: ReviewCriterion; value: string; onChange: (v: string) => void; error?: string }) {
  const labelId = `score-label-${c.id}`;
  if (c.maxScore > 10)
    return (
      <div className="flex items-center gap-1.5">
        <input
          id={`score-${c.id}`}
          aria-labelledby={labelId}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          aria-invalid={!!error || undefined}
          className={`w-20 text-center rounded-xl border px-2 py-2 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#580c1e]/20 ${error ? 'border-red-400' : 'border-black/[0.1]'}`}
        />
        <span className="text-sm text-[#665e5d]">/ {c.maxScore}</span>
      </div>
    );
  return (
    <div role="radiogroup" aria-labelledby={labelId} aria-invalid={!!error || undefined} className="flex flex-wrap gap-1.5">
      {Array.from({ length: c.maxScore + 1 }, (_, n) => {
        const on = value === String(n);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            data-score={`${c.id}-${n}`}
            onClick={() => onChange(String(n))}
            className={`w-11 h-11 rounded-xl text-sm font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89e37] ${
              on
                ? 'bg-gradient-to-br from-[#580c1e] to-[#781029] text-[#fef3c7] shadow-[0_6px_16px_-6px_rgba(88,12,30,0.6)] ring-2 ring-[#d4af37]/70'
                : `bg-white text-[#4e4443] border hover:border-[#580c1e]/40 hover:text-[#580c1e] ${error ? 'border-red-300' : 'border-black/[0.1]'}`
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

type Tab = 'evaluation' | 'coi';

function EvaluationForm({ abstractId, data }: { abstractId: number; data: ReviewerAbstractData }) {
  const qc = useQueryClient();
  const draft = data.review;
  const [tab, setTab] = useState<Tab>(draft?.coi ? 'coi' : 'evaluation');
  const [coiReason, setCoiReason] = useState(draft?.coiReason ?? '');
  const [comments, setComments] = useState(draft?.comments ?? '');
  const [category, setCategory] = useState<string>(draft?.recommendedCategory ?? data.abstract.category ?? '');
  const [scores, setScores] = useState<Record<number, string>>(() => Object.fromEntries((draft?.scores ?? []).map((s) => [s.criterionId, String(s.score)])));
  const [local, setLocal] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  const [confirming, setConfirming] = useState(false);

  const coi = tab === 'coi';
  const criteria = data.criteria;
  const total = useMemo(() => criteria.reduce((s, c) => s + (Number(scores[c.id]) || 0), 0), [criteria, scores]);
  const maxTotal = criteria.reduce((s, c) => s + c.maxScore, 0);
  const scoredCount = criteria.filter((c) => scores[c.id] !== undefined && scores[c.id] !== '').length;
  const errs = { ...fieldErrors(error), ...local };

  useEffect(() => setSaved(null), [tab, coiReason, comments, scores, category]);

  const clear = (key: string) => local[key] && setLocal(({ [key]: _, ...rest }) => rest);

  const payload = () => ({
    coi,
    coiReason: coi ? coiReason.trim() : null,
    comments: coi ? null : comments.trim() || null,
    recommendedCategory: coi ? null : category || null,
    scores: coi ? [] : criteria.filter((c) => scores[c.id] !== undefined && scores[c.id] !== '').map((c) => ({ criterionId: c.id, score: Number(scores[c.id]) })),
  });

  const check = (final: boolean) => {
    const e: Record<string, string> = {};
    if (!coi) {
      for (const c of criteria) {
        const v = scores[c.id];
        if (v === undefined || v === '') {
          if (final) e[`score.${c.id}`] = `Select a score (0–${c.maxScore}).`;
        } else if (!/^\d+$/.test(v) || Number(v) > c.maxScore) e[`score.${c.id}`] = `Whole number from 0 to ${c.maxScore}.`;
      }
      if (final && !category) e.recommendedCategory = 'Select a category.';
    } else if (final && coiReason.trim().length < 5) e.coiReason = 'Please give the reason for the conflict of interest.';
    return e;
  };

  const saveDraft = async () => {
    const e = check(false);
    setLocal(e);
    setError(null);
    if (Object.keys(e).length) return;
    setBusy('draft');
    try {
      await reviewerApi.put(`/abstracts/${abstractId}/review`, payload());
      await qc.invalidateQueries({ queryKey: reviewerKeys.dashboard });
      setSaved('Draft saved. You can come back and finish it later.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const askSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const errors = check(true);
    setLocal(errors);
    setError(null);
    if (Object.keys(errors).length) return;
    setConfirming(true);
  };

  const submit = async () => {
    setBusy('submit');
    try {
      const res = await reviewerApi.post<ReviewerAbstractData>(`/abstracts/${abstractId}/review`, payload());
      qc.setQueryData(reviewerKeys.abstract(abstractId), res.data);
      await qc.invalidateQueries({ queryKey: reviewerKeys.dashboard });
      setConfirming(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err);
      setConfirming(false);
      // Already submitted elsewhere (another tab): show the stored review.
      await qc.invalidateQueries({ queryKey: reviewerKeys.abstract(abstractId) });
    } finally {
      setBusy(null);
    }
  };

  const tabs: [Tab, string, React.ReactNode][] = [
    ['evaluation', 'Evaluation', <ClipboardCheck key="e" className="w-4 h-4" />],
    ['coi', 'Conflict of interest (Decline)', <ShieldAlert key="c" className="w-4 h-4" />],
  ];

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-5 border-t border-[#c89e37]/20">
      <Button type="button" variant="secondary" icon={<Save className="w-4 h-4" />} loading={busy === 'draft'} disabled={!!busy} onClick={saveDraft}>
        Save draft
      </Button>
      <Button type="submit" icon={<Send className="w-4 h-4" />} disabled={!!busy || (!coi && criteria.length === 0)}>
        Submit
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {error != null && <ApiErrorAlert error={error} />}
      {saved && <Alert tone="success">{saved}</Alert>}

      {/* Tabs */}
      <div role="tablist" aria-label="Evaluation" className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#f3ece4] border border-[#c89e37]/25">
        {tabs.map(([key, label, icon]) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={on}
              aria-controls={`panel-${key}`}
              onClick={() => {
                setTab(key);
                setLocal({});
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer text-center ${
                on ? 'bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7] shadow-[0_8px_20px_-10px_rgba(88,12,30,0.7)]' : 'text-[#580c1e] hover:bg-white/70'
              }`}
            >
              {icon}
              {label}
            </button>
          );
        })}
      </div>

      {!coi ? (
        <form id="panel-evaluation" role="tabpanel" aria-labelledby="tab-evaluation" onSubmit={askSubmit} noValidate className="space-y-5">
          {criteria.length === 0 ? (
            <Alert tone="warning">The scoring criteria have not been set up yet. You can save comments as a draft; the organising team will let you know when scoring opens.</Alert>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-3">
                {criteria.map((c) => {
                  const err = errs[`score.${c.id}`];
                  return (
                    <div key={c.id} className={`rounded-2xl border bg-white px-4 py-3.5 transition-colors ${err ? 'border-red-300' : scores[c.id] ? 'border-[#c89e37]/50' : 'border-black/[0.08]'}`}>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <p id={`score-label-${c.id}`} className="text-sm font-bold text-[#1a1918]">
                          {c.name} <span className="font-medium text-[#665e5d]">(0–{c.maxScore})</span>
                        </p>
                        {c.description && <Instruction id={`instr-${c.id}`} text={c.description} />}
                      </div>
                      <ScorePicker
                        c={c}
                        value={scores[c.id] ?? ''}
                        error={err}
                        onChange={(v) => {
                          setScores((s) => ({ ...s, [c.id]: v }));
                          clear(`score.${c.id}`);
                        }}
                      />
                      {err && (
                        <p className="text-[11px] text-red-700 mt-1.5" role="alert">
                          {err}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#580c1e] to-[#781029] px-5 py-4 text-[#fef3c7]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">Total</p>
                  <p className="text-[11px] text-[#fef3c7]/70 mt-0.5">
                    {scoredCount} of {criteria.length} criteria scored
                  </p>
                </div>
                <p className="font-serif" aria-live="polite">
                  <span className="text-3xl font-bold">{total}</span> <span className="text-sm text-[#fef3c7]/80">out of {maxTotal}</span>
                </p>
              </div>
            </>
          )}

          <Field label="Category" name="recommendedCategory" required={criteria.length > 0} error={errs.recommendedCategory} hint="The category you recommend for this abstract. Pre-selected with the category the author chose.">
            <SelectInput
              name="recommendedCategory"
              value={category}
              placeholder="Select a category"
              invalid={!!errs.recommendedCategory}
              onChange={(e) => {
                setCategory(e.target.value);
                clear('recommendedCategory');
              }}
            >
              {CATEGORY_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                  {v === data.abstract.category ? ' (submitted)' : ''}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Comment" name="comments" optional>
            <TextArea name="comments" rows={4} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Your comments for the Scientific Committee" />
          </Field>

          {actions}
        </form>
      ) : (
        <form id="panel-coi" role="tabpanel" aria-labelledby="tab-coi" onSubmit={askSubmit} noValidate className="space-y-5">
          <p className="text-sm text-[#4e4443] rounded-xl bg-[#faf8f5] border border-black/[0.06] px-4 py-3">
            Decline this abstract if you cannot review it impartially (for example, you are an author, or the authors are from your department). You will not score it.
          </p>
          <Field label="Reason" name="coiReason" required error={errs.coiReason}>
            <TextArea
              name="coiReason"
              rows={5}
              value={coiReason}
              onChange={(e) => {
                setCoiReason(e.target.value);
                clear('coiReason');
              }}
              invalid={!!errs.coiReason}
              placeholder="e.g. The first author works in my department."
            />
          </Field>
          {actions}
        </form>
      )}

      <Modal open={confirming} onClose={() => setConfirming(false)} title={coi ? 'Decline this abstract?' : 'Submit your evaluation?'}>
        <div className="space-y-4 text-sm text-[#4e4443]">
          {coi ? (
            <p>
              You are declaring a <strong>conflict of interest</strong> for this abstract. It will not be scored by you.
            </p>
          ) : (
            <dl className="rounded-xl bg-[#faf8f5] divide-y divide-black/[0.06]">
              <div className="flex justify-between px-4 py-2.5">
                <dt>Total score</dt>
                <dd className="font-bold text-[#580c1e]">
                  {total} out of {maxTotal}
                </dd>
              </div>
              <div className="flex justify-between gap-3 px-4 py-2.5">
                <dt>Category</dt>
                <dd className="font-semibold text-right">{CATEGORY_OPTIONS.find(([v]) => v === category)?.[1]}</dd>
              </div>
            </dl>
          )}
          <p className="inline-flex items-center gap-1.5 text-xs">
            <Lock className="w-3.5 h-3.5" /> Once submitted, your review cannot be changed.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy === 'submit'}>
              Go back
            </Button>
            <Button loading={busy === 'submit'} onClick={submit} icon={<Send className="w-4 h-4" />}>
              {coi ? 'Yes, decline' : 'Yes, submit'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** One assigned abstract: read-only abstract, then (visually separate) the evaluation. */
export function ReviewerAbstractPage() {
  const id = Number(useParams().id);
  const q = useQuery({ queryKey: reviewerKeys.abstract(id), queryFn: () => reviewerApi.get<ReviewerAbstractData>(`/abstracts/${id}`), enabled: Number.isFinite(id), retry: false });
  if (q.isLoading) return <LoadingState label="Loading the abstract…" />;
  if (q.error || !q.data)
    return (
      <PortalPage title="Abstract not available" tag="Abstract Review">
        <ErrorState error={q.error} />
        <Link to="/reviewer" className="text-xs font-semibold text-[#580c1e] underline">
          Back to my assigned abstracts
        </Link>
      </PortalPage>
    );
  const d = q.data;
  const submitted = d.review?.state === 'submitted';

  return (
    <PortalPage title={d.abstract.abstractNumber ?? 'Abstract'} tag="Abstract Review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/reviewer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#580c1e] hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> My assigned abstracts
        </Link>
        <StatusBadge status={`review_${d.assignment.status}`} label={d.assignment.statusLabel} />
      </div>

      <Panel
        title={
          <>
            <Lock className="w-4 h-4" /> Submitted abstract <span className="text-xs font-sans font-normal text-[#8a8280]">(read-only)</span>
          </>
        }
      >
        <AbstractView a={{ ...d.abstract, status: undefined as never }} fileHref={(fileId) => apiUrl(`/reviewer/files/${fileId}`)} />
      </Panel>

      <Panel
        title={
          <>
            {d.review?.coi && submitted ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} Your evaluation
          </>
        }
        tone="bg-[#fffdf9] ring-1 ring-[#c89e37]/30"
      >
        {submitted ? <SubmittedReview r={d.review!} /> : <EvaluationForm key={d.review?.state ?? 'new'} abstractId={id} data={d} />}
      </Panel>
    </PortalPage>
  );
}
