import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T>({ columns, rows, rowKey, empty = 'No records found.' }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[#f5f3f0] text-[10px] uppercase tracking-wider text-[#665e5d]">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className={`text-left font-bold px-3 py-3 whitespace-nowrap ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-xs text-[#665e5d]">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={rowKey(r)} className="border-t border-black/[0.05] hover:bg-[#faf8f5]">
                {columns.map((c) => (
                  <td key={c.header} className={`px-3 py-3 align-top ${c.className ?? ''}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between text-xs text-[#665e5d] mt-3">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="p-1.5 rounded-lg border border-black/10 disabled:opacity-40 cursor-pointer" aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-2">
          Page {page} / {pages}
        </span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="p-1.5 rounded-lg border border-black/10 disabled:opacity-40 cursor-pointer" aria-label="Next page">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** Row of filter controls above a table. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 mb-4 p-4 bg-white rounded-2xl border border-black/[0.06]">{children}</div>;
}
