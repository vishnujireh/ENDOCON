import { z } from 'zod';
import type { DbOrTrx } from '../../db/knex.js';
import { sha256Hex } from '../../lib/crypto.js';
import { Errors } from '../../lib/errors.js';
import { formatMoney, sumMinor } from '../../lib/money.js';
import { formatEventDate, nightsBetween, pricingNow } from '../../lib/time.js';
import { catalogue, findAccommodation, findCategory, findWorkshop } from '../catalogue/catalogue.js';
import { workshopSeatsTaken } from '../catalogue/catalogue.service.js';
import {
  CHARGE_CURRENCY,
  categoryPriceMinor,
  currentPeriod,
  gstRateBps,
  priceLine,
  toChargeUnit,
  type PricedAmounts,
} from '../catalogue/pricing.service.js';
import { getProfileRow } from '../profile/profile.service.js';
import { loadEntitlements } from './entitlements.repository.js';

/**
 * Cart = what the user wants to buy NOW. Only catalogue codes / choices come from the client;
 * everything else (eligibility, availability, price, GST, totals) is decided here from the
 * static catalogue and server time.
 */
const catalogueCode = z.string().trim().min(1).max(40);
export const cartSchema = z.object({
  conferenceCategoryCode: catalogueCode.nullable().optional(),
  workshopCodes: z.array(catalogueCode).max(20).default([]),
  accommodation: z
    .object({
      optionCode: catalogueCode,
      checkIn: z.iso.date({ message: 'Select a check-in date.' }),
      checkOut: z.iso.date({ message: 'Select a check-out date.' }),
    })
    .nullable()
    .optional(),
  accompanyingPersons: z
    .array(
      z.object({
        title: z.string().trim().max(10).optional().nullable(),
        fullName: z.string().trim().min(2, 'Enter the accompanying person’s full name.').max(150),
      }),
    )
    .max(10, 'A maximum of 10 accompanying persons can be added at a time.')
    .default([]),
});

export type CartInput = z.infer<typeof cartSchema>;

export interface PricedLine extends PricedAmounts {
  itemType: 'conference' | 'workshop' | 'accommodation' | 'accompanying';
  /** Catalogue code of what is bought + a name snapshot for history / invoices. */
  itemCode: string;
  itemName: string;
  region: 'national' | 'international' | null;
  occupancy: 'single' | 'twin_share' | null;
  checkIn: string | null;
  checkOut: string | null;
  guestTitle: string | null;
  guestName: string | null;
  description: string;
  pricingPeriodCode: string | null;
  originalCurrency: string;
  originalUnitAmountMinor: number;
  fxRate: string | null;
}

export interface PricedCart {
  purpose: 'registration' | 'add_on';
  currency: typeof CHARGE_CURRENCY;
  pricingPeriod: { code: string; label: string; displayRange: string };
  lines: PricedLine[];
  subtotalMinor: number;
  gstMinor: number;
  totalMinor: number;
  gstRateBps: number;
  cartHash: string;
}

const OCCUPANCY_LABEL: Record<string, string> = { single: 'Single Occupancy', twin_share: 'Twin Share' };

function fxNote(originalCurrency: string, originalMinor: number, rate: string | null): string {
  return rate ? ` [${formatMoney(originalMinor, originalCurrency)} @ ₹${rate}/USD]` : '';
}

/**
 * Validate a cart for a user and price it. Pass a transaction to run the same checks
 * atomically at checkout time.
 */
export async function priceCart(conn: DbOrTrx, userId: number, cart: CartInput): Promise<PricedCart> {
  const profile = await getProfileRow(conn, userId);
  if (!profile?.completed_at) {
    throw Errors.conflict('Please complete your personal details (Step 1) first.', 'PROFILE_INCOMPLETE');
  }

  const held = await loadEntitlements(conn, userId);
  const period = currentPeriod(pricingNow());
  const lines: PricedLine[] = [];

  const empty = {
    region: null,
    occupancy: null,
    checkIn: null,
    checkOut: null,
    guestTitle: null,
    guestName: null,
    pricingPeriodCode: null,
    fxRate: null,
  };

  // ---- Conference (one per user, ever) ----
  let delegateRegion: 'national' | 'international' | null = held.conference?.region ?? null;
  if (cart.conferenceCategoryCode) {
    if (held.conference) {
      throw Errors.conflict('You have already purchased a conference registration.', 'CONFERENCE_ALREADY_PURCHASED');
    }
    // Refunded / cancelled registrations are re-instated by the organising team, not re-bought online.
    if (await conn('conference_registrations').where({ user_id: userId }).first('id')) {
      throw Errors.conflict('Your earlier conference registration was refunded or cancelled. Please contact the organising team.', 'ITEM_REFUNDED');
    }
    const cat = findCategory(cart.conferenceCategoryCode);
    if (!cat || cat.kind !== 'delegate') throw Errors.badRequest('Please select a valid registration category.', 'INVALID_CATEGORY');
    if (cat.requiresMembership && (profile.membership_type !== 'sgei_member' || !profile.membership_no)) {
      throw Errors.conflict(
        'The SGEI Member category requires SGEI membership details in your personal details (Step 1).',
        'MEMBERSHIP_REQUIRED',
      );
    }
    const original = categoryPriceMinor(cat, period.code);
    const unit = toChargeUnit(cat.currency, original);
    lines.push({
      ...empty,
      itemType: 'conference',
      itemCode: cat.code,
      itemName: cat.name,
      region: cat.region,
      description: `Conference Registration – ${cat.name} (${period.label})${fxNote(cat.currency, original, unit.fxRate)}`,
      pricingPeriodCode: period.code,
      originalCurrency: unit.originalCurrency,
      originalUnitAmountMinor: unit.originalUnitMinor,
      fxRate: unit.fxRate,
      ...priceLine(unit.unitMinor),
    });
    delegateRegion = cat.region;
  }

  const hasConference = !!held.conference || !!cart.conferenceCategoryCode;
  const wantsAddOns = cart.workshopCodes.length > 0 || !!cart.accommodation || cart.accompanyingPersons.length > 0;
  if (wantsAddOns && !hasConference) {
    throw Errors.conflict('Please select a conference registration before adding workshops or accommodation.', 'CONFERENCE_REQUIRED');
  }

  // ---- Workshops (many, each at most once) ----
  if (cart.workshopCodes.length) {
    if (new Set(cart.workshopCodes).size !== cart.workshopCodes.length) {
      throw Errors.badRequest('The same workshop cannot be selected twice.', 'DUPLICATE_WORKSHOP');
    }
    const heldCodes = new Set(held.workshops.map((w) => w.workshopCode));
    const already = cart.workshopCodes.filter((c) => heldCodes.has(c));
    if (already.length) {
      throw Errors.conflict('You have already purchased one or more of the selected workshops.', 'WORKSHOP_ALREADY_PURCHASED', { workshopCodes: already });
    }
    if (held.order) {
      const refunded = await conn('order_workshops').where({ order_id: held.order.id }).whereIn('workshop_code', cart.workshopCodes).whereNot({ status: 'active' }).first('id');
      if (refunded) throw Errors.conflict('A selected workshop was refunded earlier. Please contact the organising team.', 'ITEM_REFUNDED');
    }
    const rows = cart.workshopCodes.map((c) => findWorkshop(c));
    if (rows.some((w) => !w)) throw Errors.badRequest('One or more selected workshops are not available.', 'INVALID_WORKSHOP');
    const taken = await workshopSeatsTaken(conn, cart.workshopCodes);
    for (const w of rows as NonNullable<(typeof rows)[number]>[]) {
      if (w.capacity != null && (taken.get(w.code) ?? 0) >= w.capacity) {
        throw Errors.conflict(`"${w.name}" is fully booked.`, 'WORKSHOP_FULL', { workshopCode: w.code });
      }
      const unit = toChargeUnit(w.currency, w.amountMinor);
      lines.push({
        ...empty,
        itemType: 'workshop',
        itemCode: w.code,
        itemName: w.name,
        description: `Workshop – ${w.name}${fxNote(w.currency, w.amountMinor, unit.fxRate)}`,
        originalCurrency: unit.originalCurrency,
        originalUnitAmountMinor: unit.originalUnitMinor,
        fxRate: unit.fxRate,
        ...priceLine(unit.unitMinor),
      });
    }
  }

  // ---- Accommodation (one booking per user) ----
  if (cart.accommodation) {
    if (held.accommodation) {
      throw Errors.conflict('You have already booked accommodation.', 'ACCOMMODATION_ALREADY_PURCHASED');
    }
    if (held.order && (await conn('order_accommodations').where({ order_id: held.order.id }).first('id'))) {
      throw Errors.conflict('Your earlier accommodation booking was refunded or cancelled. Please contact the organising team.', 'ITEM_REFUNDED');
    }
    const { optionCode, checkIn, checkOut } = cart.accommodation;
    const opt = findAccommodation(optionCode);
    if (!opt) throw Errors.badRequest('Please select a valid accommodation option.', 'INVALID_ACCOMMODATION');
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) throw Errors.validation({ 'accommodation.checkOut': 'Check-out must be after check-in.' });
    const stay = catalogue().stayWindow;
    if (checkIn < stay.start || checkOut > stay.end) {
      throw Errors.validation({
        'accommodation.checkIn': `Stay dates must be between ${formatEventDate(stay.start)} and ${formatEventDate(stay.end)}.`,
      });
    }
    const unit = toChargeUnit(opt.currency, opt.nightlyAmountMinor);
    lines.push({
      ...empty,
      itemType: 'accommodation',
      itemCode: opt.code,
      itemName: opt.hotelName,
      occupancy: opt.occupancy,
      checkIn,
      checkOut,
      description: `Accommodation – ${opt.hotelName}, ${OCCUPANCY_LABEL[opt.occupancy] ?? opt.occupancy} (${formatEventDate(checkIn)} to ${formatEventDate(checkOut)}, ${nights} night${nights > 1 ? 's' : ''} × ${formatMoney(unit.unitMinor, 'INR')})`,
      originalCurrency: unit.originalCurrency,
      originalUnitAmountMinor: unit.originalUnitMinor,
      fxRate: unit.fxRate,
      ...priceLine(unit.unitMinor, nights),
    });
  }

  // ---- Accompanying persons (category follows the delegate's region) ----
  if (cart.accompanyingPersons.length) {
    const region = delegateRegion ?? 'national';
    const cat = catalogue().categories.find((c) => c.kind === 'accompanying' && c.region === region);
    if (!cat) throw Errors.unavailable('Accompanying registration is currently unavailable.', 'CATEGORY_UNAVAILABLE');
    const original = categoryPriceMinor(cat, period.code);
    const unit = toChargeUnit(cat.currency, original);
    for (const person of cart.accompanyingPersons) {
      const title = person.title?.trim() || null;
      lines.push({
        ...empty,
        itemType: 'accompanying',
        itemCode: cat.code,
        itemName: cat.name,
        region: cat.region,
        guestTitle: title,
        guestName: person.fullName,
        description: `${cat.name} – ${[title, person.fullName].filter(Boolean).join(' ')} (${period.label})${fxNote(cat.currency, original, unit.fxRate)}`,
        pricingPeriodCode: period.code,
        originalCurrency: unit.originalCurrency,
        originalUnitAmountMinor: unit.originalUnitMinor,
        fxRate: unit.fxRate,
        ...priceLine(unit.unitMinor),
      });
    }
  }

  if (!lines.length) throw Errors.badRequest('Please select at least one item to purchase.', 'EMPTY_CART');

  const subtotalMinor = sumMinor(lines.map((l) => l.amountMinor));
  const gstMinor = sumMinor(lines.map((l) => l.gstMinor));
  const totalMinor = subtotalMinor + gstMinor;

  const cartHash = sha256Hex(
    JSON.stringify(
      lines.map((l) => [l.itemType, l.itemCode, l.checkIn, l.checkOut, l.guestTitle, l.guestName, l.unitAmountMinor, l.quantity, l.totalMinor]),
    ),
  );

  return {
    purpose: cart.conferenceCategoryCode ? 'registration' : 'add_on',
    currency: CHARGE_CURRENCY,
    pricingPeriod: { code: period.code, label: period.label, displayRange: period.displayRange },
    lines,
    subtotalMinor,
    gstMinor,
    totalMinor,
    gstRateBps: gstRateBps(),
    cartHash,
  };
}

/** Client-facing shape of a priced cart. */
export function toQuoteDto(c: PricedCart) {
  return {
    purpose: c.purpose,
    currency: c.currency,
    pricingPeriod: c.pricingPeriod,
    gstRateBps: c.gstRateBps,
    lines: c.lines.map((l) => ({
      itemType: l.itemType,
      description: l.description,
      itemCode: l.itemCode,
      checkIn: l.checkIn,
      checkOut: l.checkOut,
      guestName: l.guestName,
      unitAmountMinor: l.unitAmountMinor,
      quantity: l.quantity,
      amountMinor: l.amountMinor,
      gstMinor: l.gstMinor,
      totalMinor: l.totalMinor,
      originalCurrency: l.originalCurrency,
      originalUnitAmountMinor: l.originalUnitAmountMinor,
      fxRate: l.fxRate,
    })),
    subtotalMinor: c.subtotalMinor,
    gstMinor: c.gstMinor,
    totalMinor: c.totalMinor,
  };
}
