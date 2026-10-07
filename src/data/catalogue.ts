import raw from '@shared/catalogue.json';
import type { AccommodationOption, Catalogue, Category, Period, RegistrationStatus, Workshop } from '../api/types';

/**
 * The static registration catalogue, read from ../shared/catalogue.json at build time
 * (the same file the backend uses to decide prices). No API call is needed to show it.
 *
 * Amounts shown here are for display only – the server always recalculates the price
 * (from the same file and SERVER time) before a payment is created.
 */

type RawFile = typeof raw;
const file = raw as RawFile;

const minor = (major: number) => Math.round(major * 100);

/** USD cents → whole INR rupees (in paise), same rounding as the server. */
function usdToInrMinor(cents: number, rate: number): number {
  return Math.round((cents / 100) * rate) * 100;
}

function toDisplayRate(bps: number): string {
  return bps % 100 === 0 ? String(bps / 100) : (bps / 100).toFixed(2);
}

export const PERIODS: Period[] = file.pricingPeriods.map((p) => ({
  code: p.code,
  label: p.label,
  displayRange: p.displayRange,
  startsAt: p.startsAt,
  endsAt: p.endsAt,
}));

/** Fallback only (e.g. status not loaded yet): the period by this device's clock. */
function periodByLocalClock(): Period {
  const t = Date.now();
  return PERIODS.find((p) => (!p.startsAt || Date.parse(p.startsAt) <= t) && (!p.endsAt || t < Date.parse(p.endsAt))) ?? PERIODS[PERIODS.length - 1];
}

/**
 * Build the catalogue for display. `status` supplies the SERVER-decided current pricing period and
 * the seats left for capped workshops.
 */
export function buildCatalogue(status?: Pick<RegistrationStatus, 'pricing' | 'workshopSeatsLeft'> | null): Catalogue {
  const period = PERIODS.find((p) => p.code === status?.pricing?.periodCode) ?? periodByLocalClock();
  const rate = file.usdToInrRate;
  const gstRateBps = Math.round(file.gstRatePercent * 100);

  const categories: Category[] = file.conferenceCategories.map((c) => {
    const prices = PERIODS.map((p) => ({ periodCode: p.code, amountMinor: minor((c.prices as Record<string, number>)[p.code] ?? 0) }));
    const original = prices.find((p) => p.periodCode === period.code)?.amountMinor ?? 0;
    const isUsd = c.currency === 'USD';
    return {
      code: c.code,
      name: c.name,
      description: c.description ?? null,
      kind: c.kind as Category['kind'],
      region: c.region as Category['region'],
      requiresMembership: !!c.requiresMembership,
      currency: c.currency,
      prices,
      current: {
        periodCode: period.code,
        originalAmountMinor: original,
        chargeAmountMinor: isUsd ? usdToInrMinor(original, rate) : original,
        fxRate: isUsd ? String(rate) : null,
      },
    };
  });

  const workshops: Workshop[] = file.workshops.map((w) => {
    const capacity = (w.capacity as number | null) ?? null;
    const seatsLeft = capacity == null ? null : (status?.workshopSeatsLeft?.[w.code] ?? capacity);
    return {
      code: w.code,
      name: w.name,
      description: w.description ?? null,
      sessionLabel: w.sessionLabel ?? null,
      currency: 'INR',
      amountMinor: minor(w.fee),
      capacity,
      seatsLeft,
      soldOut: seatsLeft === 0,
    };
  });

  const accommodation: AccommodationOption[] = file.accommodation.options.map((a) => ({
    code: a.code,
    hotelName: a.hotelName,
    hotelNote: a.hotelNote ?? null,
    occupancy: a.occupancy as AccommodationOption['occupancy'],
    currency: 'INR',
    nightlyAmountMinor: minor(a.nightly),
  }));

  return {
    serverTime: status?.pricing?.serverTime ?? new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    chargeCurrency: 'INR',
    gstRateBps,
    gstRatePercent: toDisplayRate(gstRateBps),
    usdToInrRate: String(rate),
    currentPeriod: { code: period.code, label: period.label, displayRange: period.displayRange, endsAt: period.endsAt },
    periods: PERIODS,
    categories,
    workshops,
    accommodation,
    stayWindow: { start: file.accommodation.stayWindow.earliestCheckIn, end: file.accommodation.stayWindow.latestCheckOut },
  };
}
