import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { Errors } from '../../lib/errors.js';

/**
 * The static registration catalogue (conference categories, pricing periods, workshops,
 * accommodation, GST rate, USD→INR rate). It lives in ONE JSON file shared with the frontend
 * (default: ../shared/catalogue.json next to this package) – there are no catalogue tables in the
 * database. The frontend uses the file for display; the backend uses it to decide every price.
 *
 * Amounts in the file are major units (₹ / US$); here they are converted to minor units (paise / cents).
 */

const PERIOD_CODES = ['early_bird', 'regular', 'on_spot'] as const;
export type PeriodCode = (typeof PERIOD_CODES)[number];

const code = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,38}$/, 'codes use lower-case letters, digits and dashes (max 40)');
const isoInstant = z.iso.datetime({ offset: true });
const amount = z.number().nonnegative().multipleOf(0.01);

const fileSchema = z
  .object({
    gstRatePercent: z.number().min(0).max(100),
    usdToInrRate: z.number().positive(),
    pricingPeriods: z
      .array(
        z.object({
          code: z.enum(PERIOD_CODES),
          label: z.string().min(1),
          displayRange: z.string().min(1),
          startsAt: isoInstant.nullable(),
          endsAt: isoInstant.nullable(),
        }),
      )
      .min(1),
    conferenceCategories: z
      .array(
        z.object({
          code,
          name: z.string().min(1).max(100),
          description: z.string().nullable().default(null),
          kind: z.enum(['delegate', 'accompanying']),
          region: z.enum(['national', 'international']),
          currency: z.enum(['INR', 'USD']),
          requiresMembership: z.boolean().default(false),
          prices: z.partialRecord(z.enum(PERIOD_CODES), amount), // every configured period is checked below
        }),
      )
      .min(1),
    workshops: z.array(
      z.object({
        code,
        name: z.string().min(1).max(200),
        description: z.string().nullable().default(null),
        sessionLabel: z.string().max(150).nullable().default(null),
        fee: amount,
        capacity: z.number().int().positive().nullable().default(null),
      }),
    ),
    accommodation: z.object({
      stayWindow: z.object({ earliestCheckIn: z.iso.date(), latestCheckOut: z.iso.date() }),
      options: z.array(
        z.object({
          code,
          hotelName: z.string().min(1).max(150),
          hotelNote: z.string().max(200).nullable().default(null),
          occupancy: z.enum(['single', 'twin_share']),
          nightly: amount,
        }),
      ),
    }),
  })
  .superRefine((c, ctx) => {
    const dupes = (list: { code: string }[], where: string) => {
      const seen = new Set<string>();
      for (const x of list) {
        if (seen.has(x.code)) ctx.addIssue({ code: 'custom', path: [where], message: `duplicate code "${x.code}"` });
        seen.add(x.code);
      }
    };
    dupes(c.pricingPeriods, 'pricingPeriods');
    dupes(c.conferenceCategories, 'conferenceCategories');
    dupes(c.workshops, 'workshops');
    dupes(c.accommodation.options, 'accommodation.options');
    for (const cat of c.conferenceCategories) {
      for (const p of c.pricingPeriods) {
        if (cat.prices[p.code] === undefined) {
          ctx.addIssue({ code: 'custom', path: ['conferenceCategories', cat.code], message: `missing price for period "${p.code}"` });
        }
      }
    }
    for (const region of ['national', 'international'] as const) {
      if (!c.conferenceCategories.some((x) => x.kind === 'accompanying' && x.region === region)) {
        ctx.addIssue({ code: 'custom', path: ['conferenceCategories'], message: `an accompanying category for region "${region}" is required` });
      }
    }
    // Periods must be in order and must not overlap or leave gaps.
    for (let i = 1; i < c.pricingPeriods.length; i++) {
      const prev = c.pricingPeriods[i - 1];
      const cur = c.pricingPeriods[i];
      if (!prev.endsAt || !cur.startsAt || Date.parse(prev.endsAt) !== Date.parse(cur.startsAt)) {
        ctx.addIssue({ code: 'custom', path: ['pricingPeriods', cur.code], message: `must start exactly when "${prev.code}" ends` });
      }
    }
    if (c.accommodation.stayWindow.earliestCheckIn >= c.accommodation.stayWindow.latestCheckOut) {
      ctx.addIssue({ code: 'custom', path: ['accommodation', 'stayWindow'], message: 'latestCheckOut must be after earliestCheckIn' });
    }
  });

const minor = (major: number) => Math.round(major * 100);

export interface PricingPeriod {
  code: PeriodCode;
  label: string;
  displayRange: string;
  startsAt: Date | null;
  endsAt: Date | null;
}
export interface ConferenceCategory {
  code: string;
  name: string;
  description: string | null;
  kind: 'delegate' | 'accompanying';
  region: 'national' | 'international';
  currency: 'INR' | 'USD';
  requiresMembership: boolean;
  /** Minor units of `currency`, per period code. */
  pricesMinor: Record<string, number>;
}
export interface Workshop {
  code: string;
  name: string;
  description: string | null;
  sessionLabel: string | null;
  currency: 'INR';
  amountMinor: number;
  capacity: number | null;
}
export interface AccommodationOption {
  code: string;
  hotelName: string;
  hotelNote: string | null;
  occupancy: 'single' | 'twin_share';
  currency: 'INR';
  nightlyAmountMinor: number;
}
export interface Catalogue {
  gstRateBps: number;
  usdToInrRate: string;
  periods: PricingPeriod[];
  categories: ConferenceCategory[];
  workshops: Workshop[];
  accommodation: AccommodationOption[];
  stayWindow: { start: string; end: string };
}

export function parseCatalogue(raw: unknown, source = 'catalogue'): Catalogue {
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`Invalid ${source}:\n${details}`);
  }
  const c = parsed.data;
  return {
    gstRateBps: Math.round(c.gstRatePercent * 100),
    usdToInrRate: String(c.usdToInrRate),
    periods: c.pricingPeriods.map((p) => ({
      code: p.code,
      label: p.label,
      displayRange: p.displayRange,
      startsAt: p.startsAt ? new Date(p.startsAt) : null,
      endsAt: p.endsAt ? new Date(p.endsAt) : null,
    })),
    categories: c.conferenceCategories.map((x) => ({
      code: x.code,
      name: x.name,
      description: x.description,
      kind: x.kind,
      region: x.region,
      currency: x.currency,
      requiresMembership: x.requiresMembership,
      pricesMinor: Object.fromEntries(Object.entries(x.prices).map(([k, v]) => [k, minor(v as number)])),
    })),
    workshops: c.workshops.map((w) => ({
      code: w.code,
      name: w.name,
      description: w.description,
      sessionLabel: w.sessionLabel,
      currency: 'INR',
      amountMinor: minor(w.fee),
      capacity: w.capacity,
    })),
    accommodation: c.accommodation.options.map((o) => ({
      code: o.code,
      hotelName: o.hotelName,
      hotelNote: o.hotelNote,
      occupancy: o.occupancy,
      currency: 'INR',
      nightlyAmountMinor: minor(o.nightly),
    })),
    stayWindow: { start: c.accommodation.stayWindow.earliestCheckIn, end: c.accommodation.stayWindow.latestCheckOut },
  };
}

/** src/modules/catalogue → package root (same depth in dist/). */
const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export function catalogueFilePath(): string {
  return env.CATALOGUE_FILE ? path.resolve(env.CATALOGUE_FILE) : path.resolve(PACKAGE_ROOT, '../shared/catalogue.json');
}

export function loadCatalogueFile(file = catalogueFilePath()): Catalogue {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`Catalogue file not found: ${file}. Set CATALOGUE_FILE or place shared/catalogue.json next to the backend folder.`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Catalogue file is not valid JSON (${file}): ${(e as Error).message}`);
  }
  return parseCatalogue(json, `catalogue file ${file}`);
}

let current: Catalogue | null = null;

/** The loaded catalogue (read once, on first use / at startup). */
export function catalogue(): Catalogue {
  if (!current) current = loadCatalogueFile();
  return current;
}

/** Tests only: replace the in-memory catalogue (pass null to reload from the file). */
export function setCatalogue(next: Catalogue | null): void {
  current = next;
}

export function findCategory(code: string): ConferenceCategory | undefined {
  return catalogue().categories.find((c) => c.code === code);
}
export function findWorkshop(code: string): Workshop | undefined {
  return catalogue().workshops.find((w) => w.code === code);
}
export function findAccommodation(code: string): AccommodationOption | undefined {
  return catalogue().accommodation.find((a) => a.code === code);
}

/** The pricing period containing `at` (server time). */
export function periodAt(at: Date): PricingPeriod {
  const t = at.getTime();
  const p = catalogue().periods.find((x) => (!x.startsAt || x.startsAt.getTime() <= t) && (!x.endsAt || t < x.endsAt.getTime()));
  if (!p) throw Errors.unavailable('Registration pricing is not configured for the current date.', 'PRICING_UNAVAILABLE');
  return p;
}
