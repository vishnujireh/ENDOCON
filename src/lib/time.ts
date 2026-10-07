import { env } from '../config/env.js';

/**
 * Server clock. Pricing must never depend on the browser clock.
 * In non-production environments PRICING_NOW_OVERRIDE can pin "now" for QA.
 * Tests can also replace the clock via setClock().
 */
let clock: () => Date = () => new Date();
let pricingClock: (() => Date) | null = null;

export function now(): Date {
  return clock();
}

/** The instant used to pick the pricing period. */
export function pricingNow(): Date {
  if (!env.isProduction && env.PRICING_NOW_OVERRIDE) return new Date(env.PRICING_NOW_OVERRIDE);
  return pricingClock ? pricingClock() : clock();
}

export function setClock(fn: () => Date): void {
  clock = fn;
}

/** Tests only: move the pricing date without affecting sessions, tokens or queues. */
export function setPricingClock(fn: (() => Date) | null): void {
  pricingClock = fn;
}

export function resetClock(): void {
  clock = () => new Date();
  pricingClock = null;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

export function addHours(d: Date, hours: number): Date {
  return addMinutes(d, hours * 60);
}

/** YYYY-MM-DD of an instant in the event timezone. */
export function dateInEventTz(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: env.EVENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** "23 Sep 2026, 11:05 PM" in the event timezone. */
export function formatEventDateTime(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: env.EVENT_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatEventDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: typeof d === 'string' && d.length === 10 ? 'UTC' : env.EVENT_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Whole nights between two ISO dates (YYYY-MM-DD). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Indian financial year label for an instant, e.g. 2026-27. */
export function financialYear(d: Date): string {
  const ymd = dateInEventTz(d);
  const [y, m] = ymd.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Normalise a DB DATE value (Date or string) to YYYY-MM-DD. */
export function toIsoDate(v: Date | string | null): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}
