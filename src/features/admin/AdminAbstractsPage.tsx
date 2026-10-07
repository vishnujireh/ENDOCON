import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ChevronDown, Copy, Eye, FileSpreadsheet, History, XCircle } from 'lucide-react';
import { api, apiUrl, queryString } from '../../lib/api';
import type { AbstractDecision, AbstractRecord, AdminAbstractDetail, AdminAuthorAbstracts, AdminAuthorRow, Paged, ReviewAbstractRow } from '../../api/types';
import { dateTime } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { DataTable, Pagination, type Column } from '../../components/ui/DataTable';
import { SelectInput, TextArea, TextInput } from '../../components/ui/Field';
import { Card } from '../../components/ui/Layout';
import { Alert, ApiErrorAlert, ErrorState, LoadingState, fieldErrors } from '../../components/ui/States';
import { AbstractTimeline } from '../abstracts/AbstractTimeline';
import { AbstractView } from '../abstracts/AbstractView';
import { ABSTRACT_TRACKS } from '../abstracts/AbstractForm';
import { FilterField, FilterPanel, WithSearchIcon } from './FilterPanel';
import { AbstractReviewTable } from './review/AbstractReviewTable';
import { reviewKeys } from './review/AssignReviewersModal';

const CATEGORY_OPTIONS = [
  ['plenary', 'Plenary Session'],
  ['yia', 'Young Investigator Award'],
  ['oral', 'Oral Paper'],
  ['eposter', 'E-Poster'],
  ['video', 'Video Digest'],
];

const REVIEW_OPTIONS = [
  ['not_assigned', 'Not assigned'],
  ['in_review', 'In review (pending judges)'],
  ['completed', 'Review complete'],
  ['has_coi', 'Has COI'],
];

const xlsxLink =
  'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-[#580c1e] bg-white border border-[#580c1e]/25 hover:bg-[#580c1e]/5 transition-colors';

const STATUS_OPTIONS = [
  ['needs_review', 'Needs review (submitted + resubmitted)'],
  ['submitted', 'Submitted'],
  ['resubmitted', 'Resubmitted'],
  ['accepted', 'Accepted'],
  ['rejected', 'Rejected'],
  ['duplicate', 'Duplicate'],
];

export function AdminAbstractsPage() {
  const [params, setParams] = useSearchParams();
  const f = {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    category: params.get('category') ?? '',
    track: params.get('track') ?? '',
    institution: params.get('institution') ?? '',
    author: params.get('author') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    review: params.get('review') ?? '',
    page: Number(params.get('page') ?? 1),
  };
  // Same table, two groupings: one row per submitter (default) or one row per abstract (review).
  const view = params.get('view') === 'abstracts' ? 'abstracts' : 'submitters';
  const [search, setSearch] = useState({ q: f.q, institution: f.institution, author: f.author });
  const update = (patch: Record<string, string | number>) => {
    const next = { ...f, view: view === 'abstracts' ? 'abstracts' : '', page: 1, ...patch };
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '').map(([k, v]) => [k, String(v)])));
  };
  const qs = queryString({ ...f, pageSize: 25 });
  const list = useQuery({
    queryKey: ['admin', 'abstract-authors', qs],
    queryFn: () => api.get<Paged<AdminAuthorRow>>(`/admin/abstract-authors${qs}`),
    placeholderData: keepPreviousData,
    enabled: view === 'submitters',
  });
  const reviewList = useQuery({
    queryKey: [...reviewKeys.list, qs],
    queryFn: () => api.get<Paged<ReviewAbstractRow>>(`/admin/abstracts${qs}`),
    placeholderData: keepPreviousData,
    enabled: view === 'abstracts',
  });
  const exportQs = queryString({ ...f, page: undefined });

  const columns: Column<AdminAuthorRow>[] = [
    { header: 'Sl. No.', cell: (r) => r.slNo, className: 'w-14 text-[#665e5d]' },
    {
      header: 'Author',
      cell: (r) => (
        <div>
          <span className="font-semibold">{r.author || '—'}</span>
          {r.phone && <div className="text-[11px] text-[#665e5d]">{r.phone}</div>}
        </div>
      ),
    },
    { header: 'Email', cell: (r) => <span className="text-xs break-all">{r.email}</span> },
    { header: 'Institution', cell: (r) => <span className="text-xs">{r.institution ?? '—'}</span> },
    {
      header: 'No. of Abstracts',
      className: 'text-center',
      cell: (r) => (
        <div className="flex flex-col items-center gap-1">
          <span className="font-bold">{r.abstractCount}</span>
          {r.needsReview > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap">
              {r.needsReview} to review
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Conference',
      cell: (r) => (
        <span className={`text-xs whitespace-nowrap ${r.registration.startsWith('Paid') ? 'text-emerald-700 font-semibold' : 'text-[#665e5d]'}`}>{r.registration}</span>
      ),
    },
    {
      header: 'Action',
      cell: (r) => (
        <Link to={`/admin/abstracts/users/${r.userId}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#580c1e] hover:underline">
          <Eye className="w-3.5 h-3.5" /> {r.needsReview > 0 ? 'Review' : 'View'}
        </Link>
      ),
    },
  ];

  const activeFilters = Object.entries(f).filter(([k, v]) => k !== 'page' && v !== '').length;
  const current = view === 'abstracts' ? reviewList : list;
  const summary = current.data
    ? view === 'abstracts'
      ? `${current.data.total} abstract${current.data.total === 1 ? '' : 's'}`
      : `${current.data.total} submitter${current.data.total === 1 ? '' : 's'}`
    : '…';

  return (
    <div>
      <FilterPanel
        title="Abstract Submissions"
        summary={summary}
        activeCount={activeFilters}
        exportHref={apiUrl(`/admin/abstracts/export.csv${exportQs}`)}
        headerActions={
          <>
            <a href={apiUrl(`/admin/review-export.xlsx${exportQs}`)} className={xlsxLink} title="Every judge's review and score, one row per judge">
              <FileSpreadsheet className="w-4 h-4" /> Review export
            </a>
            <a href={apiUrl(`/admin/review-report.xlsx${exportQs}`)} className={xlsxLink} title="One row per abstract: judges, individual scores, total / average, COI">
              <FileSpreadsheet className="w-4 h-4" /> Final review report
            </a>
          </>
        }
        onApply={() => update(search)}
        onClear={() => {
          setSearch({ q: '', institution: '', author: '' });
          setParams(view === 'abstracts' ? { view: 'abstracts' } : {});
        }}
      >
        <FilterField label="Search" htmlFor="abs-q" wide>
          <WithSearchIcon>
            <TextInput id="abs-q" className="pl-9" placeholder="Title, abstract no., name, email" value={search.q} onChange={(e) => setSearch({ ...search, q: e.target.value })} />
          </WithSearchIcon>
        </FilterField>
        <FilterField label="Author" htmlFor="abs-author">
          <TextInput id="abs-author" placeholder="Any author name" value={search.author} onChange={(e) => setSearch({ ...search, author: e.target.value })} />
        </FilterField>
        <FilterField label="Institution" htmlFor="abs-inst">
          <TextInput id="abs-inst" placeholder="Institution" value={search.institution} onChange={(e) => setSearch({ ...search, institution: e.target.value })} />
        </FilterField>
        <FilterField label="Status" htmlFor="abs-status">
          <SelectInput id="abs-status" value={f.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectInput>
        </FilterField>
        <FilterField label="Category" htmlFor="abs-cat">
          <SelectInput id="abs-cat" value={f.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectInput>
        </FilterField>
        <FilterField label="Track / Theme" htmlFor="abs-track">
          <SelectInput id="abs-track" value={f.track} onChange={(e) => update({ track: e.target.value })}>
            <option value="">All tracks</option>
            {ABSTRACT_TRACKS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectInput>
        </FilterField>
        <FilterField label="Submitted from" htmlFor="abs-from">
          <TextInput id="abs-from" type="date" value={f.from} max={f.to || undefined} onChange={(e) => update({ from: e.target.value })} />
        </FilterField>
        <FilterField label="Submitted to" htmlFor="abs-to">
          <TextInput id="abs-to" type="date" value={f.to} min={f.from || undefined} onChange={(e) => update({ to: e.target.value })} />
        </FilterField>
        {view === 'abstracts' && (
          <FilterField label="Judge review" htmlFor="abs-review">
            <SelectInput id="abs-review" value={f.review} onChange={(e) => update({ review: e.target.value })}>
              <option value="">Any review progress</option>
              {REVIEW_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </SelectInput>
          </FilterField>
        )}
      </FilterPanel>

      <div className="mb-3 inline-flex rounded-full bg-white border border-black/[0.08] p-1 shadow-xs" role="tablist" aria-label="Group the table">
        {(
          [
            ['submitters', 'By submitter'],
            ['abstracts', 'By abstract · review'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => update(v === 'abstracts' ? { view: 'abstracts' } : { view: '', review: '' })}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${view === v ? 'bg-[#580c1e] text-[#fef3c7]' : 'text-[#4e4443] hover:bg-black/[0.04]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'abstracts' ? (
        reviewList.isLoading ? (
          <LoadingState />
        ) : reviewList.error || !reviewList.data ? (
          <ErrorState error={reviewList.error} onRetry={() => reviewList.refetch()} />
        ) : (
          <AbstractReviewTable data={reviewList.data} onPage={(p) => update({ page: p })} />
        )
      ) : list.isLoading ? (
        <LoadingState />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <DataTable columns={columns} rows={list.data.rows} rowKey={(r) => r.userId} empty="No submitted abstracts match these filters." />
          <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => update({ page: p })} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Review: Accept / Reject / Duplicate (comment required for Reject and Duplicate – sent to the author)
 * ---------------------------------------------------------------------------------------------- */

const DECISIONS: { id: AbstractDecision; label: string; icon: React.ReactNode; on: string }[] = [
  { id: 'accepted', label: 'Accept', icon: <CheckCircle2 className="w-4 h-4" />, on: 'bg-emerald-600 text-white border-emerald-600' },
  { id: 'rejected', label: 'Reject', icon: <XCircle className="w-4 h-4" />, on: 'bg-red-600 text-white border-red-600' },
  { id: 'duplicate', label: 'Duplicate', icon: <Copy className="w-4 h-4" />, on: 'bg-orange-500 text-white border-orange-500' },
];

function ReviewPanel({ a }: { a: AdminAbstractDetail }) {
  const qc = useQueryClient();
  const awaiting = a.status === 'submitted' || a.status === 'resubmitted';
  const [open, setOpen] = useState(awaiting);
  const [decision, setDecision] = useState<AbstractDecision | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const needsComment = decision === 'rejected' || decision === 'duplicate';

  const save = async () => {
    setError(null);
    setLocalErr(null);
    if (!decision) return setLocalErr('Choose Accept, Reject or Duplicate.');
    if (needsComment && comment.trim().length < 5) return setLocalErr('Please enter a comment for the author (it is sent to them).');
    setSaving(true);
    try {
      await api.post(`/admin/abstracts/${a.id}/review`, { decision, comment: comment.trim() || null });
      setSaved(`Decision saved – the author has been emailed${needsComment ? ' with your comment' : ''}.`);
      setDecision(null);
      setComment('');
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ['admin', 'author-abstracts'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'abstract-authors'] });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const serverComment = fieldErrors(error).comment;

  return (
    <div className="mt-6 rounded-2xl border border-[#580c1e]/15 bg-[#fcf7f2] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">Scientific Committee decision</p>
          <p className="text-sm text-[#1a1918] mt-0.5">
            {awaiting
              ? a.status === 'resubmitted'
                ? `Revision ${a.revision} is waiting for your review.`
                : 'Waiting for your review.'
              : a.status === 'accepted'
                ? 'Accepted – final for the author.'
                : `${a.status === 'rejected' ? 'Rejected' : 'Marked as duplicate'} – waiting for the author to revise and resubmit.`}
            {a.reviewedAt && !awaiting && <span className="text-[11px] text-[#8a8280]"> ({dateTime(a.reviewedAt)})</span>}
          </p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="text-xs font-bold text-[#580c1e] underline cursor-pointer">
            Change decision
          </button>
        )}
      </div>
      {saved && (
        <Alert tone="success" className="mt-3">
          {saved}
        </Alert>
      )}

      {open && (
        <div className="mt-4 space-y-3">
          {!awaiting && (
            <Alert tone="warning">
              Changing a decision that has already been sent emails the author again and is recorded in the audit log.
            </Alert>
          )}
          <ApiErrorAlert error={error} />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Decision">
            {DECISIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={decision === d.id}
                onClick={() => {
                  setDecision(d.id);
                  setLocalErr(null);
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  decision === d.id ? d.on : 'bg-white text-[#1a1918] border-black/[0.12] hover:border-[#580c1e]/40'
                }`}
              >
                {d.icon} {d.label}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor={`comment-${a.id}`} className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">
              Comment for the author {needsComment ? <span className="text-red-700">*</span> : <span className="normal-case font-normal">(optional)</span>}
            </label>
            <TextArea
              id={`comment-${a.id}`}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              invalid={!!(localErr && needsComment) || !!serverComment}
              placeholder={
                decision === 'duplicate'
                  ? 'e.g. This duplicates abstract ENDO-ABS-0007. Please withdraw one or revise it into a distinct study.'
                  : 'What should the author change before resubmitting?'
              }
            />
            <p className="text-[11px] text-[#665e5d] mt-1">Emailed to the author and shown under My Abstracts. They can revise and resubmit after Reject or Duplicate.</p>
            {(localErr || serverComment) && (
              <p className="text-[11px] text-red-700 mt-1" role="alert">
                {localErr ?? serverComment}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={save} loading={saving}>
              Save decision &amp; notify author
            </Button>
            {!awaiting && (
              <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-[#665e5d] underline cursor-pointer">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Earlier revisions exactly as the reviewers saw them, with their files. */
function PreviousVersions({ a }: { a: AdminAbstractDetail }) {
  if (!a.previousVersions.length) return null;
  return (
    <details className="group mt-4 rounded-2xl border border-black/[0.07] bg-white">
      <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none text-xs font-bold text-[#580c1e]">
        <span className="inline-flex items-center gap-1.5">
          <History className="w-4 h-4" /> Earlier revisions ({a.previousVersions.length})
        </span>
        <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 space-y-5">
        {[...a.previousVersions].reverse().map((v) => {
          const snap = v.snapshot as unknown as AbstractRecord;
          return (
            <div key={v.revision} className="pt-4 border-t border-black/[0.06]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#665e5d] mb-3">
                Revision {v.revision} · submitted {dateTime(v.submittedAt)}
              </p>
              <AbstractView
                a={{ ...snap, status: snap.status, files: v.files.map((f) => ({ ...f, mimeType: '', uploadedAt: '' })) }}
                fileHref={(fileId) => apiUrl(`/admin/abstract-files/${fileId}`)}
              />
            </div>
          );
        })}
      </div>
    </details>
  );
}

export function AdminAuthorAbstractsPage() {
  const { userId = '' } = useParams();
  const q = useQuery({
    queryKey: ['admin', 'author-abstracts', userId],
    queryFn: () => api.get<AdminAuthorAbstracts>(`/admin/abstract-authors/${encodeURIComponent(userId)}`),
  });
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { author, abstracts } = q.data;
  return (
    <div className="space-y-5">
      <Link to="/admin/abstracts" className="text-xs font-bold text-[#580c1e] inline-flex items-center gap-1 hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" /> All submitters
      </Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold">{author.name}</h2>
            <p className="text-xs text-[#665e5d] mt-1">
              <a href={`mailto:${author.email}`} className="text-[#580c1e] underline">
                {author.email}
              </a>
              {author.phone && ` · ${author.phone}`} {author.organization && `· ${author.organization}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">Conference registration</p>
            <p className={`text-sm font-semibold ${author.registration.startsWith('Paid') ? 'text-emerald-700' : 'text-[#665e5d]'}`}>{author.registration}</p>
          </div>
        </div>
      </Card>
      {abstracts.map((a) => (
        <Card key={a.id}>
          <AbstractView a={a} fileHref={(fileId) => apiUrl(`/admin/abstract-files/${fileId}`)} />
          <ReviewPanel a={a} />
          {a.history.length > 0 && (
            <div className="mt-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] mb-4">History</p>
              <AbstractTimeline events={a.history} />
            </div>
          )}
          <PreviousVersions a={a} />
        </Card>
      ))}
    </div>
  );
}
