import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

/** Page container with breadcrumb, consistent with the existing auth pages. */
export function PageShell({
  crumbs,
  tag,
  width = 'max-w-5xl',
  children,
}: {
  crumbs: { label: string; to?: string }[];
  tag?: string;
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-10 md:py-14 px-4 sm:px-6 lg:px-8">
      <div className={`${width} w-full mx-auto`}>
        <nav className="flex items-center justify-between mb-6 text-xs text-[#665e5d]" aria-label="Breadcrumb">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/" className="hover:text-[#580c1e] transition-colors inline-flex items-center gap-1">
              <Home className="w-3.5 h-3.5" /> Home
            </Link>
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                <span>/</span>
                {c.to ? (
                  <Link to={c.to} className="hover:text-[#580c1e]">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-[#580c1e] font-semibold">{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
          {tag && <span className="text-[11px] font-bold text-[#c89e37] uppercase tracking-wider">{tag}</span>}
        </nav>
        {children}
      </div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(88,12,30,0.06)] border border-black/[0.06] ${className}`}>{children}</div>
  );
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5">
      {eyebrow && <span className="text-[10px] font-bold uppercase tracking-widest text-[#c89e37] block mb-1">{eyebrow}</span>}
      <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1a1918]">{title}</h2>
      {children && <div className="text-xs text-[#665e5d] mt-1.5">{children}</div>}
    </div>
  );
}

export function DefinitionList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">{k}</dt>
          <dd className="text-[#1a1918] break-words">{v === null || v === undefined || v === '' ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  );
}
