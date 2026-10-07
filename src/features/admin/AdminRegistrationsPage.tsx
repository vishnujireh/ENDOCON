import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Eye, Pencil } from 'lucide-react';
import { api, apiUrl, queryString } from '../../lib/api';
import type { AdminRegistrationRow, AdminStats, Paged } from '../../api/types';
import { buildCatalogue } from '../../data/catalogue';
import { date, money } from '../../lib/format';
import { DataTable, Pagination, type Column } from '../../components/ui/DataTable';
import { SelectInput, TextInput } from '../../components/ui/Field';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FilterField, FilterPanel, WithSearchIcon } from './FilterPanel';
import { ResendButton } from './ResendButton';

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">{label}</span>
      <p className={`font-serif text-3xl font-bold mt-1 ${tone ?? 'text-[#1a1918]'}`}>{value}</p>
    </div>
  );
}

/** Delegate categories from the static catalogue file (for the filter). */
const DELEGATE_CATEGORIES = buildCatalogue().categories.filter((c) => c.kind === 'delegate');

export function AdminRegistrationsPage() {
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get('q') ?? '',
    paymentStatus: params.get('paymentStatus') ?? '',
    categoryCode: params.get('categoryCode') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    page: Number(params.get('page') ?? 1),
  };
  const [search, setSearch] = useState(filters.q);
  const update = (patch: Record<string, string | number>) => {
    const next = { ...filters, page: 1, ...patch };
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => [k, String(v)])));
  };

  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get<AdminStats>('/admin/stats') });
  const qs = queryString({ ...filters, pageSize: 25 });
  const list = useQuery({ queryKey: ['admin', 'registrations', qs], queryFn: () => api.get<Paged<AdminRegistrationRow>>(`/admin/registrations${qs}`), placeholderData: keepPreviousData });
  const exportQs = queryString({ q: filters.q, paymentStatus: filters.paymentStatus, categoryCode: filters.categoryCode, from: filters.from, to: filters.to });

  const columns: Column<AdminRegistrationRow>[] = [
    { header: 'Sl. No.', cell: (r) => r.slNo, className: 'w-14 text-[#665e5d]' },
    { header: 'Order ID', cell: (r) => (r.orderNumber ? <span className="font-mono font-bold text-[#580c1e]">{r.orderNumber}</span> : <span className="text-[#665e5d]">—</span>) },
    {
      header: 'Name',
      cell: (r) => (
        <div>
          <span className="font-semibold">{r.name || '—'}</span>
          {r.conference && <span className="block text-[11px] text-[#665e5d]">{r.conference}</span>}
          {!r.profileComplete && <span className="block text-[10px] text-amber-700">Step 1 incomplete</span>}
        </div>
      ),
    },
    { header: 'Email', cell: (r) => <span className="text-xs break-all">{r.email}</span> },
    { header: 'Phone', cell: (r) => <span className="text-xs whitespace-nowrap">{r.phone ?? '—'}</span> },
    {
      header: 'Payment Status',
      cell: (r) => (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={r.paymentStatus} />
          {r.paidTotalMinor > 0 && <span className="text-[11px] text-[#665e5d]">{money(r.paidTotalMinor)}</span>}
          {r.needsAttention && (
            <span className="text-[10px] font-bold text-orange-700 inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Needs review
            </span>
          )}
        </div>
      ),
    },
    { header: 'Date', cell: (r) => <span className="text-xs whitespace-nowrap">{date(r.confirmedAt ?? r.registeredAt)}</span> },
    {
      header: 'Action',
      cell: (r) => (
        <div className="flex items-center gap-2 text-xs whitespace-nowrap">
          <Link to={`/admin/registrations/${r.userId}`} className="inline-flex items-center gap-1 font-bold text-[#580c1e] hover:underline" title="View">
            <Eye className="w-3.5 h-3.5" /> View
          </Link>
          <Link to={`/admin/registrations/${r.userId}?edit=1`} className="inline-flex items-center gap-1 font-bold text-[#580c1e] hover:underline" title="Edit">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
          {r.paymentStatus === 'Paid' && <ResendButton userId={r.userId} compact />}
        </div>
      ),
    },
  ];

  return (
    <div>
      {stats.data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Stat label="Total" value={stats.data.registrations.total} />
          <Stat label="Paid" value={stats.data.registrations.paid} tone="text-emerald-700" />
          <Stat label="Pending" value={stats.data.registrations.pending} tone="text-amber-700" />
          <Stat label="Collected (net)" value={<span className="text-2xl">{money(stats.data.revenueMinor, 'INR', { decimals: false })}</span>} />
        </div>
      )}
      {stats.data && stats.data.paymentsNeedingAttention > 0 && (
        <button onClick={() => update({ paymentStatus: 'attention' })} className="mb-4 w-full text-left p-3 rounded-2xl bg-orange-50 border border-orange-200 text-xs text-orange-900 cursor-pointer">
          <AlertTriangle className="w-4 h-4 inline mr-1" /> {stats.data.paymentsNeedingAttention} payment(s) were captured but could not be applied automatically and may need a refund. Click to filter.
        </button>
      )}

      <FilterPanel
        title="Registrations"
        summary={list.data ? `${list.data.total} registration${list.data.total === 1 ? '' : 's'}` : '…'}
        activeCount={Object.entries(filters).filter(([k, v]) => k !== 'page' && v !== '').length}
        exportHref={apiUrl(`/admin/registrations/export.csv${exportQs}`)}
        onApply={() => update({ q: search })}
        onClear={() => {
          setSearch('');
          setParams({});
        }}
        actionsInline
      >
        <FilterField label="Search" htmlFor="reg-q" wide>
          <WithSearchIcon>
            <TextInput id="reg-q" className="pl-9" placeholder="Name, email, phone, order ID, organisation" value={search} onChange={(e) => setSearch(e.target.value)} />
          </WithSearchIcon>
        </FilterField>
        <FilterField label="Payment status" htmlFor="reg-status">
          <SelectInput id="reg-status" value={filters.paymentStatus} onChange={(e) => update({ paymentStatus: e.target.value })}>
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="attention">Needs review</option>
          </SelectInput>
        </FilterField>
        <FilterField label="Conference" htmlFor="reg-cat">
          <SelectInput id="reg-cat" value={filters.categoryCode} onChange={(e) => update({ categoryCode: e.target.value })}>
            <option value="">All categories</option>
            {DELEGATE_CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </FilterField>
        <FilterField label="Registered from" htmlFor="reg-from">
          <TextInput id="reg-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} />
        </FilterField>
        <FilterField label="Registered to" htmlFor="reg-to">
          <TextInput id="reg-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} />
        </FilterField>
      </FilterPanel>

      {list.isLoading ? (
        <LoadingState />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <DataTable columns={columns} rows={list.data.rows} rowKey={(r) => r.userId} empty="No registrations match these filters." />
          <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => update({ page: p })} />
        </>
      )}
    </div>
  );
}
