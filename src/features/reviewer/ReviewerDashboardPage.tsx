import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ClipboardList, Clock, ShieldAlert } from 'lucide-react';
import { reviewerApi } from '../../lib/api';
import type { AbstractCategory, JudgeReviewStatus } from '../../api/types';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PortalPage } from '../registration/RegistrationShell';
import { useReviewerAuth } from './ReviewerAuth';

export interface ReviewerDashboard {
  counts: { assigned: number; pending: number; completed: number; coi: number };
  abstracts: {
    abstractId: number;
    abstractNumber: string;
    title: string;
    category: AbstractCategory;
    categoryLabel: string;
    track: string | null;
    status: JudgeReviewStatus;
    statusLabel: string;
    draftSaved: boolean;
    assignedAt: string;
    submittedAt: string | null;
  }[];
}

export const reviewerKeys = { dashboard: ['reviewer', 'dashboard'] as const, abstract: (id: number) => ['reviewer', 'abstract', id] as const };

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_10px_30px_-14px_rgba(88,12,30,0.2)] p-5 flex items-center gap-4">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>{icon}</span>
      <div>
        <p className="font-serif text-2xl font-bold text-[#1a1918] leading-none">{value}</p>
        <p className="text-xs text-[#665e5d] mt-1">{label}</p>
      </div>
    </div>
  );
}

/** Reviewer dashboard: only the abstracts assigned to the signed-in reviewer (enforced by the API). */
export function ReviewerDashboardPage() {
  const { reviewer } = useReviewerAuth();
  const q = useQuery({ queryKey: reviewerKeys.dashboard, queryFn: () => reviewerApi.get<ReviewerDashboard>('/dashboard') });
  if (q.isLoading) return <LoadingState label="Loading your assigned abstracts…" />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { counts, abstracts } = q.data;

  const columns: Column<ReviewerDashboard['abstracts'][number]>[] = [
    { header: 'Abstract ID', cell: (a) => <span className="font-mono text-xs font-bold text-[#580c1e] whitespace-nowrap">{a.abstractNumber}</span> },
    { header: 'Title', cell: (a) => <span className="font-semibold leading-snug">{a.title}</span> },
    { header: 'Presentation Category', cell: (a) => <span className="text-xs">{a.categoryLabel}</span> },
    { header: 'Track / Theme', cell: (a) => <span className="text-xs">{a.track ?? '—'}</span> },
    {
      header: 'Review Status',
      cell: (a) => <StatusBadge status={`review_${a.status}`} label={a.status === 'pending' && a.draftSaved ? 'Pending · draft saved' : a.statusLabel} />,
    },
    {
      header: 'Action',
      cell: (a) => (
        <Link to={`/reviewer/abstracts/${a.abstractId}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#580c1e] hover:underline whitespace-nowrap">
          {a.status === 'pending' ? (a.draftSaved ? 'Continue review' : 'Review') : 'View'} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <PortalPage title={`Welcome, ${reviewer?.name ?? 'Reviewer'}`} tag="Abstract Review">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<ClipboardList className="w-5 h-5" />} label="Total assigned" value={counts.assigned} tone="bg-[#580c1e] text-[#fef3c7]" />
        <Stat icon={<Clock className="w-5 h-5" />} label="Pending reviews" value={counts.pending} tone="bg-amber-100 text-amber-800" />
        <Stat icon={<CheckCircle2 className="w-5 h-5" />} label="Completed reviews" value={counts.completed} tone="bg-emerald-100 text-emerald-800" />
        <Stat icon={<ShieldAlert className="w-5 h-5" />} label="COI cases" value={counts.coi} tone="bg-violet-100 text-violet-800" />
      </div>
      <div>
        <h2 className="font-serif text-lg font-bold text-[#1a1918] mb-3">Assigned abstracts</h2>
        <DataTable columns={columns} rows={abstracts} rowKey={(a) => a.abstractId} empty="No abstracts have been assigned to you yet. You will be able to review them here once the organising team assigns them." />
      </div>
    </PortalPage>
  );
}
