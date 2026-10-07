import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Check, FileText, Loader2, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { date, dateTime } from '../../lib/format';
import { ABSTRACT_FORM_PATH, withNext } from '../../lib/nav';
import type { SubmissionWindow } from '../../api/types';

/**
 * The submission card in the home page's "Call for Abstracts" section. A free ENDOCON account is
 * required; the form itself is its own page (/abstracts/submit), decisions are under My Abstracts.
 */

const PANEL_ID = 'submit-abstract';

/** Brings the submission card into view. */
export const scrollToAbstractForm = () => document.getElementById(PANEL_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function useSubmissionWindow() {
  return useQuery({ queryKey: ['abstract-window'], queryFn: () => api.get<SubmissionWindow>('/abstracts/window'), staleTime: 60_000 });
}

/* ------------------------------------------------------------------------------------------------ */

const goldBtn =
  'w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#d4af37] to-[#e9c766] text-[#3d0714] text-xs font-bold uppercase tracking-wider shadow-[0_8px_20px_-8px_rgba(212,175,55,0.8)] hover:brightness-105 transition-all cursor-pointer';
const ghostBtn =
  'w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-white/25 text-[#fef3c7] text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors';

function Steps({ signedIn }: { signedIn: boolean }) {
  const steps = [
    signedIn ? 'Signed in to your ENDOCON account' : 'Log in or create a free account',
    'Fill in the form and upload your file',
    'Track the decision in My Abstracts',
  ];
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const done = i === 0 && signedIn;
        return (
          <li key={s} className="flex items-center gap-3 text-[13px] text-[#fef3c7]/90">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                done ? 'bg-[#d4af37] text-[#3d0714]' : 'bg-white/10 text-[#fef3c7] ring-1 ring-white/20'
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

/** The maroon card beside the category guide. */
export function AbstractSubmitPanel() {
  const { user, loading } = useAuth();
  const windowQ = useSubmissionWindow();
  const w = windowQ.data;
  const closed = w && !w.isOpen;
  const participant = user?.role === 'participant';

  let actions: React.ReactNode;
  if (loading || windowQ.isLoading) actions = <Loader2 className="w-5 h-5 animate-spin text-[#fef3c7]/70 mx-auto" />;
  else if (closed)
    actions = (
      <div className="space-y-3">
        <p className="text-sm text-[#fef3c7]/85">
          Submissions are accepted from {dateTime(w!.opensAt)} to {dateTime(w!.closesAt)}.
        </p>
        {participant && (
          <Link to="/my-abstracts" className={ghostBtn}>
            My Abstracts <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    );
  else if (!user)
    actions = (
      <div className="space-y-2.5">
        <Link to={withNext('/login', ABSTRACT_FORM_PATH)} className={goldBtn}>
          <LogIn className="w-4 h-4" /> Log in to submit
        </Link>
        <Link to={withNext('/create-account', ABSTRACT_FORM_PATH)} className={ghostBtn}>
          <UserPlus className="w-4 h-4" /> Create a free account
        </Link>
        <p className="text-[11px] text-[#fef3c7]/60 text-center pt-1">An account does not register you for the conference.</p>
      </div>
    );
  else if (!participant)
    actions = (
      <div className="space-y-3">
        <p className="text-sm text-[#fef3c7]/85">You are signed in as an administrator. Abstracts are submitted from a delegate account.</p>
        <Link to="/admin/abstracts" className={ghostBtn}>
          Review abstracts <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  else
    actions = (
      <div className="space-y-2.5">
        <p className="text-xs text-[#fef3c7]/70 truncate">
          Submitting as <span className="font-semibold text-[#fef3c7]">{[user.title, user.fullName].filter(Boolean).join(' ') || user.email}</span>
        </p>
        <Link to={ABSTRACT_FORM_PATH} className={goldBtn}>
          <FileText className="w-4 h-4" /> Start submission
        </Link>
        <Link to="/my-abstracts" className={ghostBtn}>
          My Abstracts <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );

  return (
    <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#4a0a19] via-[#580c1e] to-[#781029] p-6 sm:p-7 shadow-[0_24px_50px_-20px_rgba(88,12,30,0.65)] border border-[#d4af37]/25">
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#d4af37]/15 blur-2xl pointer-events-none" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">
          <ShieldCheck className="w-3.5 h-3.5" /> Online submission
        </div>
        <h3 className="mt-2 font-serif text-2xl font-bold text-white leading-tight">Submit your abstract</h3>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/[0.07] ring-1 ring-white/10 px-4 py-3">
          <CalendarClock className="w-5 h-5 text-[#d4af37] shrink-0" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#fef3c7]/60">{closed ? 'Submissions' : 'Submissions close'}</p>
            <p className="text-sm font-semibold text-white">{w ? (closed ? 'Closed' : date(w.closesAt)) : '…'}</p>
          </div>
        </div>

        <div className="mt-6">
          <Steps signedIn={participant} />
        </div>

        <div className="mt-7 pt-6 border-t border-white/10">{actions}</div>
      </div>
    </div>
  );
}
