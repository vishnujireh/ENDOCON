import { Errors } from '../../lib/errors.js';
import { convertToInrMinor, gstFor } from '../../lib/money.js';
import { catalogue, periodAt, type ConferenceCategory, type PricingPeriod } from './catalogue.js';

/**
 * THE pricing engine. Every price the platform charges is computed here, on the server,
 * from the static catalogue + server time. Nothing else in the codebase decides a price,
 * and nothing sent by the browser is trusted.
 */

export const CHARGE_CURRENCY = 'INR' as const;
export type { PricingPeriod };

export function fxRate(): string {
  return catalogue().usdToInrRate;
}

export function gstRateBps(): number {
  return catalogue().gstRateBps;
}

/** The pricing period in force at `at` (always server time). */
export function currentPeriod(at: Date): PricingPeriod {
  return periodAt(at);
}

export interface UnitPrice {
  originalCurrency: string;
  originalUnitMinor: number;
  fxRate: string | null;
  unitMinor: number; // INR paise actually charged per unit
}

/** Converts a catalogue price into the charge currency (INR). */
export function toChargeUnit(currency: string, amountMinor: number): UnitPrice {
  if (currency === CHARGE_CURRENCY) {
    return { originalCurrency: currency, originalUnitMinor: amountMinor, fxRate: null, unitMinor: amountMinor };
  }
  if (currency === 'USD') {
    const rate = fxRate();
    return { originalCurrency: 'USD', originalUnitMinor: amountMinor, fxRate: rate, unitMinor: convertToInrMinor(amountMinor, rate) };
  }
  throw new Error(`Unsupported currency ${currency}`);
}

export interface PricedAmounts {
  unitAmountMinor: number;
  quantity: number;
  amountMinor: number;
  gstRateBps: number;
  gstMinor: number;
  totalMinor: number;
}

export function priceLine(unitAmountMinor: number, quantity = 1): PricedAmounts {
  const amountMinor = unitAmountMinor * quantity;
  const rate = gstRateBps();
  const gstMinor = gstFor(amountMinor, rate);
  return { unitAmountMinor, quantity, amountMinor, gstRateBps: rate, gstMinor, totalMinor: amountMinor + gstMinor };
}

/** Conference category price (original currency, minor units) for a period. */
export function categoryPriceMinor(category: ConferenceCategory, periodCode: string): number {
  const v = category.pricesMinor[periodCode];
  if (v === undefined) throw Errors.unavailable('This registration category is not priced for the current period.', 'PRICING_UNAVAILABLE');
  return v;
}

export function gstRatePercent(): string {
  const bps = gstRateBps();
  return bps % 100 === 0 ? String(bps / 100) : (bps / 100).toFixed(2);
}
