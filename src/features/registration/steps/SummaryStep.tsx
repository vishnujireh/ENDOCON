import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import type { Catalogue, Quote, RegistrationStatus } from '../../../api/types';
import { money } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { MoneyTable } from '../../../components/ui/MoneyTable';
import { Alert, EmptyState, LoadingState } from '../../../components/ui/States';
import { sanitizeCart, useCart } from '../CartContext';

/** Server-authoritative price for the current selection. Shared by Summary and Payment. */
export function useQuote(status: RegistrationStatus) {
  const { cart } = useCart();
  const clean = useMemo(
    () =>
      sanitizeCart(cart, {
        conference: !!status.conference,
        workshopCodes: status.workshops.map((w) => w.workshopCode),
        accommodation: !!status.accommodation,
      }),
    [cart, status],
  );
  const empty = !clean.conferenceCategoryCode && !clean.workshopCodes.length && !clean.accommodation && !clean.accompanyingPersons.length;
  const query = useQuery({
    queryKey: ['quote', clean],
    queryFn: async () => (await api.post<Quote>('/registration/quote', clean)).data,
    enabled: !empty,
    retry: false,
  });
  return { ...query, cart: clean, empty };
}

const FIX_STEP: Record<string, string> = {
  PROFILE_INCOMPLETE: 'personal',
  MEMBERSHIP_REQUIRED: 'personal',
  CONFERENCE_REQUIRED: 'conference',
  CONFERENCE_ALREADY_PURCHASED: 'conference',
  WORKSHOP_FULL: 'workshops',
  WORKSHOP_ALREADY_PURCHASED: 'workshops',
  ACCOMMODATION_ALREADY_PURCHASED: 'accommodation',
  VALIDATION_ERROR: 'accommodation',
};

export function QuoteError({ error, goTo }: { error: unknown; goTo: (step: string) => void }) {
  const code = error instanceof ApiError ? error.code : '';
  const fix = FIX_STEP[code];
  const detail = error instanceof ApiError ? Object.values(error.fieldErrors)[0] : undefined;
  return (
    <Alert tone="error">
      {detail ?? (error as Error).message}
      {fix && (
        <button onClick={() => goTo(fix)} className="ml-2 font-bold underline cursor-pointer">
          Fix this
        </button>
      )}
    </Alert>
  );
}

export function SummaryStep({ status, catalogue, goTo, onBack, onNext }: { status: RegistrationStatus; catalogue: Catalogue; goTo: (s: string) => void; onBack: () => void; onNext: () => void }) {
  const { data: quote, isLoading, error, empty } = useQuote(status);
  const previously = [
    ...(status.conference ? [`Conference – ${status.conference.categoryName}`] : []),
    ...status.workshops.map((w) => `Workshop – ${w.name}`),
    ...(status.accommodation ? [status.accommodation.description] : []),
    ...status.accompanying.map((a) => `Accompanying – ${a.fullName}`),
  ];

  return (
    <div className="space-y-5">
      {empty ? (
        <EmptyState title="Nothing selected to purchase">
          Go back to choose a conference registration, workshops or accommodation.
          <div className="mt-4">
            <Button variant="secondary" onClick={() => goTo(status.conference ? 'workshops' : 'conference')}>
              Choose items
            </Button>
          </div>
        </EmptyState>
      ) : isLoading ? (
        <LoadingState label="Calculating your total…" />
      ) : error ? (
        <QuoteError error={error} goTo={goTo} />
      ) : quote ? (
        <>
          <MoneyTable lines={quote.lines} subtotalMinor={quote.subtotalMinor} gstMinor={quote.gstMinor} totalMinor={quote.totalMinor} gstPercent={catalogue.gstRatePercent} />
          <p className="text-[11px] text-[#665e5d] flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              {quote.pricingPeriod.label} pricing applies ({quote.pricingPeriod.displayRange}). GST of {catalogue.gstRatePercent}% is calculated on the taxable amount. Only the items listed above
              are charged in this payment.
            </span>
          </p>
        </>
      ) : null}

      {previously.length > 0 && (
        <details className="p-4 rounded-2xl bg-[#faf8f5] border border-black/[0.06] text-xs">
          <summary className="font-bold cursor-pointer">Already purchased ({previously.length}) – not charged again · paid so far {money(status.paidTotalMinor)}</summary>
          <ul className="list-disc pl-5 mt-2 space-y-0.5 text-[#4e4443]">
            {previously.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex justify-between pt-2 border-t border-black/[0.06]">
        <Button variant="secondary" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <Button onClick={onNext} disabled={empty || !quote} icon={<ArrowRight className="w-4 h-4" />}>
          Proceed to payment
        </Button>
      </div>
    </div>
  );
}
