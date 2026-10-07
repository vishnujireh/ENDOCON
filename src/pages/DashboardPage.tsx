import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Clock, FilePlus2, FileText, Loader2, MessageSquareWarning, Ticket } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { date } from '../lib/format';
import { ABSTRACT_FORM_PATH } from '../lib/nav';
import type { MyAbstractList } from '../api/types';
import { PortalPage, STEP_META } from '../features/registration/RegistrationShell';
import { useRegistrationStatus } from '../features/registration/hooks';

/**
 * "My ENDOCON" – where delegates land after signing up or logging in (unless they came from a
 * specific button). One account, two separate journeys: conference registration and abstracts.
 */

const primary =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7] hover:text-white text-xs font-bold uppercase tracking-wider border border-[#d4af37]/40 shadow-sm hover:shadow-[0_6px_18px_rgba(88,12,30,0.25)] transition-all';
const secondary = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-[#580c1e] border border-[#580c1e]/20 hover:bg-[#580c1e]/5 transition-colors';

function Chip({ tone, children }: { tone: 'done' | 'progress' | 'idle' | 'warn'; children: React.ReactNode }) {
  const cls = {
    done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    progress: 'bg-amber-50 text-amber-800 border-amber-200',
    idle: 'bg-[#faf8f5] text-[#665e5d] border-black/[0.08]',
    warn: 'bg-red-50 text-red-700 border-red-200',
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold ${cls}`}>{children}</span>;
}

function ChoiceCard({
  icon,
  eyebrow,
  title,
  description,
  status,
  actions,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  status: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="group relative flex flex-col bg-white rounded-3xl border border-black/[0.06] shadow-[0_18px_45px_-22px_rgba(88,12,30,0.3)] p-6 sm:p-8 hover:-translate-y-0.5 hover:shadow-[0_24px_55px_-22px_rgba(88,12,30,0.4)] transition-all">
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-gradient-to-r from-[#580c1e] via-[#9b2c3f] to-[#d4af37]" aria-hidden />
      <div className="flex items-start justify-between gap-4">
        <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#580c1e] to-[#781029] text-[#fef3c7] flex items-center justify-center shadow-[0_10px_24px_-10px_rgba(88,12,30,0.7)]">
          {icon}
        </span>
        <div className="text-right">{status}</div>
      </div>
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8892b]">{eyebrow}</p>
      <h2 className="mt-1 font-serif text-2xl font-bold text-[#1a1918]">{title}</h2>
      <p className="mt-2 text-sm text-[#665e5d] leading-relaxed flex-1">{description}</p>
      <div className="mt-7 flex flex-wrap items-center gap-2.5">{actions}</div>
    </div>
  );
}

function ConferenceCard() {
  const q = useRegistrationStatus();
  const s = q.data;
  let status: React.ReactNode = <Loader2 className="w-4 h-4 animate-spin text-[#665e5d]" />;
  let actions: React.ReactNode = null;
  if (s) {
    if (s.conference) {
      status = (
        <Chip tone="done">
          <CheckCircle2 className="w-3.5 h-3.5" /> Registered{s.order?.orderNumber ? ` · ${s.order.orderNumber}` : ''}
        </Chip>
      );
      actions = (
        <>
          <Link to="/registration" className={primary}>
            My registration <ArrowRight className="w-3.5 h-3.5 text-[#d4af37]" />
          </Link>
          {s.nextStep !== 'complete' && (
            <Link to="/registration/continue" className={secondary}>
              Add workshops / accommodation
            </Link>
          )}
        </>
      );
    } else {
      const started = s.steps.personal === 'complete';
      status = started ? (
        <Chip tone="progress">
          <Clock className="w-3.5 h-3.5" /> In progress · next: {STEP_META[s.nextStep as keyof typeof STEP_META]?.label ?? 'Conference'}
        </Chip>
      ) : (
        <Chip tone="idle">Not started</Chip>
      );
      actions = (
        <Link to="/registration/continue" className={primary}>
          {started ? 'Continue registration' : 'Start registration'} <ArrowRight className="w-3.5 h-3.5 text-[#d4af37]" />
        </Link>
      );
    }
  } else if (q.error) {
    status = <Chip tone="idle">Status unavailable</Chip>;
    actions = (
      <Link to="/registration" className={primary}>
        Open registration <ArrowRight className="w-3.5 h-3.5 text-[#d4af37]" />
      </Link>
    );
  }
  return (
    <ChoiceCard
      icon={<Ticket className="w-7 h-7" />}
      eyebrow="Attend ENDOCON 2027"
      title="Conference Registration"
      description="Register as a delegate for 22–25 April 2027 at ITC Royal Bengal, Kolkata. Add workshops and accommodation now or later – everything stays under one order."
      status={status}
      actions={actions}
    />
  );
}

function AbstractCard() {
  const q = useQuery({ queryKey: ['my-abstracts'], queryFn: () => api.get<MyAbstractList>('/abstracts/mine') });
  const d = q.data;
  let status: React.ReactNode = <Loader2 className="w-4 h-4 animate-spin text-[#665e5d]" />;
  if (d) {
    const needs = d.abstracts.filter((a) => a.canResubmit).length;
    const accepted = d.abstracts.filter((a) => a.status === 'accepted').length;
    status = !d.abstracts.length ? (
      <Chip tone="idle">None submitted</Chip>
    ) : needs ? (
      <Chip tone="warn">
        <MessageSquareWarning className="w-3.5 h-3.5" /> {needs} need{needs === 1 ? 's' : ''} revision
      </Chip>
    ) : (
      <Chip tone={accepted ? 'done' : 'progress'}>
        {d.abstracts.length} submitted{accepted ? ` · ${accepted} accepted` : ''}
      </Chip>
    );
  } else if (q.error) status = <Chip tone="idle">Status unavailable</Chip>;
  const open = d?.window.isOpen ?? true;

  return (
    <ChoiceCard
      icon={<FileText className="w-7 h-7" />}
      eyebrow="Present your research"
      title="Abstract Submission"
      description={
        open
          ? `Submit to the Plenary, Young Investigator, Oral Paper, E-Poster or Video Digest sessions${d ? ` until ${date(d.window.closesAt)}` : ''}. Follow the Scientific Committee’s decision in My Abstracts.`
          : 'Abstract submission is closed. You can still follow the decisions on your abstracts in My Abstracts.'
      }
      status={status}
      actions={
        <>
          {open && (
            <Link to={ABSTRACT_FORM_PATH} className={primary}>
              <FilePlus2 className="w-4 h-4 text-[#d4af37]" /> Submit an abstract
            </Link>
          )}
          <Link to="/my-abstracts" className={open ? secondary : primary}>
            My Abstracts
          </Link>
        </>
      }
    />
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const name = [user?.title, user?.fullName].filter(Boolean).join(' ') || user?.email;
  return (
    <PortalPage title={`Welcome, ${name}`} tag="My ENDOCON">
      <p className="text-sm text-[#4e4443] -mt-1">What would you like to do today? Your account works for both – you can come back to either at any time.</p>
      <div className="grid md:grid-cols-2 gap-5">
        <ConferenceCard />
        <AbstractCard />
      </div>
      <p className="text-[11px] text-[#8a8280]">Submitting an abstract does not register you for the conference. The presenting author of an accepted abstract must complete conference registration.</p>
    </PortalPage>
  );
}
