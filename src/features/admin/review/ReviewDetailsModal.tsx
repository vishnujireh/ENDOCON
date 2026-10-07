import React, { useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { apiUrl } from '../../../lib/api';
import { dateTime } from '../../../lib/format';
import type { AdminAssignment } from '../../../api/types';
import { Modal } from '../../../components/ui/Modal';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { AbstractView } from '../../abstracts/AbstractView';
import { useAbstractReviews } from './AssignReviewersModal';

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone ?? 'bg-white border-black/[0.07]'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">{label}</p>
      <p className="font-serif text-xl font-bold text-[#1a1918] mt-0.5">{value}</p>
    </div>
  );
}

/** One judge's review, exactly as submitted (admins see every judge; judges never see each other). */
function JudgeCard({ a }: { a: AdminAssignment }) {
  const r = a.review;
  const submitted = r?.state === 'submitted';
  return (
    <div className={`rounded-2xl border p-4 ${a.active ? 'border-black/[0.08] bg-white' : 'border-dashed border-black/[0.12] bg-[#faf8f5]'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-[#1a1918] flex-1 min-w-0">
          {a.reviewerName} <span className="font-mono text-[11px] text-[#8a8280]">{a.reviewerCode}</span>
        </p>
        <StatusBadge status={`review_${a.status}`} label={a.statusLabel} />
        {submitted && !r!.coi && r!.totalScore !== null && (
          <span className="font-serif text-lg font-bold text-[#580c1e]">
            {r!.totalScore}
            {r!.maxTotal ? <span className="text-xs text-[#665e5d]">/{r!.maxTotal}</span> : null}
          </span>
        )}
      </div>
      <p className="text-[11px] text-[#8a8280] mt-1">
        Assigned {dateTime(a.assignedAt)}
        {submitted && r!.submittedAt && ` · submitted ${dateTime(r!.submittedAt)}`}
        {!a.active && a.removedAt && ` · removed ${dateTime(a.removedAt)}${a.replacedBy ? ` (reassigned to ${a.replacedBy})` : ''}`}
      </p>
      {!submitted && <p className="text-xs text-[#665e5d] mt-2">{r?.state === 'draft' ? 'Draft saved – not submitted yet.' : 'Not reviewed yet.'}</p>}
      {submitted && r!.coi && (
        <div className="mt-3 rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 text-sm text-violet-900">
          <span className="font-semibold">Conflict of interest:</span> {r!.coiReason}
        </div>
      )}
      {submitted && !r!.coi && r!.scores.length > 0 && (
        <table className="mt-3 w-full text-xs">
          <tbody>
            {r!.scores.map((s) => (
              <tr key={s.criterionId} className="border-t border-black/[0.05]">
                <td className="py-1.5 text-[#4e4443]">{s.criterionName}</td>
                <td className="py-1.5 text-right font-semibold">
                  {s.score} <span className="text-[#8a8280] font-normal">/ {s.maxScore}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {submitted && !r!.coi && r!.recommendedCategoryLabel && (
        <p className="mt-3 text-xs text-[#4e4443]">
          <span className="font-bold uppercase tracking-wider text-[10px] text-[#665e5d]">Recommended category:</span> <span className="font-semibold text-[#580c1e]">{r!.recommendedCategoryLabel}</span>
        </p>
      )}
      {submitted && r!.comments && <p className="mt-3 text-sm text-[#1a1918] whitespace-pre-wrap bg-[#faf8f5] rounded-xl px-3 py-2">{r!.comments}</p>}
    </div>
  );
}

export function ReviewDetailsModal({ abstractId, onClose }: { abstractId: number | null; onClose: () => void }) {
  const q = useAbstractReviews(abstractId);
  const [showAbstract, setShowAbstract] = useState(false);
  const d = q.data;
  const active = d?.assignments.filter((a) => a.active) ?? [];
  const removed = d?.assignments.filter((a) => !a.active) ?? [];

  return (
    <Modal open={!!abstractId} onClose={onClose} title="Review details" width="max-w-3xl">
      {q.isLoading ? (
        <LoadingState />
      ) : q.error || !d ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#580c1e]">{d.abstract.abstractNumber}</span>
              <span className="text-xs text-[#665e5d]">{d.abstract.categoryLabel}</span>
              {d.abstract.track && <span className="text-xs text-[#665e5d]">· {d.abstract.track}</span>}
              <StatusBadge status={`review_${d.summary.progress}`} label={d.summary.progressLabel} />
            </div>
            <h3 className="font-serif text-lg font-bold mt-1 leading-snug">{d.abstract.title}</h3>
            <p className="text-xs text-[#665e5d] mt-0.5">
              {d.abstract.presentingAuthor?.fullName ?? d.abstract.contactName} · {d.abstract.institution}
            </p>
            <button type="button" onClick={() => setShowAbstract(!showAbstract)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#580c1e] cursor-pointer">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAbstract ? 'rotate-180' : ''}`} /> {showAbstract ? 'Hide' : 'Show'} the full abstract
            </button>
            {showAbstract && (
              <div className="mt-3 rounded-2xl border border-black/[0.07] p-4">
                <AbstractView a={d.abstract} fileHref={(fileId) => apiUrl(`/admin/abstract-files/${fileId}`)} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Tile label="Assigned" value={d.summary.assigned} />
            <Tile label="Completed" value={d.summary.completed} tone="bg-emerald-50/60 border-emerald-200" />
            <Tile label="Pending" value={d.summary.pending} tone="bg-amber-50/60 border-amber-200" />
            <Tile label="COI" value={d.summary.coi} tone="bg-violet-50/60 border-violet-200" />
            <Tile label="Total score" value={d.summary.totalScore ?? '—'} />
            <Tile label="Average" value={d.summary.averageScore === null ? '—' : `${d.summary.averageScore}${d.summary.maxPerReview ? `/${d.summary.maxPerReview}` : ''}`} />
          </div>
          <p className="text-[11px] text-[#8a8280] -mt-3">Total and average include submitted, scored reviews only – COI and pending reviews are not counted.</p>

          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1918]">Reviewers</h4>
            {active.length === 0 ? <p className="text-xs text-[#665e5d]">No reviewer assigned.</p> : active.map((a) => <JudgeCard key={a.assignmentId} a={a} />)}
          </section>

          {removed.length > 0 && (
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1918] inline-flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Earlier assignments (not counted)
              </h4>
              {removed.map((a) => (
                <JudgeCard key={a.assignmentId} a={a} />
              ))}
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
