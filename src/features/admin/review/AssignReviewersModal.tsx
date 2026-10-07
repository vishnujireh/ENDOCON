import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Check, Search, UserMinus, UserPlus } from 'lucide-react';
import { api } from '../../../lib/api';
import type { AdminAbstractReviews, Reviewer } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { SelectInput, TextInput } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { Alert, ApiErrorAlert, LoadingState } from '../../../components/ui/States';
import { StatusBadge } from '../../../components/ui/StatusBadge';

export const reviewKeys = {
  list: ['admin', 'review-abstracts'] as const,
  details: (id: number) => ['admin', 'abstract-reviews', id] as const,
  reviewers: ['admin', 'reviewers'] as const,
};

/** Refresh everything that shows assignments after a change. */
export function useRefreshReviews() {
  const qc = useQueryClient();
  return async (abstractId: number) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: reviewKeys.details(abstractId) }),
      qc.invalidateQueries({ queryKey: reviewKeys.list }),
      qc.invalidateQueries({ queryKey: reviewKeys.reviewers }),
    ]);
  };
}

export function useAbstractReviews(abstractId: number | null) {
  return useQuery({
    queryKey: reviewKeys.details(abstractId ?? 0),
    queryFn: () => api.get<AdminAbstractReviews>(`/admin/abstracts/${abstractId}/reviews`),
    enabled: !!abstractId,
  });
}

/** Assign one or more reviewers, reassign (Judge A → Judge B) or remove – from the abstract table. */
export function AssignReviewersModal({ abstractId, onClose }: { abstractId: number | null; onClose: () => void }) {
  const details = useAbstractReviews(abstractId);
  const reviewersQ = useQuery({ queryKey: [...reviewKeys.reviewers, 'active'], queryFn: () => api.get<Reviewer[]>('/admin/reviewers?status=active'), enabled: !!abstractId });
  const refresh = useRefreshReviews();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [replacing, setReplacing] = useState<{ from: number; to: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const d = details.data;
  const active = d?.assignments.filter((a) => a.active) ?? [];
  const assignedIds = new Set(active.map((a) => a.reviewerId));
  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (reviewersQ.data ?? []).filter(
      (r) => !assignedIds.has(r.id) && (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.reviewerCode.toLowerCase().includes(q)),
    );
  }, [reviewersQ.data, search, d]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await fn();
      await refresh(abstractId!);
      setDone(message);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setSelected([]);
    setSearch('');
    setReplacing(null);
    setError(null);
    setDone(null);
    onClose();
  };

  return (
    <Modal open={!!abstractId} onClose={close} title="Assign reviewers" width="max-w-2xl">
      {details.isLoading || !d ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-[#faf8f5] border border-black/[0.06] p-4 text-sm">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">Abstract ID</dt>
              <dd className="font-mono font-bold text-[#580c1e]">{d.abstract.abstractNumber}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">Presentation category</dt>
              <dd>{d.abstract.categoryLabel}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">Title</dt>
              <dd className="font-semibold">{d.abstract.title}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">Track / Theme</dt>
              <dd>{d.abstract.track ?? '—'}</dd>
            </div>
          </dl>

          <ApiErrorAlert error={error} />
          {done && <Alert tone="success">{done}</Alert>}

          {/* Current reviewers */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1918] mb-2">Assigned reviewers ({active.length})</h4>
            {active.length === 0 ? (
              <p className="text-xs text-[#665e5d]">No reviewer assigned yet.</p>
            ) : (
              <ul className="divide-y divide-black/[0.06] rounded-2xl border border-black/[0.08]">
                {active.map((a) => (
                  <li key={a.assignmentId} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1a1918]">
                          {a.reviewerName} <span className="font-mono text-[11px] text-[#8a8280]">{a.reviewerCode}</span>
                        </p>
                        <p className="text-[11px] text-[#665e5d]">{a.reviewerEmail}</p>
                      </div>
                      <StatusBadge status={`review_${a.status}`} label={a.review?.state === 'draft' && a.status === 'pending' ? 'Pending · draft' : a.statusLabel} />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setReplacing(replacing?.from === a.reviewerId ? null : { from: a.reviewerId, to: '' })}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#580c1e] hover:underline cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" /> Reassign
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const kept = a.review ? ' Their review is kept in the history.' : '';
                          if (window.confirm(`Remove ${a.reviewerName} from this abstract?${kept}`)) {
                            void run(() => api.del(`/admin/abstracts/${abstractId}/reviewers/${a.reviewerId}`), `${a.reviewerName} was removed from this abstract.`);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:underline cursor-pointer"
                      >
                        <UserMinus className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                    {replacing?.from === a.reviewerId && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#fcf7f2] border border-[#580c1e]/10 p-3">
                        <span className="text-xs text-[#4e4443]">
                          {a.reviewerName} <span aria-hidden>→</span>
                        </span>
                        <SelectInput className="flex-1 min-w-[200px]" value={replacing.to} onChange={(e) => setReplacing({ ...replacing, to: e.target.value })} aria-label="New reviewer">
                          <option value="">Choose the new reviewer…</option>
                          {(reviewersQ.data ?? [])
                            .filter((r) => !assignedIds.has(r.id))
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.reviewerCode})
                              </option>
                            ))}
                        </SelectInput>
                        <Button
                          size="sm"
                          loading={busy}
                          disabled={!replacing.to}
                          onClick={() =>
                            run(async () => {
                              await api.patch(`/admin/abstracts/${abstractId}/reviewers/${a.reviewerId}`, { newReviewerId: Number(replacing.to) });
                              setReplacing(null);
                            }, 'Abstract reassigned.')
                          }
                        >
                          Reassign
                        </Button>
                        {a.review && <p className="basis-full text-[11px] text-[#665e5d]">{a.reviewerName}’s review ({a.review.state}) stays in the review history.</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Add reviewers */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1918] mb-2">Add reviewers</h4>
            {(reviewersQ.data ?? []).length === 0 && !reviewersQ.isLoading ? (
              <p className="text-xs text-[#665e5d]">
                There are no active reviewers yet.{' '}
                <Link to="/admin/reviewers" className="font-semibold text-[#580c1e] underline">
                  Add reviewers
                </Link>
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#665e5d] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <TextInput className="pl-9" placeholder="Search by name, email or code" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search reviewers" />
                </div>
                <ul className="mt-2 max-h-56 overflow-y-auto divide-y divide-black/[0.05] rounded-2xl border border-black/[0.08]">
                  {available.length === 0 ? (
                    <li className="px-4 py-3 text-xs text-[#665e5d]">No other active reviewers match.</li>
                  ) : (
                    available.map((r) => {
                      const on = selected.includes(r.id);
                      return (
                        <li key={r.id}>
                          <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#faf8f5]">
                            <input type="checkbox" className="accent-[#580c1e]" checked={on} onChange={() => setSelected(on ? selected.filter((x) => x !== r.id) : [...selected, r.id])} />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm text-[#1a1918]">
                                {r.name} <span className="font-mono text-[11px] text-[#8a8280]">{r.reviewerCode}</span>
                              </span>
                              <span className="block text-[11px] text-[#665e5d] truncate">{r.email}</span>
                            </span>
                            {r.counts && <span className="text-[11px] text-[#8a8280] whitespace-nowrap">{r.counts.pending} pending</span>}
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>
                <div className="mt-3 flex justify-end">
                  <Button
                    loading={busy}
                    disabled={!selected.length}
                    icon={selected.length ? <UserPlus className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    onClick={() =>
                      run(async () => {
                        await api.post(`/admin/abstracts/${abstractId}/reviewers`, { reviewerIds: selected });
                        setSelected([]);
                      }, `${selected.length} reviewer${selected.length === 1 ? '' : 's'} assigned.`)
                    }
                  >
                    Assign {selected.length ? `${selected.length} selected` : ''}
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
