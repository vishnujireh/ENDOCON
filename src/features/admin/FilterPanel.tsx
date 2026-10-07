import React from 'react';
import { Download, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';

/**
 * The filter card used by every admin list (Registrations, Abstracts), so they look and behave alike:
 * title + result count + Export CSV on top, a 4-column grid of filters, and Clear / Apply at the bottom.
 * Text boxes apply on Enter or Apply; selects and dates apply immediately (handled by the page).
 */
export function FilterPanel({
  title,
  summary,
  activeCount,
  exportHref,
  onApply,
  onClear,
  actionsInline,
  headerActions,
  children,
}: {
  title: string;
  /** e.g. "12 registrations" – shown under the title. */
  summary: React.ReactNode;
  activeCount: number;
  exportHref: string;
  onApply: () => void;
  onClear: () => void;
  /** Put Clear / Apply in the last grid row (when the filters leave that much space free). */
  actionsInline?: boolean;
  /** Extra buttons / downloads shown next to Export CSV. */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const actions = (
    <div className={`flex items-center justify-end gap-2 ${actionsInline ? 'sm:col-span-2 self-end' : 'mt-5'}`}>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="px-4 py-2.5 rounded-full text-xs font-bold text-[#665e5d] hover:text-[#580c1e] hover:bg-black/[0.04] transition-colors cursor-pointer"
        >
          Clear filters
        </button>
      )}
      <Button size="sm" type="submit" icon={<Search className="w-3.5 h-3.5" />}>
        Apply
      </Button>
    </div>
  );

  return (
    <section className="mb-5 bg-white rounded-3xl border border-black/[0.06] shadow-[0_6px_24px_rgba(88,12,30,0.04)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-black/[0.05]">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#1a1918]">{title}</h1>
          <p className="text-xs text-[#665e5d] mt-0.5">
            {summary}
            {activeCount > 0 && ` · ${activeCount} filter${activeCount === 1 ? '' : 's'} applied`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {headerActions}
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-[#580c1e] bg-white border border-[#580c1e]/25 hover:bg-[#580c1e]/5 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </div>
      </div>

      <form
        className="px-5 sm:px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          onApply();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4">
          {children}
          {actionsInline && actions}
        </div>
        {!actionsInline && actions}
      </form>
    </section>
  );
}

/** One labelled filter; `wide` spans two columns (used for the main search box). */
export function FilterField({ label, htmlFor, wide, children }: { label: string; htmlFor: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label htmlFor={htmlFor} className="block text-[10px] font-bold uppercase tracking-wider text-[#665e5d] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Wraps a text input with the magnifier icon (give the input `className="pl-9"`). */
export function WithSearchIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <Search className="w-4 h-4 text-[#665e5d] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
      {children}
    </div>
  );
}
