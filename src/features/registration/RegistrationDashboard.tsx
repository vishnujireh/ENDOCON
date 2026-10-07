import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BedDouble, CheckCircle2, Hourglass, Microscope, Receipt, Ticket, Users } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { date, dateTime, money, PERIOD_LABEL } from '../../lib/format';
import type { RegistrationStatus } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Alert, ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useCatalogue, useRegistrationStatus } from './hooks';
import { PortalPage, STEP_META, STEP_ORDER, WizardNav, type ShellStep, type StepKey } from './RegistrationShell';

function PortalCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-black/[0.06] shadow-[0_10px_30px_-12px_rgba(88,12,30,0.15)] p-6 sm:p-7 ${className}`}>{children}</div>
  );
}

/** One line of the "Your registration" summary. */
function ItemRow({ icon, label, children, action }: { icon: React.ReactNode; label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <span className="w-10 h-10 shrink-0 rounded-xl bg-[#fdf3e3] text-[#580c1e] ring-1 ring-[#c89e37]/30 flex items-center justify-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8280]">{label}</p>
        <div className="text-sm text-[#1a1918] mt-0.5">{children}</div>
      </div>
      {action && <div className="shrink-0 pt-4">{action}</div>}
    </div>
  );
}

const linkCls = 'text-xs font-semibold text-[#580c1e] hover:underline whitespace-nowrap';

/**
 * "My Registration" (from the name menu): what has been purchased, the next thing to do,
 * and payments / invoices. Same design as the wizard.
 */
export function RegistrationDashboard() {
  const { data: s, isLoading, error, refetch } = useRegistrationStatus();
  const { data: catalogue } = useCatalogue();
  /** No workshops published yet – shown as "Coming soon". */
  const noWorkshopsYet = catalogue.workshops.length === 0;
  const navigate = useNavigate();
  if (isLoading) return <LoadingState label="Loading your registration…" />;
  if (error || !s) return <ErrorState error={error} onRetry={() => refetch()} />;

  const profileDone = s.steps.personal === 'complete';
  const complete = s.nextStep === 'complete';
  const current: StepKey | null = complete ? null : (s.nextStep as StepKey);
  const done: Record<StepKey, boolean> = {
    personal: profileDone,
    conference: !!s.conference,
    workshops: s.workshops.length > 0,
    accommodation: !!s.accommodation,
    summary: complete,
    payment: complete,
  };
  const steps: ShellStep[] = STEP_ORDER.map((key, i) => ({
    key,
    state: key === current ? 'current' : done[key] ? 'done' : 'upcoming',
    onClick: key === 'summary' || key === 'payment' ? undefined : profileDone || i === 0 ? () => navigate(`/registration/wizard/${key}`) : undefined,
  }));
  const canAddWorkshops = !!s.conference && s.steps.workshops.remaining > 0;
  const successful = s.payments.filter((p) => ['success', 'partially_refunded', 'refunded'].includes(p.status));

  return (
    <PortalPage title="My Registration" tag={s.order?.orderNumber ? `Registration No. ${s.order.orderNumber}` : undefined}>
      <WizardNav steps={steps} current={current} />

      {s.openPayment && (
        <Alert tone="warning">
          <span className="font-semibold">A payment of {money(s.openPayment.totalMinor)} is awaiting confirmation.</span> If you have already paid, it will be confirmed
          automatically within a few minutes.{' '}
          <Link to={`/payment/${s.openPayment.id}`} className="underline font-bold">
            Check status
          </Link>
        </Alert>
      )}

      {/* Next action */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_10px_30px_-12px_rgba(88,12,30,0.15)] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#580c1e] via-[#9b2c44] to-[#c89e37]" aria-hidden />
        <div className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {!complete ? (
            <>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b8892b]">
                  Next · Step {STEP_ORDER.indexOf(s.nextStep as StepKey) + 1} of {STEP_ORDER.length}
                </p>
                <p className="text-lg font-semibold text-[#1a1918]">{STEP_META[s.nextStep as StepKey].title}</p>
              </div>
              <Button onClick={() => navigate(`/registration/wizard/${s.nextStep}`)} icon={<ArrowRight className="w-4 h-4" />}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-lg font-semibold text-[#1a1918]">Your registration is confirmed</p>
                  <p className="text-xs text-[#665e5d]">You can still add workshops or accompanying persons.</p>
                </div>
              </div>
              {canAddWorkshops && (
                <Button variant="secondary" onClick={() => navigate('/registration/wizard/workshops')}>
                  Add workshops
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* What has been purchased */}
      <PortalCard>
        <h2 className="text-lg font-semibold text-[#1a1918] mb-5">Your registration</h2>
        <div className="divide-y divide-black/[0.06]">
          <ItemRow
            icon={<Ticket className="w-5 h-5" />}
            label="Conference"
            action={profileDone && !s.conference ? <Link to="/registration/wizard/conference" className={linkCls}>Choose →</Link> : undefined}
          >
            {s.conference ? (
              <>
                <span className="font-semibold">{s.conference.categoryName}</span>
                <span className="text-[#665e5d]">
                  {' '}
                  · {PERIOD_LABEL[s.conference.pricingPeriodCode ?? ''] ?? ''} · {money(s.conference.amountMinor)} + GST
                </span>
              </>
            ) : (
              <span className="text-[#665e5d]">Not purchased yet</span>
            )}
          </ItemRow>
          <ItemRow
            icon={<Microscope className="w-5 h-5" />}
            label="Workshops"
            action={canAddWorkshops ? <Link to="/registration/wizard/workshops" className={linkCls}>Add →</Link> : undefined}
          >
            {s.workshops.length ? (
              <ul className="space-y-0.5">
                {s.workshops.map((w) => (
                  <li key={w.id}>{w.name}</li>
                ))}
              </ul>
            ) : noWorkshopsYet ? (
              <span className="inline-flex items-center rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#8b6a1f]">Coming soon</span>
            ) : (
              <span className="text-[#665e5d]">None</span>
            )}
          </ItemRow>
          <ItemRow
            icon={<BedDouble className="w-5 h-5" />}
            label="Accommodation"
            action={s.conference && !s.accommodation ? <Link to="/registration/wizard/accommodation" className={linkCls}>Book →</Link> : undefined}
          >
            {s.accommodation ? (
              <>
                <span className="font-semibold">
                  {s.accommodation.hotelName} – {s.accommodation.occupancy === 'single' ? 'Single Occupancy' : 'Twin Share'}
                </span>
                <span className="text-[#665e5d]">
                  {' '}
                  · {date(s.accommodation.checkIn)} → {date(s.accommodation.checkOut)} ({s.accommodation.nights} night{s.accommodation.nights > 1 ? 's' : ''})
                </span>
              </>
            ) : (
              <span className="text-[#665e5d]">None</span>
            )}
          </ItemRow>
          <ItemRow
            icon={<Users className="w-5 h-5" />}
            label="Accompanying persons"
            action={s.conference ? <Link to="/registration/wizard/conference" className={linkCls}>Add →</Link> : undefined}
          >
            {s.accompanying.length ? (
              s.accompanying.map((a) => [a.title, a.fullName].filter(Boolean).join(' ')).join(', ')
            ) : (
              <span className="text-[#665e5d]">None</span>
            )}
          </ItemRow>
        </div>
      </PortalCard>

      <PortalCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1a1918] flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#580c1e]" /> Payments &amp; Invoices
          </h2>
          {successful.length > 0 && (
            <span className="text-xs text-[#665e5d]">
              Total paid: <strong className="text-[#1a1918]">{money(s.paidTotalMinor)}</strong>
            </span>
          )}
        </div>
        {s.payments.length === 0 ? (
          <p className="text-xs text-[#665e5d] flex items-center gap-2">
            <Hourglass className="w-4 h-4" /> No payments yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-[#665e5d] bg-[#f5f3f0]">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">For</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {s.payments.map((p) => (
                  <tr key={p.id} className="border-t border-black/[0.05] align-top">
                    <td className="px-3 py-3 text-xs">
                      <span className="whitespace-nowrap">{dateTime(p.paidAt ?? p.createdAt)}</span>
                      {p.gatewayPaymentId && <span className="block font-mono text-[10px] text-[#8a8280] mt-0.5 break-all">{p.gatewayPaymentId}</span>}
                    </td>
                    <td className="px-3 py-3 text-xs min-w-[220px]">
                      <ul className="space-y-0.5">
                        {p.items.map((i, k) => (
                          <li key={k}>{i.description}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="font-semibold">{money(p.totalMinor)}</span>
                      <span className="block text-[10px] text-[#8a8280]">incl. GST {money(p.gstMinor)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-right">
                      {p.invoice ? (
                        <a href={apiUrl(`/invoices/${p.invoice.id}/pdf?download=1`)} className="font-bold text-[#580c1e] hover:underline">
                          Invoice
                        </a>
                      ) : ['created', 'pending'].includes(p.status) ? (
                        <Link to={`/payment/${p.id}`} className="font-bold text-[#580c1e] hover:underline">
                          Status
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalCard>
    </PortalPage>
  );
}
