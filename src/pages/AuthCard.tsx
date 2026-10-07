import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

/** Shared chrome for login / register / forgot / reset pages (same design as before). */
export function AuthCard({
  crumb,
  tag,
  icon,
  title,
  subtitle,
  width = 'max-w-md',
  standalone = true,
  children,
}: {
  /** Auth pages have no site navigation (the header offers "Back to site"), so no breadcrumb. */
  standalone?: boolean;
  crumb: string;
  tag: string;
  icon?: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8">
      {standalone ? (
        <p className={`${width} w-full mx-auto mb-6 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#c89e37]`}>ENDOCON 2027 · {tag}</p>
      ) : (
      <div className={`${width} w-full mx-auto flex items-center justify-between mb-6 text-xs text-[#665e5d]`}>
        <div className="flex items-center gap-2">
          <Link to="/" className="hover:text-[#580c1e] transition-colors inline-flex items-center gap-1">
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
          <span>/</span>
          <span className="text-[#580c1e] font-semibold">{crumb}</span>
        </div>
        <span className="text-[11px] font-bold text-[#c89e37] uppercase tracking-wider">{tag}</span>
      </div>
      )}

      <div className={`${width} w-full mx-auto bg-white rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(88,12,30,0.08)] border border-black/[0.06]`}>
        <div className="text-center mb-8">
           
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1a1918]">{title}</h1>
          <p className="text-xs text-[#665e5d] mt-1.5 font-light">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export const authInput =
  'w-full pl-10 pr-4 py-2.5 bg-[#faf8f5] border border-black/[0.08] rounded-xl text-sm text-[#1a1918] placeholder-[#665e5d]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#580c1e]/20 focus:border-[#580c1e] transition-all';

export const authSubmit =
  'w-full mt-2 bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7] hover:text-white py-3 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider shadow-sm hover:shadow-[0_6px_20px_rgba(88,12,30,0.25)] border border-[#d4af37]/40 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60';

export const authLabel = 'block text-xs font-bold uppercase tracking-wider text-[#4e4443] mb-1.5';
