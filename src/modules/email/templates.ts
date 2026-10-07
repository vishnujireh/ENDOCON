import { env } from '../../config/env.js';
import { formatMoney } from '../../lib/money.js';

/**
 * Email templates. Payloads are plain JSON snapshots stored in the outbox so an email can be
 * (re)rendered later without depending on data that may have changed.
 * Every interpolated value is HTML-escaped.
 */

export const EVENT = {
  name: 'ENDOCON 2027',
  dates: '22–25 April, 2027',
  venue: 'ITC Royal Bengal, Kolkata',
};

export interface MoneyLine {
  description: string;
  amountMinor: number;
  gstMinor: number;
  totalMinor: number;
}

export interface PaymentEmailPayload {
  paymentId: number;
  invoiceId: number | null;
  title: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  orderNumber: string;
  gatewayPaymentId: string;
  paidAt: string;
  currency: string;
  lines: MoneyLine[];
  subtotalMinor: number;
  gstMinor: number;
  totalMinor: number;
  gstRatePercent: string;
  /** Everything the participant holds after this payment, for context. */
  registrationSummary: { conference: string | null; workshops: string[]; accommodation: string | null; accompanying: string[] };
  isResend?: boolean;
}

export interface EmailTemplatePayloads {
  password_reset: { fullName: string; resetUrl: string; expiresMinutes: number };
  /** Sent directly (never queued) so the code is not stored in plain text. */
  reviewer_otp: { name: string; code: string; expiresMinutes: number };
  password_changed: { fullName: string };
  registration_confirmation: PaymentEmailPayload;
  admin_payment_notification: PaymentEmailPayload;
  /** Worker skips sending if the payment has since succeeded (Razorpay allows retries on the same order). */
  payment_failed: { paymentId: number; fullName: string; totalMinor: number; currency: string; retryUrl: string; reason: string | null };
  payment_conflict_admin: { paymentId: number; gatewayPaymentId: string; orderNumber: string | null; email: string; reason: string };
  abstract_submitted: AbstractEmailBase & { myAbstractsUrl?: string };
  abstract_resubmitted: AbstractEmailBase & { myAbstractsUrl: string };
  /** Accept / Reject / Duplicate. The comment is the admin's note to the author (required for Reject / Duplicate). */
  abstract_decision: AbstractEmailBase & { decision: 'accepted' | 'rejected' | 'duplicate'; comment: string | null; canResubmit: boolean; closesAt: string; myAbstractsUrl: string };
  /** To the organising team when an abstract is submitted or resubmitted. */
  abstract_admin_notification: AbstractEmailBase & { kind: 'new' | 'resubmitted'; email: string };
}

interface AbstractEmailBase {
  fullName: string;
  abstractNumber: string;
  title: string;
  categoryLabel: string;
  submittedAt: string;
}

export type EmailTemplateName = keyof EmailTemplatePayloads;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function salutation(title: string | null | undefined, name: string): string {
  const t = title?.trim();
  if (!t) return name;
  return name.toLowerCase().startsWith(t.toLowerCase().replace(/\.$/, '')) ? name : `${t} ${name}`;
}

function layout(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf8f5;font-family:Arial,Helvetica,sans-serif;color:#1a1918;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5cfcd;border-radius:12px;overflow:hidden;">
<tr><td style="background:#580c1e;color:#fef3c7;padding:20px 28px;font-size:20px;font-weight:bold;">${esc(EVENT.name)}<div style="font-size:12px;font-weight:normal;color:#e5c05d;margin-top:4px;">${esc(EVENT.dates)} · ${esc(EVENT.venue)}</div></td></tr>
<tr><td style="padding:28px;font-size:14px;line-height:1.6;">${bodyHtml}
<p style="margin-top:28px;">Best Regards,<br><strong style="color:#580c1e;">Organizing Team</strong><br><strong style="color:#c89e37;">Team ${esc(EVENT.name)}</strong></p></td></tr>
<tr><td style="background:#3f5a6e;color:#ffffff;font-size:11px;text-align:center;padding:12px;">© 2027 ${esc(EVENT.name)}. All rights reserved.${env.SUPPORT_EMAIL ? ` · ${esc(env.SUPPORT_EMAIL)}` : ''}</td></tr>
</table></td></tr></table></body></html>`;
}

function contactLine(): string {
  const parts = [env.SUPPORT_PHONE, env.SUPPORT_EMAIL].filter(Boolean).map(esc);
  return parts.length ? `<p>For any further details, feel free to contact us at ${parts.join(' / ')}.</p>` : '';
}

function moneyTable(p: PaymentEmailPayload): string {
  const cur = p.currency;
  const rows = p.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${esc(l.description)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${esc(formatMoney(l.amountMinor, cur))}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0;font-size:13px;">
<tr><td style="padding:8px;background:#f5f3f0;font-weight:bold;">Item</td><td style="padding:8px;background:#f5f3f0;font-weight:bold;text-align:right;">Amount</td></tr>
${rows}
<tr><td style="padding:8px;text-align:right;">Subtotal</td><td style="padding:8px;text-align:right;">${esc(formatMoney(p.subtotalMinor, cur))}</td></tr>
<tr><td style="padding:8px;text-align:right;">GST (${esc(p.gstRatePercent)}%)</td><td style="padding:8px;text-align:right;">${esc(formatMoney(p.gstMinor, cur))}</td></tr>
<tr><td style="padding:10px 8px;background:#580c1e;color:#fef3c7;font-weight:bold;text-align:right;">TOTAL PAID</td><td style="padding:10px 8px;background:#580c1e;color:#fef3c7;font-weight:bold;text-align:right;">${esc(formatMoney(p.totalMinor, cur))}</td></tr>
</table>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${esc(href)}" style="background:#580c1e;color:#fef3c7;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold;">${esc(label)}</a></p>`;
}

function detailsTable(rows: [string, string | null | undefined][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:12px 0;">${rows
    .filter(([, v]) => v)
    .map(
      ([k, v], i) =>
        `<tr style="background:${i % 2 ? '#faf8f5' : '#ffffff'};"><td style="padding:8px;font-weight:bold;width:40%;">${esc(k)}</td><td style="padding:8px;">${esc(v)}</td></tr>`,
    )
    .join('')}</table>`;
}

function summaryRows(p: PaymentEmailPayload): [string, string | null][] {
  const s = p.registrationSummary;
  return [
    ['Conference', s.conference],
    ['Workshops', s.workshops.length ? s.workshops.join(', ') : null],
    ['Accommodation', s.accommodation],
    ['Accompanying persons', s.accompanying.length ? s.accompanying.join(', ') : null],
  ];
}

function textMoney(p: PaymentEmailPayload): string {
  return [
    ...p.lines.map((l) => `- ${l.description}: ${formatMoney(l.amountMinor, p.currency)}`),
    `Subtotal: ${formatMoney(p.subtotalMinor, p.currency)}`,
    `GST (${p.gstRatePercent}%): ${formatMoney(p.gstMinor, p.currency)}`,
    `TOTAL PAID: ${formatMoney(p.totalMinor, p.currency)}`,
  ].join('\n');
}

type Renderers = { [K in EmailTemplateName]: (p: EmailTemplatePayloads[K]) => RenderedEmail };

export const renderers: Renderers = {
  reviewer_otp: (p) => ({
    subject: `${p.code} is your ${EVENT.name} reviewer login code`,
    html: layout(`<p>Dear ${esc(p.name)},</p>
<p>Use this code to log in to the ${esc(EVENT.name)} abstract review portal:</p>
<p style="margin:22px 0;font-size:30px;letter-spacing:8px;font-weight:bold;color:#580c1e;">${esc(p.code)}</p>
<p>The code expires in ${esc(p.expiresMinutes)} minutes and can be used once. If you did not try to log in, you can ignore this email.</p>`),
    text: `Dear ${p.name},\n\nYour ${EVENT.name} reviewer login code is ${p.code}.\nIt expires in ${p.expiresMinutes} minutes and can be used once. If you did not try to log in, ignore this email.`,
  }),

  password_reset: (p) => ({
    subject: `Reset your ${EVENT.name} password`,
    html: layout(`<p>Dear ${esc(p.fullName)},</p>
<p>We received a request to reset the password for your ${esc(EVENT.name)} account.</p>
<p style="margin:24px 0;"><a href="${esc(p.resetUrl)}" style="background:#580c1e;color:#fef3c7;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold;">Reset password</a></p>
<p>This link expires in ${esc(p.expiresMinutes)} minutes and can be used once. If you did not request this, you can ignore this email – your password will not change.</p>`),
    text: `Dear ${p.fullName},\n\nReset your ${EVENT.name} password using this link (valid ${p.expiresMinutes} minutes, single use):\n${p.resetUrl}\n\nIf you did not request this, ignore this email.`,
  }),

  password_changed: (p) => ({
    subject: `Your ${EVENT.name} password was changed`,
    html: layout(`<p>Dear ${esc(p.fullName)},</p><p>The password for your ${esc(EVENT.name)} account was just changed and all other sessions were signed out.</p><p>If this was not you, reset your password immediately and contact the organising team.</p>${contactLine()}`),
    text: `Dear ${p.fullName},\n\nThe password for your ${EVENT.name} account was just changed. If this was not you, reset your password immediately and contact the organising team.`,
  }),

  registration_confirmation: (p) => {
    const subject = `${p.isResend ? '[Copy] ' : ''}Booking Confirmation – ${EVENT.name} (Payment Reference Number: ${p.gatewayPaymentId} | Registration No: ${p.orderNumber})`;
    const html = layout(`<p>Dear ${esc(salutation(p.title, p.fullName))},</p>
<p><strong><em>Greetings from ${esc(EVENT.name)}!</em></strong></p>
<p>We are delighted to confirm your registration for <strong>${esc(EVENT.name)}</strong>, scheduled to be held from <strong>${esc(EVENT.dates)}</strong> at <strong>${esc(EVENT.venue)}</strong>.</p>
<p>Registration Number: <strong>${esc(p.orderNumber)}</strong><br>Payment Reference Number: <strong>${esc(p.gatewayPaymentId)}</strong><br>Payment Date: ${esc(p.paidAt)}</p>
<p>Below are your booking details:</p>
${detailsTable([['Name', salutation(p.title, p.fullName)], ['Phone', p.phone], ['Email', p.email]])}
<h3 style="color:#1f4e6b;text-align:center;margin:18px 0 6px;">SUMMARY – THIS PAYMENT</h3>
${moneyTable(p)}
<h3 style="color:#1f4e6b;margin:18px 0 6px;font-size:14px;">Your registration</h3>
${detailsTable(summaryRows(p))}
${p.invoiceId ? '<p>Your GST invoice is attached to this email and can also be downloaded from your registration dashboard.</p>' : ''}
${contactLine()}`);
    const text = `Dear ${salutation(p.title, p.fullName)},\n\nYour registration for ${EVENT.name} (${EVENT.dates}, ${EVENT.venue}) is confirmed.\n\nRegistration Number: ${p.orderNumber}\nPayment Reference Number: ${p.gatewayPaymentId}\n\n${textMoney(p)}\n`;
    return { subject, html, text };
  },

  admin_payment_notification: (p) => ({
    subject: `[${EVENT.name}] Payment received – ${p.orderNumber} – ${p.fullName} – ${formatMoney(p.totalMinor, p.currency)}`,
    html: layout(`<p>A payment has been verified.</p>
${detailsTable([
  ['Registration No', p.orderNumber],
  ['Participant', salutation(p.title, p.fullName)],
  ['Email', p.email],
  ['Phone', p.phone],
  ['Gateway payment ID', p.gatewayPaymentId],
  ['Paid at', p.paidAt],
])}
${moneyTable(p)}
${detailsTable(summaryRows(p))}`),
    text: `Payment verified for ${p.orderNumber} (${p.fullName}, ${p.email}). Payment ID ${p.gatewayPaymentId}.\n\n${textMoney(p)}`,
  }),

  payment_failed: (p) => ({
    subject: `${EVENT.name} – payment not completed`,
    html: layout(`<p>Dear ${esc(p.fullName)},</p>
<p>Your payment of <strong>${esc(formatMoney(p.totalMinor, p.currency))}</strong> could not be completed${p.reason ? ` (${esc(p.reason)})` : ''}. <strong>Your registration has not been confirmed.</strong></p>
<p>No amount has been confirmed against your registration. If money was debited from your account, it will be refunded automatically by your bank / the payment gateway.</p>
<p style="margin:24px 0;"><a href="${esc(p.retryUrl)}" style="background:#580c1e;color:#fef3c7;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold;">Try again</a></p>
${contactLine()}`),
    text: `Dear ${p.fullName},\n\nYour payment of ${formatMoney(p.totalMinor, p.currency)} could not be completed. Your registration has not been confirmed. Please try again: ${p.retryUrl}`,
  }),

  payment_conflict_admin: (p) => ({
    subject: `[${EVENT.name}] ACTION REQUIRED – payment ${p.gatewayPaymentId} needs review/refund`,
    html: layout(`<p>A payment was captured but its items could not be granted automatically.</p>
${detailsTable([
  ['Internal payment ID', String(p.paymentId)],
  ['Gateway payment ID', p.gatewayPaymentId],
  ['Registration No', p.orderNumber],
  ['Participant email', p.email],
  ['Reason', p.reason],
])}
<p>Please review it in the admin panel and refund it from the Razorpay dashboard if appropriate.</p>`),
    text: `Payment ${p.gatewayPaymentId} (internal ${p.paymentId}) for ${p.email} needs review/refund: ${p.reason}`,
  }),

  abstract_submitted: (p) => ({
    subject: `${EVENT.name} – Abstract received (${p.abstractNumber})`,
    html: layout(`<p>Dear ${esc(p.fullName)},</p>
<p>Thank you for submitting your abstract to <strong>${esc(EVENT.name)}</strong>.</p>
${detailsTable([
  ['Abstract No', p.abstractNumber],
  ['Title', p.title],
  ['Category', p.categoryLabel],
  ['Submitted on', p.submittedAt],
])}
<p>Your submission will be reviewed by the Scientific Committee. You will receive an email when it has been reviewed, and you can follow its status under <strong>My Abstracts</strong> after logging in.</p>
${p.myAbstractsUrl ? button(p.myAbstractsUrl, 'View my abstracts') : ''}
<p>Please note that the presenting author must register for the conference to be eligible to present.</p>
${contactLine()}`),
    text: `Dear ${p.fullName},\n\nWe have received your abstract ${p.abstractNumber}: "${p.title}" (${p.categoryLabel}), submitted ${p.submittedAt}.\nIt will be reviewed by the Scientific Committee.${p.myAbstractsUrl ? `\n\nMy Abstracts: ${p.myAbstractsUrl}` : ''}`,
  }),

  abstract_resubmitted: (p) => ({
    subject: `${EVENT.name} – Revised abstract received (${p.abstractNumber})`,
    html: layout(`<p>Dear ${esc(p.fullName)},</p>
<p>We have received your <strong>revised</strong> abstract. It will be reviewed again by the Scientific Committee.</p>
${detailsTable([
  ['Abstract No', p.abstractNumber],
  ['Title', p.title],
  ['Category', p.categoryLabel],
  ['Resubmitted on', p.submittedAt],
])}
${button(p.myAbstractsUrl, 'View my abstracts')}
${contactLine()}`),
    text: `Dear ${p.fullName},\n\nWe have received your revised abstract ${p.abstractNumber}: "${p.title}" (${p.categoryLabel}), resubmitted ${p.submittedAt}.\n\nMy Abstracts: ${p.myAbstractsUrl}`,
  }),

  abstract_decision: (p) => {
    const label = p.decision === 'accepted' ? 'Accepted' : p.decision === 'duplicate' ? 'Marked as duplicate' : 'Returned for revision';
    const intro =
      p.decision === 'accepted'
        ? `<p>We are pleased to inform you that your abstract has been <strong style="color:#047857;">accepted</strong> by the Scientific Committee of <strong>${esc(EVENT.name)}</strong>. Congratulations!</p>
<p>Presentation details, format and allotted time will be communicated separately. The presenting author must register for the conference to be eligible to present.</p>`
        : `<p>The Scientific Committee has reviewed your abstract and marked it as <strong style="color:#b91c1c;">${p.decision === 'duplicate' ? 'Duplicate' : 'Rejected'}</strong>.</p>`;
    const comment = p.comment
      ? `<p style="margin:16px 0 4px;font-weight:bold;">Comment from the Scientific Committee</p>
<div style="background:#fdf8ec;border-left:4px solid #c89e37;padding:12px 14px;border-radius:6px;white-space:pre-wrap;font-size:14px;">${esc(p.comment)}</div>`
      : '';
    const next =
      p.decision === 'accepted'
        ? ''
        : p.canResubmit
          ? `<p>Please update your abstract based on the comment above and <strong>resubmit</strong> it before ${esc(p.closesAt)}. Log in and open <strong>My Abstracts</strong> → <strong>Revise &amp; resubmit</strong>.</p>`
          : '<p>The abstract submission period has closed, so this abstract can no longer be revised.</p>';
    return {
      subject: `${EVENT.name} – Abstract ${p.abstractNumber}: ${label}`,
      html: layout(`<p>Dear ${esc(p.fullName)},</p>
${intro}
${detailsTable([
  ['Abstract No', p.abstractNumber],
  ['Title', p.title],
  ['Category', p.categoryLabel],
])}
${comment}
${next}
${button(p.myAbstractsUrl, p.decision !== 'accepted' && p.canResubmit ? 'Revise & resubmit' : 'View my abstracts')}
${contactLine()}`),
      text:
        `Dear ${p.fullName},\n\nYour abstract ${p.abstractNumber} ("${p.title}") has been ${p.decision === 'accepted' ? 'ACCEPTED' : p.decision === 'duplicate' ? 'marked as DUPLICATE' : 'REJECTED'} by the Scientific Committee.` +
        (p.comment ? `\n\nComment: ${p.comment}` : '') +
        (p.decision !== 'accepted' && p.canResubmit ? `\n\nPlease revise and resubmit before ${p.closesAt}.` : '') +
        `\n\nMy Abstracts: ${p.myAbstractsUrl}`,
    };
  },

  abstract_admin_notification: (p) => ({
    subject: `${EVENT.name} – ${p.kind === 'new' ? 'New' : 'Resubmitted'} abstract ${p.abstractNumber}`,
    html: layout(`<p>${p.kind === 'new' ? 'A new abstract has been submitted' : 'A revised abstract has been resubmitted'} and is waiting for review.</p>
${detailsTable([
  ['Abstract No', p.abstractNumber],
  ['Title', p.title],
  ['Category', p.categoryLabel],
  ['Submitted by', `${p.fullName} (${p.email})`],
  ['Received', p.submittedAt],
])}
<p>Review it in the admin panel under <strong>Abstracts</strong>.</p>`),
    text: `${p.kind === 'new' ? 'New' : 'Resubmitted'} abstract ${p.abstractNumber}: "${p.title}" (${p.categoryLabel}) by ${p.fullName} <${p.email}>, ${p.submittedAt}.`,
  }),
};

export function renderEmail<T extends EmailTemplateName>(template: T, payload: EmailTemplatePayloads[T]): RenderedEmail {
  const fn = renderers[template] as (p: EmailTemplatePayloads[T]) => RenderedEmail;
  if (!fn) throw new Error(`Unknown email template: ${template}`);
  return fn(payload);
}
