import React, { useState } from 'react';
import { Eye, UserPlus } from 'lucide-react';
import type { Paged, ReviewAbstractRow } from '../../../api/types';
import { DataTable, Pagination, type Column } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { AssignReviewersModal } from './AssignReviewersModal';
import { ReviewDetailsModal } from './ReviewDetailsModal';

const DOT: Record<string, string> = { pending: 'bg-amber-500', completed: 'bg-emerald-600', coi: 'bg-violet-600' };

/**
 * "By abstract" view of the existing admin Abstracts table (same filters): one row per abstract with
 * its judges, review progress, COI and average score, and the Assign / Reassign / View reviews actions.
 */
export function AbstractReviewTable({ data, onPage }: { data: Paged<ReviewAbstractRow>; onPage: (p: number) => void }) {
  const [assignFor, setAssignFor] = useState<number | null>(null);
  const [detailsFor, setDetailsFor] = useState<number | null>(null);

  const columns: Column<ReviewAbstractRow>[] = [
    { header: 'Sl. No.', cell: (r) => r.slNo, className: 'w-14 text-[#665e5d]' },
    {
      header: 'Abstract',
      cell: (r) => (
        <div className="min-w-[220px] max-w-[320px]">
          <span className="font-mono text-[11px] font-bold text-[#580c1e]">{r.abstractNumber}</span>
          <p className="text-sm font-semibold leading-snug mt-0.5">{r.title}</p>
          <p className="text-[11px] text-[#665e5d] mt-0.5">{r.presenter || r.submitter}</p>
        </div>
      ),
    },
    {
      header: 'Category / Track',
      cell: (r) => (
        <div className="text-xs min-w-[140px]">
          <p>{r.categoryLabel}</p>
          <p className="text-[#665e5d]">{r.track ?? '—'}</p>
        </div>
      ),
    },
    {
      header: 'Assigned Judge(s)',
      cell: (r) =>
        r.assignments.length === 0 ? (
          <span className="text-xs text-[#8a8280]">—</span>
        ) : (
          <ul className="space-y-1 min-w-[180px]">
            {r.assignments.map((a) => (
              <li key={a.reviewerId} className="flex items-center gap-1.5 text-xs whitespace-nowrap" title={a.statusLabel}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[a.status]}`} aria-hidden />
                <span>{a.reviewerName}</span>
                {a.score !== null && <span className="text-[#665e5d]">· {a.score}{a.maxScore ? `/${a.maxScore}` : ''}</span>}
                <span className="sr-only">({a.statusLabel})</span>
              </li>
            ))}
          </ul>
        ),
    },
    {
      header: 'Review Status',
      cell: (r) => (
        <div className="space-y-1">
          <StatusBadge status={`review_${r.summary.progress}`} label={r.summary.progressLabel} />
          {r.summary.assigned > 0 && (
            <p className="text-[11px] text-[#665e5d] whitespace-nowrap">
              {r.summary.completed} done · {r.summary.pending} pending
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'COI',
      className: 'text-center',
      cell: (r) => (r.summary.coi ? <StatusBadge status="review_coi" label={`${r.summary.coi} COI`} /> : <span className="text-xs text-[#8a8280]">—</span>),
    },
    {
      header: 'Avg. Score',
      className: 'text-center',
      cell: (r) =>
        r.summary.averageScore === null ? (
          <span className="text-xs text-[#8a8280]">—</span>
        ) : (
          <span className="font-semibold whitespace-nowrap">
            {r.summary.averageScore}
            {r.summary.maxPerReview ? <span className="text-[11px] text-[#665e5d] font-normal">/{r.summary.maxPerReview}</span> : null}
          </span>
        ),
    },
    {
      header: 'Review Actions',
      cell: (r) => (
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" onClick={() => setAssignFor(r.id)} className="inline-flex items-center gap-1 text-xs font-bold text-[#580c1e] hover:underline cursor-pointer whitespace-nowrap">
            <UserPlus className="w-3.5 h-3.5" /> {r.summary.assigned ? 'Assign / Reassign' : 'Assign Reviewer'}
          </button>
          <button type="button" onClick={() => setDetailsFor(r.id)} className="inline-flex items-center gap-1 text-xs font-bold text-[#4e4443] hover:underline cursor-pointer whitespace-nowrap">
            <Eye className="w-3.5 h-3.5" /> View Review Details
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} rows={data.rows} rowKey={(r) => r.id} empty="No abstracts match these filters." />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={onPage} />
      <AssignReviewersModal abstractId={assignFor} onClose={() => setAssignFor(null)} />
      <ReviewDetailsModal abstractId={detailsFor} onClose={() => setDetailsFor(null)} />
    </>
  );
}
