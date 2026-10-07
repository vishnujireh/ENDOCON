import React, { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useCart } from './CartContext';
import { useCatalogue, useRegistrationStatus } from './hooks';
import { RegistrationShell, STEP_ORDER, type ShellStep, type StepKey } from './RegistrationShell';
import { AccommodationStep } from './steps/AccommodationStep';
import { ConferenceStep } from './steps/ConferenceStep';
import { PaymentStep } from './steps/PaymentStep';
import { PersonalStep } from './steps/PersonalStep';
import { SummaryStep } from './steps/SummaryStep';
import { WorkshopsStep } from './steps/WorkshopsStep';

/**
 * Resumable 6-step registration. The server status decides what is complete / purchased;
 * the cart only holds the current (unpaid) selection.
 */
export function RegistrationWizard() {
  const { step: raw } = useParams();
  const step = (STEP_ORDER as readonly string[]).includes(raw ?? '') ? (raw as StepKey) : null;
  const navigate = useNavigate();
  const status = useRegistrationStatus();
  const catalogue = useCatalogue();
  const { cart } = useCart();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  if (!step) return <Navigate to="/registration" replace />;
  if (status.isLoading || catalogue.isLoading) return <LoadingState label="Loading your registration…" />;
  if (status.error || catalogue.error || !status.data || !catalogue.data) {
    return <ErrorState error={status.error ?? catalogue.error} onRetry={() => { status.refetch(); catalogue.refetch(); }} />;
  }

  const s = status.data;
  const c = catalogue.data;
  const profileDone = s.steps.personal === 'complete';
  if (!profileDone && step !== 'personal') return <Navigate to="/registration/wizard/personal" replace />;

  const goTo = (target: string) => navigate(`/registration/wizard/${target}`);
  const idx = STEP_ORDER.indexOf(step);
  const next = () => goTo(STEP_ORDER[Math.min(idx + 1, STEP_ORDER.length - 1)]);
  const back = () => (idx === 0 ? navigate('/registration') : goTo(STEP_ORDER[idx - 1]));

  const newWorkshops = cart.workshopCodes.length;
  const heldWorkshops = s.workshops.length;
  const notes: Partial<Record<StepKey, string>> = {
    personal: profileDone ? 'Completed' : undefined,
    conference: s.conference ? `Registered · ${s.conference.categoryName}` : cart.conferenceCategoryCode ? 'Selected – not paid yet' : undefined,
    workshops:
      heldWorkshops || newWorkshops
        ? [heldWorkshops && `${heldWorkshops} registered`, newWorkshops && `${newWorkshops} selected`].filter(Boolean).join(' · ')
        : undefined,
    accommodation: s.accommodation ? 'Booked' : cart.accommodation ? 'Selected – not paid yet' : undefined,
  };
  const done: Record<StepKey, boolean> = {
    personal: profileDone,
    conference: !!s.conference || !!cart.conferenceCategoryCode,
    workshops: heldWorkshops > 0 || newWorkshops > 0,
    accommodation: !!s.accommodation || !!cart.accommodation,
    summary: false,
    payment: false,
  };
  // Every step before the current one is ticked, so the bar never shows gaps. A passed step with
  // nothing chosen is labelled "Skipped" (optional steps) / "Reviewed" (summary).
  const passedNote = (key: StepKey): string | undefined => {
    if (notes[key]) return notes[key];
    if (key === 'summary') return 'Reviewed';
    if (key === 'workshops' || key === 'accommodation') return 'Skipped';
    return undefined;
  };
  const steps: ShellStep[] = STEP_ORDER.map((key, i) => {
    const passed = i < idx;
    return {
      key,
      state: key === step ? 'current' : passed || done[key] ? 'done' : 'upcoming',
      note: passed ? passedNote(key) : notes[key],
      onClick: profileDone || i === 0 ? () => goTo(key) : undefined,
    };
  });

  return (
    <RegistrationShell current={step} steps={steps} tag={s.order?.orderNumber ?? 'New Registration'}>
      {step === 'personal' && <PersonalStep status={s} onNext={() => goTo(s.conference ? (s.nextStep === 'complete' ? 'conference' : s.nextStep) : 'conference')} />}
      {step === 'conference' && <ConferenceStep status={s} catalogue={c} onBack={back} onNext={next} />}
      {step === 'workshops' && <WorkshopsStep status={s} catalogue={c} onBack={back} onNext={next} />}
      {step === 'accommodation' && <AccommodationStep status={s} catalogue={c} onBack={back} onNext={next} />}
      {step === 'summary' && <SummaryStep status={s} catalogue={c} goTo={goTo} onBack={back} onNext={next} />}
      {step === 'payment' && <PaymentStep status={s} goTo={goTo} onBack={back} />}
    </RegistrationShell>
  );
}
