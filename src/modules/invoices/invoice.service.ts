import { env } from '../../config/env.js';
import { db, type Trx } from '../../db/knex.js';
import { Errors } from '../../lib/errors.js';
import { nextSequenceValue, pad } from '../../lib/sequences.js';
import { financialYear, now } from '../../lib/time.js';
import { getStorage } from '../storage/storage.js';
import { renderInvoicePdf } from './invoice.renderer.js';

export interface InvoiceLine {
  description: string;
  sac: string;
  quantity: number;
  unitAmountMinor: number;
  amountMinor: number;
  gstRateBps: number;
  gstMinor: number;
  totalMinor: number;
}

export interface BilledTo {
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pinCode: string | null;
  orderNumber: string;
}

/**
 * Create the invoice record for a settled payment (inside the settlement transaction), so the
 * invoice number is allocated gap-free and only for verified payments. The PDF is rendered
 * later (lazily / by the email worker) from this immutable snapshot.
 */
export async function createInvoiceForPayment(trx: Trx, paymentId: number, orderNumber: string): Promise<number> {
  const existing = await trx('invoices').where({ payment_id: paymentId }).first('id');
  if (existing) return existing.id;

  const payment = await trx('payments').where({ id: paymentId }).first();
  const items = await trx('payment_items').where({ payment_id: paymentId }).orderBy('id');
  const profile = await trx('user_profiles as p').join('users as u', 'u.id', 'p.user_id').where('p.user_id', payment.user_id).first('p.*', 'u.email');

  const issuedAt = payment.paid_at ? new Date(payment.paid_at) : now();
  const fy = financialYear(issuedAt);
  const seq = await nextSequenceValue(trx, `invoice:${fy}`);
  const invoiceNumber = `${env.INVOICE_NUMBER_PREFIX}/${fy}/${pad(seq, 5)}`;

  const lines: InvoiceLine[] = items.map((i) => ({
    description: i.description,
    sac: env.ORG_SAC_CODE,
    quantity: i.quantity,
    unitAmountMinor: Number(i.unit_amount_minor),
    amountMinor: Number(i.amount_minor),
    gstRateBps: i.gst_rate_bps,
    gstMinor: Number(i.gst_minor),
    totalMinor: Number(i.total_minor),
  }));

  // Place of supply for event admission / accommodation is the event location (West Bengal),
  // so GST is split into CGST + SGST. Confirm with the organisers' tax advisor.
  const gst = Number(payment.gst_minor);
  const cgst = Math.floor(gst / 2);
  const sgst = gst - cgst;

  const billedTo: BilledTo = {
    name: [profile?.title, profile?.full_name].filter(Boolean).join(' '),
    email: profile?.email,
    phone: profile?.phone_number ? `${profile.phone_country_code ?? ''} ${profile.phone_number}`.trim() : null,
    organization: profile?.organization ?? null,
    address: profile?.address ?? null,
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    country: profile?.country ?? null,
    pinCode: profile?.pin_code ?? null,
    orderNumber,
  };

  const [id] = await trx('invoices').insert({
    invoice_number: invoiceNumber,
    financial_year: fy,
    payment_id: paymentId,
    order_id: payment.order_id,
    user_id: payment.user_id,
    billed_to: JSON.stringify(billedTo),
    lines: JSON.stringify(lines),
    subtotal_minor: payment.subtotal_minor,
    cgst_minor: cgst,
    sgst_minor: sgst,
    igst_minor: 0,
    gst_minor: gst,
    total_minor: payment.total_minor,
    currency: payment.currency,
  });
  return id as number;
}

function parseJson<T>(v: unknown): T {
  return (typeof v === 'string' ? JSON.parse(v) : v) as T;
}

export async function loadInvoice(invoiceId: number) {
  const inv = await db('invoices as i')
    .join('payments as p', 'p.id', 'i.payment_id')
    .where('i.id', invoiceId)
    .first('i.*', 'p.gateway_payment_id', 'p.paid_at', 'p.method', 'p.status as payment_status');
  if (!inv) return null;
  return {
    ...inv,
    billed_to: parseJson<BilledTo>(inv.billed_to),
    lines: parseJson<InvoiceLine[]>(inv.lines),
  };
}

/** Returns the PDF bytes, rendering + storing it on first access. */
export async function getInvoicePdf(
  invoiceId: number,
  canAccess: (ownerUserId: number) => boolean = () => true,
): Promise<{ buffer: Buffer; filename: string; userId: number }> {
  const inv = await loadInvoice(invoiceId);
  if (!inv || !canAccess(inv.user_id)) throw Errors.notFound('Invoice not found.');
  const storage = getStorage();
  const filename = `${inv.invoice_number.replace(/[^\w-]+/g, '_')}.pdf`;

  if (inv.file_key && (await storage.exists(inv.file_key))) {
    return { buffer: await storage.read(inv.file_key), filename, userId: inv.user_id };
  }
  const buffer = await renderInvoicePdf(inv);
  const key = `invoices/${inv.financial_year}/${filename}`;
  await storage.write(key, buffer);
  await db('invoices').where({ id: invoiceId }).update({ file_key: key, generated_at: now() });
  return { buffer, filename, userId: inv.user_id };
}
