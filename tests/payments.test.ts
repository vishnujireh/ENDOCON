import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { processEmailOutbox } from '../src/modules/email/email.worker.js';
import { reconcilePayments } from '../src/modules/payments/payment.service.js';
import { addMinutes, now } from '../src/lib/time.js';
import {
  accommodationCode,
  at,
  buy,
  categoryCode,
  db,
  gateway,
  mailer,
  participant,
  resetDb,
  seedWorkshops,
  sendWebhook,
  webhookBody,
} from './helpers/app.js';

beforeEach(async () => {
  await resetDb();
  at('2026-09-23T12:00:00+05:30');
});
afterAll(() => db.destroy());

async function counts() {
  const [c, w, a] = await Promise.all([
    db('conference_registrations').count({ n: '*' }).first(),
    db('order_workshops').count({ n: '*' }).first(),
    db('order_accommodations').count({ n: '*' }).first(),
  ]);
  return { conference: Number(c?.n), workshops: Number(w?.n), accommodation: Number(a?.n) };
}

describe('successful payment', () => {
  it('verifies server-side, grants items, assigns ENDO-0001, creates invoice and queues emails', async () => {
    const { client } = await participant();
    const { verify, gatewayPaymentId, paymentId } = await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    expect(verify.status).toBe(200);
    expect(verify.body.data).toMatchObject({ status: 'success', orderNumber: 'ENDO-0001', gatewayPaymentId, totalMinor: 2183000 });
    expect(verify.body.data.invoice.number).toMatch(/^ENDO\/2026-27\/00001$/);
    expect(await counts()).toEqual({ conference: 1, workshops: 0, accommodation: 0 });

    const emails = await db('email_outbox').orderBy('id');
    expect(emails.map((e) => e.template)).toEqual(['registration_confirmation', 'admin_payment_notification']);
    await processEmailOutbox();
    const confirmation = mailer.sent.find((m) => m.subject.startsWith('Booking Confirmation'))!;
    expect(confirmation.subject).toContain('Registration No: ENDO-0001');
    expect(confirmation.subject).toContain(gatewayPaymentId);
    expect(confirmation.attachments?.[0].filename).toMatch(/\.pdf$/);
    expect(confirmation.attachments?.[0].content.subarray(0, 5).toString()).toBe('%PDF-');
    expect(mailer.sent.some((m) => m.to === 'team@endocon.test')).toBe(true);

    const invoice = await client.agent.get(`/api/invoices/${verify.body.data.invoice.id}/pdf`);
    expect(invoice.status).toBe(200);
    expect(invoice.headers['content-type']).toBe('application/pdf');
    expect(paymentId).toBeGreaterThan(0);
  });

  it('does not trust the client: a forged signature is rejected and nothing is granted', async () => {
    const { client } = await participant();
    const co = (await client.post('/api/payments/checkout', { cart: { conferenceCategoryCode: await categoryCode('sgei-member') } })).body.data;
    const sim = gateway.simulatePayment(co.gatewayOrderId, 'success');
    const res = await client.post(`/api/payments/${co.paymentId}/verify`, { razorpay_order_id: co.gatewayOrderId, razorpay_payment_id: sim.payment.id, razorpay_signature: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_SIGNATURE');
    expect((await counts()).conference).toBe(0);
  });

  it('a valid signature is not enough if the gateway says the payment was not captured', async () => {
    const { client } = await participant();
    const co = (await client.post('/api/payments/checkout', { cart: { conferenceCategoryCode: await categoryCode('sgei-member') } })).body.data;
    const sim = gateway.simulatePayment(co.gatewayOrderId, 'failure');
    const res = await client.post(`/api/payments/${co.paymentId}/verify`, { razorpay_order_id: co.gatewayOrderId, razorpay_payment_id: sim.payment.id, razorpay_signature: sim.signature });
    expect(res.body.data.status).toBe('failed');
    expect((await counts()).conference).toBe(0);
  });

  it('captures authorised payments when auto-capture is off', async () => {
    gateway.autoCapture = false;
    const { client } = await participant();
    const { verify } = await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    expect(verify.body.data.status).toBe('success');
  });
});

describe('failure and retry', () => {
  it('failed payment confirms nothing; retry succeeds without duplicate registrations', async () => {
    const { client } = await participant();
    const cart = { conferenceCategoryCode: await categoryCode('sgei-member') };
    const co = (await client.post('/api/payments/checkout', { cart })).body.data;
    await client.post(`/api/payments/${co.paymentId}/simulate`, { outcome: 'failure' });
    const failed = (await client.get(`/api/payments/${co.paymentId}`)).body.data;
    expect(failed.status).toBe('failed');
    expect(failed.orderNumber).toBeNull();
    expect((await counts()).conference).toBe(0);
    let status = (await client.get('/api/registration/status')).body.data;
    expect(status.conference).toBeNull();
    expect(status.nextStep).toBe('conference');

    const retry = await buy(client, cart);
    expect(retry.paymentId).not.toBe(co.paymentId);
    expect(retry.verify.body.data.status).toBe('success');
    expect(retry.verify.body.data.orderNumber).toBe('ENDO-0001');
    status = (await client.get('/api/registration/status')).body.data;
    expect(status.order.orderNumber).toBe('ENDO-0001');
    expect(await counts()).toEqual({ conference: 1, workshops: 0, accommodation: 0 });
    expect(await db('orders').count({ n: '*' }).first()).toEqual({ n: 1 });
    await db('email_outbox').update({ send_after: addMinutes(now(), -1) });
    await processEmailOutbox();
    const failedMail = await db('email_outbox').where({ template: 'payment_failed' }).first();
    expect(failedMail.last_error).toMatch(/later payment .* succeeded/);
  });

  it('payment-failed email is skipped if the customer then succeeds on the same order', async () => {
    const { client } = await participant();
    const co = (await client.post('/api/payments/checkout', { cart: { conferenceCategoryCode: await categoryCode('sgei-member') } })).body.data;
    await client.post(`/api/payments/${co.paymentId}/simulate`, { outcome: 'failure' });
    const sim = gateway.simulatePayment(co.gatewayOrderId, 'success'); // retry inside the same Razorpay order
    const res = await client.post(`/api/payments/${co.paymentId}/verify`, { razorpay_order_id: co.gatewayOrderId, razorpay_payment_id: sim.payment.id, razorpay_signature: sim.signature });
    expect(res.body.data.status).toBe('success');
    await db('email_outbox').update({ send_after: addMinutes(now(), -1) });
    await processEmailOutbox();
    const failedMail = await db('email_outbox').where({ template: 'payment_failed' }).first();
    expect(failedMail.last_error).toMatch(/skipped/);
    expect(mailer.sent.some((m) => m.subject.includes('payment not completed'))).toBe(false);
  });

  it('cancelling the checkout keeps the registration unconfirmed', async () => {
    const { client } = await participant();
    const co = (await client.post('/api/payments/checkout', { cart: { conferenceCategoryCode: await categoryCode('sgei-member') } })).body.data;
    const res = await client.post(`/api/payments/${co.paymentId}/cancel`, { reason: 'closed' });
    expect(res.body.data.status).toBe('cancelled');
    expect((await counts()).conference).toBe(0);
  });
});

describe('idempotency & concurrency', () => {
  it('double-clicking Pay reuses the same checkout (same cart / idempotency key)', async () => {
    const { client } = await participant();
    const cart = { conferenceCategoryCode: await categoryCode('sgei-member') };
    const [a, b] = await Promise.all([client.post('/api/payments/checkout', { cart }), client.post('/api/payments/checkout', { cart })]);
    expect(a.body.data.paymentId).toBe(b.body.data.paymentId);
    expect(a.body.data.gatewayOrderId).toBe(b.body.data.gatewayOrderId);
    const k1 = await client.agent.post('/api/payments/checkout').set('X-CSRF-Token', client.csrf).set('Idempotency-Key', 'key-12345678').send({ cart });
    const k2 = await client.agent.post('/api/payments/checkout').set('X-CSRF-Token', client.csrf).set('Idempotency-Key', 'key-12345678').send({ cart });
    expect(k1.body.data.paymentId).toBe(k2.body.data.paymentId);
    expect(await db('payments').whereIn('status', ['created']).count({ n: '*' }).first()).toEqual({ n: 1 });
  });

  it('repeated verify callbacks and duplicate webhooks never create duplicate records', async () => {
    const { client } = await participant();
    const { checkout, gatewayPaymentId } = await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    const sim = gateway.payments.get(gatewayPaymentId)!;
    // Browser refresh -> callback repeated
    const { hmacSha256Hex } = await import('../src/lib/crypto.js');
    const sig = hmacSha256Hex(gateway.secret, `${checkout.gatewayOrderId}|${gatewayPaymentId}`);
    const again = await client.post(`/api/payments/${checkout.paymentId}/verify`, { razorpay_order_id: checkout.gatewayOrderId, razorpay_payment_id: gatewayPaymentId, razorpay_signature: sig });
    expect(again.body.data.status).toBe('success');
    // Webhook delivered twice
    const raw = webhookBody('payment.captured', sim);
    expect((await sendWebhook(raw, 'evt_1')).status).toBe(200);
    const dup = await sendWebhook(raw, 'evt_1');
    expect(dup.body.message).toBe('duplicate');
    expect(await counts()).toEqual({ conference: 1, workshops: 0, accommodation: 0 });
    expect(await db('invoices').count({ n: '*' }).first()).toEqual({ n: 1 });
    expect(await db('email_outbox').where({ template: 'registration_confirmation' }).count({ n: '*' }).first()).toEqual({ n: 1 });
  });

  it('webhook arriving before the redirect settles the payment; the late callback is a no-op', async () => {
    const { client } = await participant();
    const co = (await client.post('/api/payments/checkout', { cart: { conferenceCategoryCode: await categoryCode('sgei-member') } })).body.data;
    const sim = gateway.simulatePayment(co.gatewayOrderId, 'success');
    const res = await sendWebhook(webhookBody('payment.captured', sim.payment), 'evt_early');
    expect(res.body.message).toBe('processed');
    expect((await client.get(`/api/payments/${co.paymentId}`)).body.data.status).toBe('success');
    const late = await client.post(`/api/payments/${co.paymentId}/verify`, { razorpay_order_id: co.gatewayOrderId, razorpay_payment_id: sim.payment.id, razorpay_signature: sim.signature });
    expect(late.body.data.status).toBe('success');
    expect((await counts()).conference).toBe(1);
  });

  it('rejects webhooks with a bad signature', async () => {
    const res = await (await import('supertest')).default((await import('./helpers/app.js')).app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', 'bad')
      .send('{"event":"payment.captured"}');
    expect(res.status).toBe(400);
  });

  it('browser closed after paying: reconciliation settles it without any callback', async () => {
    const { client } = await participant();
    const co = (await client.post('/api/payments/checkout', { cart: { conferenceCategoryCode: await categoryCode('sgei-member') } })).body.data;
    gateway.simulatePayment(co.gatewayOrderId, 'success');
    await db('payments').update({ created_at: addMinutes(now(), -30) });
    const result = await reconcilePayments();
    expect(result.settled).toBe(1);
    expect((await client.get('/api/registration/status')).body.data.conference).not.toBeNull();
  });

  it('two tabs paying for the same workshop: second capture is flagged for refund, not double-booked', async () => {
    const ws = await seedWorkshops();
    const { client } = await participant();
    await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    const tab1 = (await client.post('/api/payments/checkout', { cart: { workshopCodes: [ws.b] } })).body.data;
    // Tab 2 with a different cart supersedes tab 1 in our DB, but tab 1's modal is still open.
    const tab2 = (await client.post('/api/payments/checkout', { cart: { workshopCodes: [ws.b, ws.c] } })).body.data;
    const s2 = gateway.simulatePayment(tab2.gatewayOrderId, 'success');
    await client.post(`/api/payments/${tab2.paymentId}/verify`, { razorpay_order_id: tab2.gatewayOrderId, razorpay_payment_id: s2.payment.id, razorpay_signature: s2.signature });
    const s1 = gateway.simulatePayment(tab1.gatewayOrderId, 'success');
    const r1 = await client.post(`/api/payments/${tab1.paymentId}/verify`, { razorpay_order_id: tab1.gatewayOrderId, razorpay_payment_id: s1.payment.id, razorpay_signature: s1.signature });
    expect(r1.body.data.status).toBe('conflict');
    expect(await db('order_workshops').where({ workshop_code: ws.b }).count({ n: '*' }).first()).toEqual({ n: 1 });
    expect(await db('email_outbox').where({ template: 'payment_conflict_admin' }).count({ n: '*' }).first()).toEqual({ n: 1 });
  });

  it('amount mismatch from the gateway is never accepted as paid', async () => {
    const { client } = await participant();
    const co = (await client.post('/api/payments/checkout', { cart: { conferenceCategoryCode: await categoryCode('sgei-member') } })).body.data;
    const sim = gateway.simulatePayment(co.gatewayOrderId, 'success', { amountMinor: 100 });
    const r = await client.post(`/api/payments/${co.paymentId}/verify`, { razorpay_order_id: co.gatewayOrderId, razorpay_payment_id: sim.payment.id, razorpay_signature: sim.signature });
    expect(r.body.data.status).toBe('conflict');
    expect((await counts()).conference).toBe(0);
  });

  it('users cannot see or verify other users’ payments', async () => {
    const a = await participant();
    const b = await participant();
    const co = (await a.client.post('/api/payments/checkout', { cart: { conferenceCategoryCode: await categoryCode('sgei-member') } })).body.data;
    expect((await b.client.get(`/api/payments/${co.paymentId}`)).status).toBe(404);
  });
});

describe('parent order lifecycle', () => {
  it('conference -> workshop -> accommodation stay under ENDO-0001, each with its own payment and only new items charged', async () => {
    const ws = await seedWorkshops();
    const other = await participant(); // someone else registers first? keep numbering deterministic
    const { client } = await participant();

    const p1 = await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    expect(p1.verify.body.data.orderNumber).toBe('ENDO-0001');
    expect(p1.checkout.summary.totalMinor).toBe(2183000);

    const p2 = await buy(client, { workshopCodes: [ws.a] });
    expect(p2.checkout.summary.lines).toHaveLength(1);
    expect(p2.checkout.summary).toMatchObject({ subtotalMinor: 100000, gstMinor: 18000, totalMinor: 118000 });
    expect(p2.verify.body.data.orderNumber).toBe('ENDO-0001');

    const p3 = await buy(client, { accommodation: { optionCode: await accommodationCode('alternate-twin'), checkIn: '2027-04-22', checkOut: '2027-04-24' } });
    expect(p3.checkout.summary).toMatchObject({ subtotalMinor: 1300000, gstMinor: 234000, totalMinor: 1534000 });
    expect(p3.verify.body.data.orderNumber).toBe('ENDO-0001');

    const ids = new Set([p1.gatewayPaymentId, p2.gatewayPaymentId, p3.gatewayPaymentId]);
    expect(ids.size).toBe(3);
    const orders = await db('orders').whereNotNull('order_number');
    expect(orders).toHaveLength(1);
    const payments = await db('payments').where({ order_id: orders[0].id, status: 'success' });
    expect(payments).toHaveLength(3);
    expect(payments.reduce((s, p) => s + Number(p.total_minor), 0)).toBe(2183000 + 118000 + 1534000);
    const invoices = await db('invoices').orderBy('id');
    expect(invoices.map((i) => i.invoice_number)).toEqual(['ENDO/2026-27/00001', 'ENDO/2026-27/00002', 'ENDO/2026-27/00003']);
    expect(other.user.id).toBeGreaterThan(0);
  });

  it('accompanying persons are added to the delegate’s order and priced by region', async () => {
    const { client } = await participant();
    const r = await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member'), accompanyingPersons: [{ title: 'Mrs.', fullName: 'Rina Sen' }] });
    expect(r.checkout.summary.lines[1].description).toContain('Accompanying National – Mrs. Rina Sen');
    expect(r.checkout.summary.lines[1].amountMinor).toBe(1200000);
    const status = (await client.get('/api/registration/status')).body.data;
    expect(status.accompanying).toHaveLength(1);
  });

  it('refunded items cannot be silently re-bought online', async () => {
    const ws = await seedWorkshops();
    const { client } = await participant();
    await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    const p = await buy(client, { workshopCodes: [ws.a] });
    gateway.refund(p.gatewayPaymentId, 118000);
    await sendWebhook(JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_2', payment_id: p.gatewayPaymentId, amount: 118000 } } } }), 'evt_r2');
    const again = await client.post('/api/registration/quote', { workshopCodes: [ws.a] });
    expect(again.body.code).toBe('ITEM_REFUNDED');
  });

  it('an idempotency key cannot be reused for a different cart', async () => {
    const ws = await seedWorkshops();
    const { client } = await participant();
    await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    const k = (cart: object) => client.agent.post('/api/payments/checkout').set('X-CSRF-Token', client.csrf).set('Idempotency-Key', 'same-key-123456').send({ cart });
    expect((await k({ workshopCodes: [ws.b] })).status).toBe(200);
    const r = await k({ workshopCodes: [ws.c] });
    expect(r.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('full refund webhook marks the items refunded', async () => {
    const ws = await seedWorkshops();
    const { client } = await participant();
    await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    const p = await buy(client, { workshopCodes: [ws.a] });
    gateway.refund(p.gatewayPaymentId, 118000);
    const raw = JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: p.gatewayPaymentId, amount: 118000 } } } });
    expect((await sendWebhook(raw, 'evt_refund')).status).toBe(200);
    expect((await db('payments').where({ id: p.paymentId }).first()).status).toBe('refunded');
    expect((await db('order_workshops').first()).status).toBe('refunded');
  });
});
