import type { DbOrTrx } from '../../db/knex.js';
import { toIsoDate } from '../../lib/time.js';

/** What a user currently holds (purchased / complimentary, not refunded). */
export interface Entitlements {
  order: { id: number; orderNumber: string | null; status: string; confirmedAt: Date | null; createdAt: Date } | null;
  conference: {
    id: number;
    categoryCode: string;
    categoryName: string;
    region: 'national' | 'international';
    pricingPeriodCode: string | null;
    source: string;
    description: string;
    amountMinor: number;
    gstMinor: number;
    totalMinor: number;
    originalCurrency: string;
    originalUnitAmountMinor: number;
    fxRate: string | null;
    paymentId: number | null;
    createdAt: Date;
  } | null;
  workshops: {
    id: number;
    workshopCode: string;
    name: string;
    description: string;
    amountMinor: number;
    gstMinor: number;
    totalMinor: number;
    paymentId: number | null;
    createdAt: Date;
  }[];
  accommodation: {
    id: number;
    optionCode: string;
    hotelName: string;
    occupancy: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    description: string;
    unitAmountMinor: number;
    amountMinor: number;
    gstMinor: number;
    totalMinor: number;
    paymentId: number | null;
    createdAt: Date;
  } | null;
  accompanying: {
    id: number;
    title: string | null;
    fullName: string;
    categoryName: string;
    description: string;
    amountMinor: number;
    gstMinor: number;
    totalMinor: number;
    paymentId: number | null;
    createdAt: Date;
  }[];
}

export async function loadEntitlements(conn: DbOrTrx, userId: number): Promise<Entitlements> {
  const order = await conn('orders').where({ user_id: userId }).first();

  const conference = await conn('conference_registrations').where({ user_id: userId, status: 'active' }).first();

  if (!order) return { order: null, conference: null, workshops: [], accommodation: null, accompanying: [] };

  const [workshops, accommodation, accompanying] = await Promise.all([
    conn('order_workshops').where({ order_id: order.id, status: 'active' }).orderBy('id'),
    conn('order_accommodations').where({ order_id: order.id, status: 'active' }).first(),
    conn('order_accompanying_persons').where({ order_id: order.id, status: 'active' }).orderBy('id'),
  ]);

  return {
    order: {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      confirmedAt: order.confirmed_at,
      createdAt: order.created_at,
    },
    conference: conference
      ? {
          id: conference.id,
          categoryCode: conference.category_code,
          categoryName: conference.category_name,
          region: conference.region,
          pricingPeriodCode: conference.pricing_period_code,
          source: conference.source,
          description: conference.description,
          amountMinor: Number(conference.amount_minor),
          gstMinor: Number(conference.gst_minor),
          totalMinor: Number(conference.total_minor),
          originalCurrency: conference.original_currency,
          originalUnitAmountMinor: Number(conference.original_unit_amount_minor),
          fxRate: conference.fx_rate != null ? String(conference.fx_rate) : null,
          paymentId: conference.payment_id,
          createdAt: conference.created_at,
        }
      : null,
    workshops: workshops.map((w) => ({
      id: w.id,
      workshopCode: w.workshop_code,
      name: w.workshop_name,
      description: w.description,
      amountMinor: Number(w.amount_minor),
      gstMinor: Number(w.gst_minor),
      totalMinor: Number(w.total_minor),
      paymentId: w.payment_id,
      createdAt: w.created_at,
    })),
    accommodation: accommodation
      ? {
          id: accommodation.id,
          optionCode: accommodation.accommodation_code,
          hotelName: accommodation.hotel_name,
          occupancy: accommodation.occupancy,
          checkIn: toIsoDate(accommodation.check_in)!,
          checkOut: toIsoDate(accommodation.check_out)!,
          nights: accommodation.quantity,
          description: accommodation.description,
          unitAmountMinor: Number(accommodation.unit_amount_minor),
          amountMinor: Number(accommodation.amount_minor),
          gstMinor: Number(accommodation.gst_minor),
          totalMinor: Number(accommodation.total_minor),
          paymentId: accommodation.payment_id,
          createdAt: accommodation.created_at,
        }
      : null,
    accompanying: accompanying.map((p) => ({
      id: p.id,
      title: p.title,
      fullName: p.full_name,
      categoryName: p.category_name,
      description: p.description,
      amountMinor: Number(p.amount_minor),
      gstMinor: Number(p.gst_minor),
      totalMinor: Number(p.total_minor),
      paymentId: p.payment_id,
      createdAt: p.created_at,
    })),
  };
}

/** Get the user's parent order, creating it (without a number yet) if needed. */
export async function getOrCreateOrder(conn: DbOrTrx, userId: number): Promise<{ id: number; orderNumber: string | null }> {
  await conn.raw('INSERT IGNORE INTO orders (user_id, status, currency) VALUES (?, ?, ?)', [userId, 'open', 'INR']);
  const row = await conn('orders').where({ user_id: userId }).first('id', 'order_number');
  return { id: row.id, orderNumber: row.order_number };
}
