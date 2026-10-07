import PDFDocument from 'pdfkit';
import { env } from '../../config/env.js';
import { minorToDecimalString } from '../../lib/money.js';
import { formatEventDate, formatEventDateTime } from '../../lib/time.js';
import type { BilledTo, InvoiceLine } from './invoice.service.js';

/**
 * Server-side PDF invoice. This file is the only place that knows the invoice layout —
 * when the official format is supplied, adapt this renderer; the data snapshot stays the same.
 * (PDF base fonts have no ₹ glyph, so amounts are printed as "INR 1,234.00".)
 */
export interface InvoiceRenderData {
  invoice_number: string;
  created_at: Date | string;
  currency: string;
  subtotal_minor: number | string;
  cgst_minor: number | string;
  sgst_minor: number | string;
  igst_minor: number | string;
  gst_minor: number | string;
  total_minor: number | string;
  gateway_payment_id: string | null;
  paid_at: Date | string | null;
  method: string | null;
  payment_status: string;
  billed_to: BilledTo;
  lines: InvoiceLine[];
}

function inr(minor: number | string): string {
  const s = minorToDecimalString(Number(minor));
  const [whole, frac] = s.split('.');
  const neg = whole.startsWith('-');
  const digits = neg ? whole.slice(1) : whole;
  const grouped = digits.length <= 3 ? digits : `${digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${digits.slice(-3)}`;
  return `${neg ? '-' : ''}${grouped}.${frac}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
}

/** Indian numbering system words, e.g. 21830 -> "Twenty One Thousand Eight Hundred Thirty". */
export function amountInWords(minor: number): string {
  const rupees = Math.floor(minor / 100);
  const paise = minor % 100;
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  const words = parts.length ? parts.join(' ') : 'Zero';
  return `Rupees ${words}${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`;
}

export function renderInvoicePdf(inv: InvoiceRenderData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Invoice ${inv.invoice_number}`, Author: env.ORG_NAME } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const maroon = '#580c1e';
    const gold = '#c89e37';
    const left = 40;
    const width = doc.page.width - 80;

    // Header
    doc.rect(0, 0, doc.page.width, 90).fill(maroon);
    doc.fillColor('#fef3c7').font('Helvetica-Bold').fontSize(18).text(env.ORG_NAME, left, 22, { width: width - 160 });
    doc.font('Helvetica').fontSize(9).fillColor('#f7eed2').text(env.ORG_ADDRESS, left, 46, { width: width - 160 });
    const ids = [env.ORG_GSTIN && `GSTIN: ${env.ORG_GSTIN}`, env.ORG_PAN && `PAN: ${env.ORG_PAN}`].filter(Boolean).join('   ');
    if (ids) doc.text(ids, left, 60, { width: width - 160 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(gold).text('TAX INVOICE', left, 30, { width, align: 'right' });

    // Meta
    let y = 110;
    doc.fillColor('#1a1918').font('Helvetica-Bold').fontSize(10).text('Billed To', left, y);
    doc.font('Helvetica-Bold').text('Invoice Details', left + width / 2, y);
    y += 14;
    const b = inv.billed_to;
    const billed = [
      b.name,
      b.organization,
      b.address,
      [b.city, b.state, b.pinCode].filter(Boolean).join(', '),
      b.country,
      b.email,
      b.phone,
    ].filter(Boolean) as string[];
    doc.font('Helvetica').fontSize(9).text(billed.join('\n'), left, y, { width: width / 2 - 10 });
    const meta: [string, string][] = [
      ['Invoice No.', inv.invoice_number],
      ['Invoice Date', formatEventDate(inv.paid_at ?? inv.created_at)],
      ['Registration No.', b.orderNumber],
      ['Payment ID', inv.gateway_payment_id ?? '-'],
      ['Payment Date', formatEventDateTime(inv.paid_at)],
      ['Payment Mode', inv.method ? `Online (${inv.method.toUpperCase()})` : 'Online'],
      ['Payment Status', ['success', 'partially_refunded'].includes(inv.payment_status) ? 'PAID' : inv.payment_status.toUpperCase()],
      ['Place of Supply', `West Bengal (${env.ORG_STATE_CODE})`],
    ];
    let my = y;
    for (const [k, v] of meta) {
      doc.font('Helvetica').fillColor('#665e5d').text(k, left + width / 2, my, { width: 95 });
      doc.font('Helvetica-Bold').fillColor('#1a1918').text(v, left + width / 2 + 95, my, { width: width / 2 - 95 });
      my += 13;
    }
    y = Math.max(doc.y, my) + 16;

    // Lines table
    const cols = [
      { h: '#', w: 18, a: 'left' as const },
      { h: 'Description', w: 175, a: 'left' as const },
      { h: 'SAC', w: 42, a: 'left' as const },
      { h: 'Qty', w: 26, a: 'right' as const },
      { h: 'Rate', w: 62, a: 'right' as const },
      { h: 'Taxable', w: 64, a: 'right' as const },
      { h: 'GST', w: 58, a: 'right' as const },
      { h: 'Total', w: width - 445, a: 'right' as const },
    ];
    doc.rect(left, y, width, 20).fill('#f5f3f0');
    let x = left;
    doc.fillColor('#1a1918').font('Helvetica-Bold').fontSize(8.5);
    for (const c of cols) {
      doc.text(c.h, x + 4, y + 6, { width: c.w - 8, align: c.a });
      x += c.w;
    }
    y += 24;
    doc.font('Helvetica').fontSize(8.5);
    inv.lines.forEach((l, idx) => {
      const values = [
        String(idx + 1),
        l.description,
        l.sac,
        String(l.quantity),
        inr(l.unitAmountMinor),
        inr(l.amountMinor),
        `${inr(l.gstMinor)}\n(${l.gstRateBps / 100}%)`,
        inr(l.totalMinor),
      ];
      const h = Math.max(...values.map((v, i) => doc.heightOfString(v, { width: cols[i].w - 8 }))) + 8;
      if (y + h > doc.page.height - 160) {
        doc.addPage();
        y = 50;
      }
      x = left;
      values.forEach((v, i) => {
        doc.text(v, x + 4, y, { width: cols[i].w - 8, align: cols[i].a });
        x += cols[i].w;
      });
      y += h;
      doc.moveTo(left, y - 3).lineTo(left + width, y - 3).strokeColor('#e5cfcd').lineWidth(0.5).stroke();
    });

    // Totals
    y += 6;
    const totals: [string, string, boolean][] = [
      ['Taxable Value', inr(inv.subtotal_minor), false],
      ...(Number(inv.igst_minor) > 0
        ? ([[`IGST`, inr(inv.igst_minor), false]] as [string, string, boolean][])
        : ([
            ['CGST', inr(inv.cgst_minor), false],
            ['SGST', inr(inv.sgst_minor), false],
          ] as [string, string, boolean][])),
      ['Total GST', inr(inv.gst_minor), false],
      [`Grand Total (${inv.currency})`, inr(inv.total_minor), true],
    ];
    for (const [k, v, bold] of totals) {
      if (bold) doc.rect(left + width - 230, y - 4, 230, 20).fill(maroon);
      doc.fillColor(bold ? '#fef3c7' : '#1a1918').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5);
      doc.text(k, left + width - 225, y, { width: 120 });
      doc.text(v, left + width - 105, y, { width: 100, align: 'right' });
      y += bold ? 24 : 15;
    }
    doc.fillColor('#1a1918').font('Helvetica-Oblique').fontSize(9).text(`Amount in words: ${amountInWords(Number(inv.total_minor))}`, left, y + 4, { width });

    // Footer
    doc.font('Helvetica').fontSize(8).fillColor('#665e5d').text(
      `This is a computer-generated invoice and does not require a signature. For queries contact ${env.SUPPORT_EMAIL}.`,
      left,
      doc.page.height - 70,
      { width, align: 'center' },
    );
    doc.end();
  });
}
