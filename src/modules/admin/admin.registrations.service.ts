import { catalogue } from '../catalogue/catalogue.js';
import { workshopSeatsTaken } from '../catalogue/catalogue.service.js';
import type { Request } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { audit } from '../../lib/audit.js';
import { toCsv } from '../../lib/csv.js';
import { Errors } from '../../lib/errors.js';
import { minorToDecimalString } from '../../lib/money.js';
import { formatEventDateTime, now } from '../../lib/time.js';
import { enqueueEmail } from '../email/outbox.js';
import { buildPaymentEmailPayload } from '../payments/payment-notifications.js';
import { getProfileRow, profileInputToColumns, toProfileDto } from '../profile/profile.service.js';
import { profileSchema } from '../profile/profile.schemas.js';
import { loadEntitlements } from '../registration/entitlements.repository.js';

// ---------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------

export const registrationFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  paymentStatus: z.enum(['paid', 'pending', 'refunded', 'attention']).optional(),
  categoryCode: z.string().trim().max(40).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  profile: z.enum(['complete', 'incomplete']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.enum(['date_desc', 'date_asc', 'name_asc', 'order_asc', 'order_desc']).default('date_desc'),
});
export type RegistrationFilters = z.infer<typeof registrationFiltersSchema>;

/** IST day boundaries -> UTC instants. */
function istDayStart(d: string): Date {
  return new Date(`${d}T00:00:00+05:30`);
}
function istDayEnd(d: string): Date {
  return new Date(`${d}T23:59:59.999+05:30`);
}

function baseQuery(f: RegistrationFilters): Knex.QueryBuilder {
  const q = db('users as u')
    .leftJoin('user_profiles as p', 'p.user_id', 'u.id')
    .leftJoin('orders as o', 'o.user_id', 'u.id')
    .leftJoin('conference_registrations as cr', function () {
      this.on('cr.user_id', '=', 'u.id');
    })
    .where('u.role', 'participant');

  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    q.where((w) =>
      w
        .where('p.full_name', 'like', like)
        .orWhere('u.email', 'like', like)
        .orWhere('p.phone_number', 'like', like)
        .orWhere('o.order_number', 'like', like)
        .orWhere('p.organization', 'like', like),
    );
  }
  if (f.paymentStatus === 'paid') q.where('cr.status', 'active');
  if (f.paymentStatus === 'pending') q.whereNull('cr.id');
  if (f.paymentStatus === 'refunded') q.where('cr.status', 'refunded');
  if (f.paymentStatus === 'attention') {
    q.whereExists(db('payments as px').whereRaw('px.user_id = u.id').where('px.status', 'conflict'));
  }
  if (f.categoryCode) q.where('cr.category_code', f.categoryCode);
  if (f.from) q.where('u.created_at', '>=', istDayStart(f.from));
  if (f.to) q.where('u.created_at', '<=', istDayEnd(f.to));
  if (f.profile === 'complete') q.whereNotNull('p.completed_at');
  if (f.profile === 'incomplete') q.whereNull('p.completed_at');
  return q;
}

const PAID_TOTAL = `(SELECT COALESCE(SUM(py.total_minor - py.refunded_minor),0) FROM payments py WHERE py.user_id = u.id AND py.status IN ('success','partially_refunded'))`;

function statusLabel(r: { cr_status: string | null; conflicts: number }): string {
  if (r.cr_status === 'active') return 'Paid';
  if (r.cr_status === 'refunded') return 'Refunded';
  return 'Pending';
}

export async function listRegistrations(f: RegistrationFilters) {
  const q = baseQuery(f);
  const countRow = await q.clone().clearSelect().countDistinct({ n: 'u.id' }).first();
  const total = Number(countRow?.n ?? 0);

  const sortMap: Record<RegistrationFilters['sort'], [string, 'asc' | 'desc']> = {
    date_desc: ['u.created_at', 'desc'],
    date_asc: ['u.created_at', 'asc'],
    name_asc: ['p.full_name', 'asc'],
    order_asc: ['o.order_number', 'asc'],
    order_desc: ['o.order_number', 'desc'],
  };
  const [col, dir] = sortMap[f.sort];

  const rows: Record<string, any>[] = await q
    .clone()
    .select(
      'u.id as user_id',
      'u.email',
      'u.created_at as registered_at',
      'p.title',
      'p.full_name',
      'p.phone_country_code',
      'p.phone_number',
      'p.organization',
      'p.completed_at',
      'o.order_number',
      'o.confirmed_at',
      'cr.status as cr_status',
      'cr.category_name',
      db.raw(`${PAID_TOTAL} as paid_total_minor`),
      db.raw(`(SELECT COUNT(*) FROM payments pc WHERE pc.user_id = u.id AND pc.status = 'conflict') as conflicts`),
    )
    .orderBy(col, dir)
    .orderBy('u.id', 'desc')
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);

  return {
    total,
    page: f.page,
    pageSize: f.pageSize,
    rows: rows.map((r, i) => ({
      slNo: (f.page - 1) * f.pageSize + i + 1,
      userId: r.user_id,
      orderNumber: r.order_number,
      name: [r.title, r.full_name].filter(Boolean).join(' '),
      email: r.email,
      phone: r.phone_number ? `${r.phone_country_code ?? ''} ${r.phone_number}`.trim() : null,
      organization: r.organization,
      conference: r.category_name,
      paymentStatus: statusLabel({ cr_status: r.cr_status, conflicts: Number(r.conflicts) }),
      needsAttention: Number(r.conflicts) > 0,
      profileComplete: !!r.completed_at,
      paidTotalMinor: Number(r.paid_total_minor),
      registeredAt: r.registered_at,
      confirmedAt: r.confirmed_at,
    })),
  };
}

export async function getStats() {
  const participants = await db('users').where({ role: 'participant' }).count({ n: '*' }).first();
  const paid = await db('conference_registrations').where({ status: 'active' }).count({ n: '*' }).first();
  const revenue = await db('payments').whereIn('status', ['success', 'partially_refunded']).sum({ total: db.raw('total_minor - refunded_minor') }).first();
  const attention = await db('payments').where({ status: 'conflict' }).count({ n: '*' }).first();
  const byCategory: Record<string, any>[] = await db('conference_registrations')
    .where('status', 'active')
    .groupBy('category_code', 'category_name')
    .select('category_code', 'category_name')
    .count({ n: '*' });
  const sold = await workshopSeatsTaken(db);
  const abstracts = await db('abstracts').count({ n: '*' }).first();
  const abstractsToReview = await db('abstracts').whereIn('status', ['submitted', 'resubmitted']).count({ n: '*' }).first();
  const total = Number(participants?.n ?? 0);
  const paidN = Number(paid?.n ?? 0);
  return {
    registrations: { total, paid: paidN, pending: total - paidN },
    revenueMinor: Number(revenue?.total ?? 0),
    paymentsNeedingAttention: Number(attention?.n ?? 0),
    byCategory: byCategory.map((c) => ({ code: c.category_code, name: c.category_name, count: Number(c.n) })),
    workshops: catalogue().workshops.map((w) => ({ code: w.code, name: w.name, capacity: w.capacity, sold: sold.get(w.code) ?? 0 })),
    abstractsSubmitted: Number(abstracts?.n ?? 0),
    abstractsNeedingReview: Number(abstractsToReview?.n ?? 0),
  };
}

// ---------------------------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------------------------

export async function getRegistrationDetail(userId: number) {
  const user = await db('users').where({ id: userId, role: 'participant' }).first('id', 'email', 'status', 'created_at', 'last_login_at');
  if (!user) throw Errors.notFound('Registration not found.');
  const profile = await getProfileRow(db, userId);
  const held = await loadEntitlements(db, userId);

  // Every payment attempt, including failed/cancelled, for a full financial history.
  const payments = await db('payments as p')
    .leftJoin('invoices as i', 'i.payment_id', 'p.id')
    .where('p.user_id', userId)
    .orderBy('p.id')
    .select('p.*', 'i.id as invoice_id', 'i.invoice_number');
  const items = payments.length ? await db('payment_items').whereIn('payment_id', payments.map((p) => p.id)).orderBy('id') : [];
  const auditRows = await db('audit_logs as a')
    .leftJoin('users as u', 'u.id', 'a.actor_user_id')
    .where((w) => w.where({ entity_type: 'registration', entity_id: String(userId) }).orWhere((x) => x.where('entity_type', 'payment').whereIn('entity_id', payments.map((p) => String(p.id)))))
    .orderBy('a.id', 'desc')
    .limit(100)
    .select('a.id', 'a.action', 'a.entity_type', 'a.entity_id', 'a.before', 'a.after', 'a.created_at', 'u.email as actor_email');
  const emails = await db('email_outbox')
    .where((w) => w.where({ related_type: 'payment' }).whereIn('related_id', payments.map((p) => String(p.id))))
    .orWhere({ related_type: 'user', related_id: String(userId) })
    .orderBy('id', 'desc')
    .limit(50)
    .select('id', 'to_email', 'template', 'status', 'attempts', 'last_error', 'sent_at', 'created_at');

  const successful = payments.filter((p) => ['success', 'partially_refunded', 'refunded'].includes(p.status));

  return {
    user: { id: user.id, email: user.email, status: user.status, registeredAt: user.created_at, lastLoginAt: user.last_login_at },
    profile: profile ? toProfileDto(profile) : null,
    order: held.order,
    conference: held.conference,
    workshops: held.workshops,
    accommodation: held.accommodation,
    accompanying: held.accompanying,
    payments: payments.map((p) => ({
      id: p.id,
      status: p.status,
      purpose: p.purpose,
      gateway: p.gateway,
      gatewayOrderId: p.gateway_order_id,
      gatewayPaymentId: p.gateway_payment_id,
      method: p.method,
      subtotalMinor: Number(p.subtotal_minor),
      gstMinor: Number(p.gst_minor),
      totalMinor: Number(p.total_minor),
      refundedMinor: Number(p.refunded_minor),
      failureReason: p.failure_reason,
      paidAt: p.paid_at,
      createdAt: p.created_at,
      invoice: p.invoice_id ? { id: p.invoice_id, number: p.invoice_number } : null,
      items: items
        .filter((i) => i.payment_id === p.id)
        .map((i) => ({
          itemType: i.item_type,
          description: i.description,
          pricingPeriodCode: i.pricing_period_code,
          quantity: i.quantity,
          unitAmountMinor: Number(i.unit_amount_minor),
          amountMinor: Number(i.amount_minor),
          gstMinor: Number(i.gst_minor),
          totalMinor: Number(i.total_minor),
        })),
    })),
    totals: {
      subtotalMinor: successful.reduce((a, p) => a + Number(p.subtotal_minor), 0),
      gstMinor: successful.reduce((a, p) => a + Number(p.gst_minor), 0),
      totalPaidMinor: successful.reduce((a, p) => a + Number(p.total_minor), 0),
      refundedMinor: successful.reduce((a, p) => a + Number(p.refunded_minor), 0),
    },
    emails,
    audit: auditRows.map((a) => ({
      ...a,
      before: typeof a.before === 'string' ? JSON.parse(a.before) : a.before,
      after: typeof a.after === 'string' ? JSON.parse(a.after) : a.after,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Edit (participant details only – financial fields are never editable here)
// ---------------------------------------------------------------------------------------------

/**
 * Admin edit of a participant's Step 1 details. Only the fields sent are changed; the result is
 * validated with the SAME rules as the participant's own form (all mandatory fields, 6-digit pin
 * code for India, membership number for SGEI members), so an admin cannot save an incomplete record.
 * Email, payments and purchased items are not editable here.
 */
const text = z.union([z.string(), z.null()]).optional();
export const adminProfileEditSchema = z
  .object({
    title: text,
    fullName: text,
    age: z.union([z.number(), z.string(), z.null()]).optional(),
    gender: text,
    designation: text,
    organization: text,
    mciStateCode: text,
    mciRegNo: text,
    membershipType: text,
    membershipNo: text,
    phoneCountryCode: text,
    phoneNumber: text,
    address: text,
    city: text,
    state: text,
    country: text,
    pinCode: text,
    reason: z.string().trim().min(3, 'Enter a reason for the change (kept in the audit log).').max(300),
  })
  .strict();

export async function editRegistrationProfile(adminId: number, userId: number, input: z.infer<typeof adminProfileEditSchema>, req: Request) {
  const { reason, ...changes } = input;
  await db.transaction(async (trx) => {
    await trx('user_profiles').where({ user_id: userId }).forUpdate().first('user_id'); // lock, then read
    const row = await getProfileRow(trx, userId);
    if (!row) throw Errors.notFound('Registration not found.');
    const current = toProfileDto(row);

    // Current details + the admin's changes, checked like the participant's own Step 1 form.
    const merged: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(changes)) if (v !== undefined) merged[k] = v;
    const parsed = profileSchema.safeParse(merged);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_';
        if (!fields[key]) fields[key] = issue.message;
      }
      throw Errors.validation(fields);
    }

    const cols = profileInputToColumns(parsed.data);
    const hasConference = await trx('conference_registrations').where({ user_id: userId }).first('id');
    if (hasConference && row.membership_type && row.membership_type !== cols.membership_type) {
      throw Errors.validation({ membershipType: 'Membership type cannot be changed after the conference registration has been paid (it decided the price).' });
    }

    const update: Record<string, unknown> = {};
    const beforeDiff: Record<string, unknown> = {};
    for (const [col, v] of Object.entries(cols)) {
      const before = (row as unknown as Record<string, unknown>)[col] ?? null;
      if ((before ?? null) !== (v ?? null)) {
        update[col] = v;
        beforeDiff[col] = before;
      }
    }
    if (!row.completed_at) update.completed_at = now(); // the record is now complete
    if (!Object.keys(update).length) return;
    await trx('user_profiles').where({ user_id: userId }).update(update);
    const { completed_at: _c, ...afterDiff } = update;
    void _c;
    await audit(trx, { actorUserId: adminId, action: 'registration.profile_edited', entityType: 'registration', entityId: userId, before: beforeDiff, after: { ...afterDiff, reason }, req });
  });
  return getRegistrationDetail(userId);
}

// ---------------------------------------------------------------------------------------------
// Resend confirmation
// ---------------------------------------------------------------------------------------------

export async function resendConfirmation(adminId: number, userId: number, paymentId: number | undefined, req: Request) {
  const q = db('payments').where({ user_id: userId }).whereIn('status', ['success', 'partially_refunded']);
  if (paymentId) q.where({ id: paymentId });
  const payment = await q.orderBy('id', 'desc').first('id');
  if (!payment) throw Errors.conflict('There is no successful payment to confirm for this participant.', 'NO_SUCCESSFUL_PAYMENT');
  await db.transaction(async (trx) => {
    const payload = { ...(await buildPaymentEmailPayload(trx, payment.id)), isResend: true };
    await enqueueEmail(trx, payload.email, 'registration_confirmation', payload, { related: { type: 'payment', id: payment.id } });
    await audit(trx, { actorUserId: adminId, action: 'registration.confirmation_resent', entityType: 'registration', entityId: userId, after: { paymentId: payment.id }, req });
  });
  return { paymentId: payment.id, queuedAt: now().toISOString() };
}

// ---------------------------------------------------------------------------------------------
// CSV export (server-side, all rows matching the filters – not just the visible page)
// ---------------------------------------------------------------------------------------------

export async function exportRegistrationsCsv(f: RegistrationFilters): Promise<string> {
  const rows: Record<string, any>[] = await baseQuery(f)
    .select(
      'u.id as user_id',
      'u.email',
      'u.created_at as registered_at',
      'p.*',
      'o.id as order_id',
      'o.order_number',
      'o.confirmed_at',
      'cr.status as cr_status',
      'cr.pricing_period_code',
      'cr.category_name',
    )
    .orderBy('u.created_at', 'asc');

  const orderIds = rows.map((r) => r.order_id).filter(Boolean);
  const userIds = rows.map((r) => r.user_id);
  const [workshops, accommodations, accompanying, payments] = await Promise.all([
    orderIds.length ? db('order_workshops').whereIn('order_id', orderIds).where('status', 'active').select('order_id', 'workshop_name as name') : [],
    orderIds.length ? db('order_accommodations').whereIn('order_id', orderIds).where('status', 'active').select('order_id', 'description') : [],
    orderIds.length ? db('order_accompanying_persons').whereIn('order_id', orderIds).where('status', 'active').select('order_id', 'title', 'full_name') : [],
    userIds.length ? db('payments').whereIn('user_id', userIds).whereIn('status', ['success', 'partially_refunded', 'refunded']).select('user_id', 'gateway_payment_id', 'subtotal_minor', 'gst_minor', 'total_minor', 'refunded_minor') : [],
  ]);

  const header = [
    'Order ID', 'Title', 'Name', 'Email', 'Phone', 'Gender', 'Age', 'Designation', 'Organization / Hospital',
    'Medical Council State Code', 'Medical Council Reg. No.', 'Membership', 'Membership No.',
    'Address', 'City', 'State', 'Country', 'Pin Code',
    'Conference', 'Pricing Period', 'Workshops', 'Accommodation', 'Accompanying Persons',
    'Payment Status', 'Subtotal (INR)', 'GST (INR)', 'Total (INR)', 'Refunded (INR)', 'Payment IDs',
    'Account Created', 'Registration Confirmed',
  ];
  const data = rows.map((r) => {
    const pays = payments.filter((p) => p.user_id === r.user_id);
    return [
      r.order_number,
      r.title,
      r.full_name,
      r.email,
      r.phone_number ? `${r.phone_country_code ?? ''} ${r.phone_number}`.trim() : '',
      r.gender,
      r.age,
      r.designation,
      r.organization,
      r.mci_state_code,
      r.mci_reg_no,
      r.membership_type === 'sgei_member' ? 'SGEI Member' : r.membership_type === 'non_member' ? 'Non-Member' : '',
      r.membership_no,
      r.address,
      r.city,
      r.state,
      r.country,
      r.pin_code,
      r.category_name,
      r.pricing_period_code,
      workshops.filter((w) => w.order_id === r.order_id).map((w) => w.name).join('; '),
      accommodations.filter((a) => a.order_id === r.order_id).map((a) => a.description.replace(/^Accommodation – /, '')).join('; '),
      accompanying.filter((a) => a.order_id === r.order_id).map((a) => [a.title, a.full_name].filter(Boolean).join(' ')).join('; '),
      statusLabel({ cr_status: r.cr_status, conflicts: 0 }),
      minorToDecimalString(pays.reduce((a, p) => a + Number(p.subtotal_minor), 0)),
      minorToDecimalString(pays.reduce((a, p) => a + Number(p.gst_minor), 0)),
      minorToDecimalString(pays.reduce((a, p) => a + Number(p.total_minor), 0)),
      minorToDecimalString(pays.reduce((a, p) => a + Number(p.refunded_minor), 0)),
      pays.map((p) => p.gateway_payment_id).filter(Boolean).join('; '),
      formatEventDateTime(r.registered_at),
      formatEventDateTime(r.confirmed_at),
    ];
  });
  return toCsv(header, data);
}
