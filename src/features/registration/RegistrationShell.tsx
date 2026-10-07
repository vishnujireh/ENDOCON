import React from 'react';
import { BedDouble, Check, ClipboardCheck, CreditCard, Microscope, Ticket, UserRound, type LucideIcon } from 'lucide-react';

/** The six registration steps – single source for labels and descriptions. */
export const STEP_ORDER = ['personal', 'conference', 'workshops', 'accommodation', 'summary', 'payment'] as const;
export type StepKey = (typeof STEP_ORDER)[number];

export const STEP_META: Record<StepKey, { label: string; title: string; blurb: string; subtitle: string; icon: LucideIcon; optional?: boolean }> = {
  personal: {
    label: 'Personal Details',
    title: 'Personal Details',
    blurb: 'Profile & contact',
    subtitle: 'Your details are saved to your account and pre-filled whenever you return.',
    icon: UserRound,
  },
  conference: {
    label: 'Conference',
    title: 'Conference Registration',
    blurb: 'Pick your category',
    subtitle: 'Choose your registration category. A conference registration can be purchased once.',
    icon: Ticket,
  },
  workshops: {
    label: 'Workshops',
    title: 'Workshops',
    blurb: 'Hands-on sessions',
    subtitle: 'Optional hands-on workshops. You can also add them later.',
    icon: Microscope,
    optional: true,
  },
  accommodation: {
    label: 'Accommodation',
    title: 'Accommodation',
    blurb: 'Hotel room',
    subtitle: 'Optional. One room booking per registration.',
    icon: BedDouble,
    optional: true,
  },
  summary: {
    label: 'Summary',
    title: 'Summary',
    blurb: 'Items, GST & total',
    subtitle: 'Review what you are paying for now.',
    icon: ClipboardCheck,
  },
  payment: {
    label: 'Payment',
    title: 'Payment',
    blurb: 'Pay securely',
    subtitle: 'Complete your payment securely.',
    icon: CreditCard,
  },
};

export type StepState = 'done' | 'current' | 'upcoming' | 'locked';

export interface ShellStep {
  key: StepKey;
  state: StepState;
  /** Short status line under the label (e.g. "Paid", "2 selected"); defaults to the step blurb. */
  note?: string;
  onClick?: () => void;
}

/** Page frame shared by the wizard and "My Registration": soft header band, event line and title. */
export function PortalPage({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#f6ead9] via-[#faf3ea] to-transparent pointer-events-none" aria-hidden />
      <div
        className="absolute inset-x-0 top-0 h-72 opacity-[0.35] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(88,12,30,0.18) 1px, transparent 0)', backgroundSize: '18px 18px', maskImage: 'linear-gradient(to bottom, black, transparent)' }}
        aria-hidden
      />
      <div className="relative py-8 md:py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8892b]">ENDOCON 2027 · 22–25 April · ITC Royal Bengal, Kolkata</p>
              <h1 className="font-serif text-2xl md:text-[32px] font-bold text-[#1a1918] mt-1">{title}</h1>
            </div>
            {tag && <span className="text-[11px] font-semibold text-[#580c1e] bg-white border border-[#580c1e]/15 shadow-sm rounded-full px-3 py-1.5">{tag}</span>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** The 6-step progress bar. `current` null = nothing in progress (everything available is done). */
export function WizardNav({ steps, current }: { steps: ShellStep[]; current: StepKey | null }) {
  const idx = current ? STEP_ORDER.indexOf(current) : STEP_ORDER.length - 1;
  const meta = current ? STEP_META[current] : null;
  const next = current ? STEP_ORDER[idx + 1] : undefined;
  const Icon = meta?.icon ?? Check;
  const pct = current ? Math.round((idx / (STEP_ORDER.length - 1)) * 100) : 100;
  return (
    <nav className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_10px_30px_-12px_rgba(88,12,30,0.18)] px-4 sm:px-6 pt-6 pb-5" aria-label="Registration progress">
      <div className="hidden sm:block relative">
        {/* track behind the circles: from the first to the last circle centre */}
        <div className="absolute top-5 h-1 rounded-full bg-black/[0.06]" style={{ left: `${100 / 12}%`, right: `${100 / 12}%` }} aria-hidden>
          <div className="h-full rounded-full bg-gradient-to-r from-[#580c1e] to-[#c89e37] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <ol className="relative grid grid-cols-6">
          {steps.map((s, i) => (
            <WizardStep key={s.key} step={s} n={i + 1} />
          ))}
        </ol>
      </div>

      <div className="sm:hidden">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 rounded-full bg-[#580c1e] text-[#fef3c7] flex items-center justify-center ring-4 ring-[#580c1e]/10">
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[#665e5d]">{meta ? `Step ${idx + 1} of ${STEP_ORDER.length}` : 'Registration'}</p>
            <p className="text-sm font-semibold text-[#1a1918] leading-tight">{meta ? meta.title : 'All steps completed'}</p>
          </div>
          {next && (
            <span className="text-[11px] text-[#665e5d] text-right">
              Next
              <br />
              <span className="font-medium text-[#1a1918]">{STEP_META[next].label}</span>
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-6 gap-1.5" aria-hidden>
          {steps.map((s) => (
            <span key={s.key} className={`h-1.5 rounded-full ${s.state === 'done' ? 'bg-[#580c1e]' : s.state === 'current' ? 'bg-[#c89e37]' : 'bg-black/[0.08]'}`} />
          ))}
        </div>
      </div>
    </nav>
  );
}

/**
 * Registration wizard layout: header band, the 6-step bar and the current step in one card.
 */
export function RegistrationShell({
  current,
  steps,
  tag,
  intro,
  children,
}: {
  current: StepKey;
  steps: ShellStep[];
  /** Small label next to the page title (e.g. the order number). */
  tag?: string;
  /** Optional block rendered above the step card (e.g. a welcome note). */
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  const idx = STEP_ORDER.indexOf(current);
  const meta = STEP_META[current];
  const Icon = meta.icon;

  return (
    <PortalPage title="Delegate Registration" tag={tag}>
      <WizardNav steps={steps} current={current} />
      {intro}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_10px_30px_-12px_rgba(88,12,30,0.15)] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#580c1e] via-[#9b2c44] to-[#c89e37]" aria-hidden />
        <header className="flex items-center gap-4 px-6 sm:px-8 py-5 border-b border-black/[0.06]">
          <span className="w-11 h-11 shrink-0 rounded-xl bg-[#fdf3e3] text-[#580c1e] ring-1 ring-[#c89e37]/30 flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b8892b]">
              Step {idx + 1} of {STEP_ORDER.length}
              {meta.optional && <span className="ml-2 normal-case tracking-normal font-medium text-[#8a8280]">· Optional</span>}
            </p>
            <h2 className="text-xl font-semibold text-[#1a1918] leading-tight">{meta.title}</h2>
          </div>
        </header>
        <div className="px-6 sm:px-8 py-6 sm:py-8">{children}</div>
      </div>
    </PortalPage>
  );
}

function WizardStep({ step, n }: { step: ShellStep; n: number }) {
  const meta = STEP_META[step.key];
  const Icon = meta.icon;
  const clickable = !!step.onClick && step.state !== 'current';
  const circle =
    step.state === 'done'
      ? 'bg-[#580c1e] text-white shadow-md shadow-[#580c1e]/20'
      : step.state === 'current'
        ? 'bg-[#580c1e] text-[#fef3c7] ring-[6px] ring-[#580c1e]/12 shadow-lg shadow-[#580c1e]/25'
        : 'bg-white text-[#a39b99] border-2 border-black/[0.08]';
  const status =
    step.state === 'done' ? step.note ?? 'Completed' : step.state === 'current' ? 'In progress' : meta.optional ? 'Optional' : `Step ${n}`;
  return (
    <li className="flex flex-col items-center text-center px-1">
      <button
        type="button"
        disabled={!clickable}
        onClick={step.onClick}
        aria-current={step.state === 'current' ? 'step' : undefined}
        aria-label={`Step ${n}: ${meta.title}`}
        className={`group flex flex-col items-center ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className={`w-11 h-11 -mt-0.5 rounded-full flex items-center justify-center transition-all ${circle} ${clickable ? 'group-hover:scale-105' : ''}`}>
          {step.state === 'done' ? <Check className="w-5 h-5" strokeWidth={2.5} /> : <Icon className="w-5 h-5" />}
        </span>
        <span className={`mt-2.5 text-xs leading-tight ${step.state === 'upcoming' || step.state === 'locked' ? 'text-[#665e5d]' : 'font-semibold text-[#1a1918]'} ${clickable ? 'group-hover:text-[#580c1e]' : ''}`}>
          {meta.label}
        </span>
        <span
          className={`mt-1 text-[10px] leading-tight max-w-[120px] truncate ${
            step.state === 'current' ? 'text-[#b8892b] font-semibold' : step.state === 'done' ? 'text-emerald-700' : 'text-[#a39b99]'
          }`}
        >
          {status}
        </span>
      </button>
    </li>
  );
}
