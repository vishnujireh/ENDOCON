import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Pencil, Plus, Power, Search, Users } from 'lucide-react';
import { api } from '../../../lib/api';
import { date, dateTime } from '../../../lib/format';
import type { JudgeReviewStatus, ReviewCriterion, Reviewer, ReviewerAssignmentRow } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { Field, SelectInput, TextArea, TextInput } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { Alert, ApiErrorAlert, ErrorState, LoadingState, fieldErrors } from '../../../components/ui/States';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { reviewKeys } from './AssignReviewersModal';

const criteriaKey = ['admin', 'review-criteria'] as const;

function Tabs({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const items = [
    ['reviewers', 'Reviewers', <Users key="u" className="w-3.5 h-3.5" />],
    ['criteria', 'Scoring criteria', <ListChecks key="l" className="w-3.5 h-3.5" />],
  ] as const;
  return (
    <div className="inline-flex rounded-full bg-white border border-black/[0.08] p-1 shadow-xs" role="tablist">
      {items.map(([v, label, icon]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={tab === v}
          onClick={() => onTab(v)}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${tab === v ? 'bg-[#580c1e] text-[#fef3c7]' : 'text-[#4e4443] hover:bg-black/[0.04]'}`}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
}

/** Admin → Reviewers: manage judges and the scoring criteria used by the review form. */
export function AdminReviewersPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'criteria' ? 'criteria' : 'reviewers';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1a1918]">Abstract Reviewers</h1>
          <p className="text-xs text-[#665e5d] mt-0.5">Judges log in with a one-time code sent to their registered email and see only the abstracts assigned to them.</p>
        </div>
        <Tabs tab={tab} onTab={(t) => setParams(t === 'criteria' ? { tab: 'criteria' } : {})} />
      </div>
      {tab === 'criteria' ? <CriteriaSection /> : <ReviewersSection />}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */

function ReviewersSection() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const list = useQuery({ queryKey: [...reviewKeys.reviewers, q, status], queryFn: () => api.get<Reviewer[]>(`/admin/reviewers?${new URLSearchParams({ ...(q && { q }), ...(status && { status }) })}`) });
  const [editing, setEditing] = useState<Reviewer | 'new' | null>(null);
  const [viewing, setViewing] = useState<{ reviewer: Reviewer; status: '' | JudgeReviewStatus } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const toggle = async (r: Reviewer) => {
    const next = r.status === 'active' ? 'inactive' : 'active';
    if (next === 'inactive' && !window.confirm(`Deactivate ${r.name}? They will be logged out and cannot log in until reactivated. Their assignments and reviews are kept.`)) return;
    setError(null);
    try {
      await api.patch(`/admin/reviewers/${r.id}`, { status: next });
      await qc.invalidateQueries({ queryKey: reviewKeys.reviewers });
    } catch (e) {
      setError(e);
    }
  };

  const countLink = (r: Reviewer, s: '' | JudgeReviewStatus, n: number | undefined, cls = '') => (
    <button type="button" onClick={() => setViewing({ reviewer: r, status: s })} className={`font-semibold hover:underline cursor-pointer ${cls}`} title="View these abstracts">
      {n ?? 0}
    </button>
  );

  const columns: Column<Reviewer>[] = [
    { header: 'Reviewer ID', cell: (r) => <span className="font-mono text-xs font-bold text-[#580c1e]">{r.reviewerCode}</span> },
    { header: 'Name', cell: (r) => <span className="font-semibold">{r.name}</span> },
    { header: 'Registered Email', cell: (r) => <span className="text-xs break-all">{r.email}</span> },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Assigned', className: 'text-center', cell: (r) => countLink(r, '', r.counts?.assigned) },
    { header: 'Pending', className: 'text-center', cell: (r) => countLink(r, 'pending', r.counts?.pending, 'text-amber-700') },
    { header: 'Completed', className: 'text-center', cell: (r) => countLink(r, 'completed', r.counts?.completed, 'text-emerald-700') },
    { header: 'COI', className: 'text-center', cell: (r) => countLink(r, 'coi', r.counts?.coi, 'text-violet-700') },
    { header: 'Created', cell: (r) => <span className="text-xs whitespace-nowrap">{date(r.createdAt)}</span> },
    { header: 'Updated', cell: (r) => <span className="text-xs whitespace-nowrap">{date(r.updatedAt)}</span> },
    {
      header: 'Action',
      cell: (r) => (
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" onClick={() => setEditing(r)} className="inline-flex items-center gap-1 text-xs font-bold text-[#580c1e] hover:underline cursor-pointer">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => void toggle(r)}
            className={`inline-flex items-center gap-1 text-xs font-bold hover:underline cursor-pointer ${r.status === 'active' ? 'text-red-700' : 'text-emerald-700'}`}
          >
            <Power className="w-3.5 h-3.5" /> {r.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-3xl border border-black/[0.06] shadow-[0_6px_24px_rgba(88,12,30,0.04)] px-5 sm:px-6 py-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="rv-q" className="block text-[10px] font-bold uppercase tracking-wider text-[#665e5d] mb-1.5">
            Search
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-[#665e5d] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <TextInput id="rv-q" className="pl-9" placeholder="Name, email or reviewer ID" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="w-44">
          <label htmlFor="rv-status" className="block text-[10px] font-bold uppercase tracking-wider text-[#665e5d] mb-1.5">
            Status
          </label>
          <SelectInput id="rv-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectInput>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>
          Add reviewer
        </Button>
      </div>
      <ApiErrorAlert error={error} />
      {list.isLoading ? (
        <LoadingState />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable columns={columns} rows={list.data} rowKey={(r) => r.id} empty="No reviewers yet – add the judges who will review abstracts." />
      )}
      <ReviewerForm reviewer={editing} onClose={() => setEditing(null)} />
      <ReviewerAssignmentsModal viewing={viewing} onClose={() => setViewing(null)} onFilter={(s) => viewing && setViewing({ ...viewing, status: s })} />
    </section>
  );
}

function ReviewerForm({ reviewer, onClose }: { reviewer: Reviewer | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = reviewer === 'new';
  const [form, setForm] = useState({ name: '', email: '', status: 'active' });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<Reviewer | 'new' | null>(null);
  if (reviewer !== loadedFor) {
    setLoadedFor(reviewer);
    setError(null);
    setForm(reviewer && reviewer !== 'new' ? { name: reviewer.name, email: reviewer.email, status: reviewer.status } : { name: '', email: '', status: 'active' });
  }
  const errs = fieldErrors(error);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isNew) await api.post('/admin/reviewers', form);
      else await api.patch(`/admin/reviewers/${(reviewer as Reviewer).id}`, form);
      await qc.invalidateQueries({ queryKey: reviewKeys.reviewers });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!reviewer} onClose={onClose} title={isNew ? 'Add reviewer' : 'Edit reviewer'} closeOnBackdrop={false}>
      <form onSubmit={save} noValidate className="space-y-4">
        {error != null && Object.keys(errs).length === 0 && <ApiErrorAlert error={error} />}
        {!isNew && reviewer && (
          <p className="text-xs text-[#665e5d]">
            Reviewer ID <span className="font-mono font-bold text-[#580c1e]">{(reviewer as Reviewer).reviewerCode}</span>
          </p>
        )}
        <Field label="Name" name="name" required error={errs.name}>
          <TextInput name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!errs.name} placeholder="Dr. Full Name" />
        </Field>
        <Field label="Registered email" name="email" required error={errs.email} hint="The login code is sent to this address. Each reviewer needs a different email.">
          <TextInput name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} invalid={!!errs.email} placeholder="name@hospital.org" />
        </Field>
        <Field label="Status" name="status">
          <SelectInput name="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active – can log in</option>
            <option value="inactive">Inactive – cannot log in</option>
          </SelectInput>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isNew ? 'Add reviewer' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewerAssignmentsModal({
  viewing,
  onClose,
  onFilter,
}: {
  viewing: { reviewer: Reviewer; status: '' | JudgeReviewStatus } | null;
  onClose: () => void;
  onFilter: (s: '' | JudgeReviewStatus) => void;
}) {
  const q = useQuery({
    queryKey: [...reviewKeys.reviewers, 'assignments', viewing?.reviewer.id, viewing?.status],
    queryFn: () => api.get<{ assignments: ReviewerAssignmentRow[] }>(`/admin/reviewers/${viewing!.reviewer.id}/assignments${viewing!.status ? `?status=${viewing!.status}` : ''}`),
    enabled: !!viewing,
  });
  const filters: ['' | JudgeReviewStatus, string][] = [
    ['', 'All assigned'],
    ['pending', 'Pending'],
    ['completed', 'Completed'],
    ['coi', 'COI'],
  ];
  return (
    <Modal open={!!viewing} onClose={onClose} title={viewing ? `${viewing.reviewer.name} – abstracts` : ''} width="max-w-3xl">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {filters.map(([v, l]) => (
          <button
            key={v || 'all'}
            type="button"
            onClick={() => onFilter(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${viewing?.status === v ? 'bg-[#580c1e] text-[#fef3c7] border-[#580c1e]' : 'bg-white border-black/[0.1] text-[#4e4443]'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <LoadingState />
      ) : !q.data || q.data.assignments.length === 0 ? (
        <p className="text-sm text-[#665e5d] py-6 text-center">No abstracts here.</p>
      ) : (
        <ul className="divide-y divide-black/[0.06] rounded-2xl border border-black/[0.08]">
          {q.data.assignments.map((a) => (
            <li key={a.assignmentId} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[11px] font-bold text-[#580c1e]">{a.abstractNumber}</span>
                <p className="text-sm font-semibold leading-snug">{a.title}</p>
                <p className="text-[11px] text-[#665e5d]">
                  {a.categoryLabel}
                  {a.track && ` · ${a.track}`} · assigned {dateTime(a.assignedAt)}
                </p>
              </div>
              {a.score !== null && (
                <span className="font-semibold text-sm">
                  {a.score}
                  {a.maxScore ? <span className="text-[11px] text-[#665e5d]">/{a.maxScore}</span> : null}
                </span>
              )}
              <StatusBadge status={`review_${a.status}`} label={a.draftSaved && a.status === 'pending' ? 'Pending · draft' : a.statusLabel} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------------------------------------ */

function CriteriaSection() {
  const list = useQuery({ queryKey: criteriaKey, queryFn: () => api.get<ReviewCriterion[]>('/admin/review-criteria') });
  const [editing, setEditing] = useState<ReviewCriterion | 'new' | null>(null);
  const active = (list.data ?? []).filter((c) => c.status === 'active');
  const total = active.reduce((s, c) => s + c.maxScore, 0);

  const columns: Column<ReviewCriterion>[] = [
    { header: 'Order', className: 'w-16 text-[#665e5d]', cell: (c) => c.displayOrder },
    {
      header: 'Criterion',
      cell: (c) => (
        <div className="max-w-md">
          <p className="font-semibold">{c.name}</p>
          {c.description && <p className="text-xs text-[#665e5d] mt-0.5 whitespace-pre-wrap">{c.description}</p>}
        </div>
      ),
    },
    { header: 'Max score', className: 'text-center', cell: (c) => <span className="font-semibold">{c.maxScore}</span> },
    { header: 'Status', cell: (c) => <StatusBadge status={c.status} /> },
    {
      header: 'Action',
      cell: (c) => (
        <button type="button" onClick={() => setEditing(c)} className="inline-flex items-center gap-1 text-xs font-bold text-[#580c1e] hover:underline cursor-pointer">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-3xl border border-black/[0.06] shadow-[0_6px_24px_rgba(88,12,30,0.04)] px-5 sm:px-6 py-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] text-sm text-[#4e4443]">
          Reviewers score every <strong>active</strong> criterion. {active.length > 0 ? (
            <>
              {active.length} active · maximum total <strong className="text-[#580c1e]">{total}</strong> per review.
            </>
          ) : null}
          <p className="text-[11px] text-[#8a8280] mt-1">Changing a criterion later does not alter reviews already submitted – each score keeps the name and maximum it was given with.</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>
          Add criterion
        </Button>
      </div>
      {!list.isLoading && active.length === 0 && (
        <Alert tone="warning">No scoring criteria are set up yet. Reviewers can open their abstracts and save drafts, but cannot submit a scored review until at least one criterion is active.</Alert>
      )}
      {list.isLoading ? (
        <LoadingState />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable columns={columns} rows={list.data} rowKey={(c) => c.id} empty="No criteria yet." />
      )}
      <CriterionForm criterion={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function CriterionForm({ criterion, onClose }: { criterion: ReviewCriterion | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = criterion === 'new';
  const blank = { name: '', description: '', maxScore: '10', displayOrder: '0', status: 'active' };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<ReviewCriterion | 'new' | null>(null);
  if (criterion !== loadedFor) {
    setLoadedFor(criterion);
    setError(null);
    setForm(
      criterion && criterion !== 'new'
        ? { name: criterion.name, description: criterion.description ?? '', maxScore: String(criterion.maxScore), displayOrder: String(criterion.displayOrder), status: criterion.status }
        : blank,
    );
  }
  const errs = fieldErrors(error);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, maxScore: Number(form.maxScore), displayOrder: Number(form.displayOrder) };
      if (isNew) await api.post('/admin/review-criteria', body);
      else await api.patch(`/admin/review-criteria/${(criterion as ReviewCriterion).id}`, body);
      await qc.invalidateQueries({ queryKey: criteriaKey });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={!!criterion} onClose={onClose} title={isNew ? 'Add scoring criterion' : 'Edit scoring criterion'} closeOnBackdrop={false}>
      <form onSubmit={save} noValidate className="space-y-4">
        {error != null && Object.keys(errs).length === 0 && <ApiErrorAlert error={error} />}
        <Field label="Criterion" name="name" required error={errs.name}>
          <TextInput name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!errs.name} placeholder="e.g. Originality" />
        </Field>
        <Field label="Guidance for reviewers" name="description" optional error={errs.description}>
          <TextArea name="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Max score" name="maxScore" required error={errs.maxScore}>
            <TextInput name="maxScore" inputMode="numeric" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} invalid={!!errs.maxScore} />
          </Field>
          <Field label="Order" name="displayOrder" error={errs.displayOrder}>
            <TextInput name="displayOrder" inputMode="numeric" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} />
          </Field>
          <Field label="Status" name="status">
            <SelectInput name="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SelectInput>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isNew ? 'Add criterion' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
