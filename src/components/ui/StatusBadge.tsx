import React from 'react';

const MAP: Record<string, { label: string; cls: string }> = {
  success: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  created: { label: 'Awaiting payment', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  pending: { label: 'Processing', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  conflict: { label: 'Needs review', cls: 'bg-orange-50 text-orange-800 border-orange-200' },
  refunded: { label: 'Refunded', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  partially_refunded: { label: 'Partly refunded', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  submitted: { label: 'Submitted', cls: 'bg-[#f7eed2] text-[#5c4300] border-[#c89e37]/40' },
  resubmitted: { label: 'Resubmitted', cls: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  accepted: { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
  duplicate: { label: 'Duplicate', cls: 'bg-orange-50 text-orange-800 border-orange-200' },
  // Judge reviews (per reviewer)
  review_pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  review_completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  review_coi: { label: 'COI', cls: 'bg-violet-50 text-violet-800 border-violet-200' },
  review_not_assigned: { label: 'Not assigned', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  review_in_review: { label: 'In review', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  inactive: { label: 'Inactive', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  Paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  Pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  Refunded: { label: 'Refunded', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = MAP[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700 border-gray-200' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${s.cls}`}>{label ?? s.label}</span>;
}
