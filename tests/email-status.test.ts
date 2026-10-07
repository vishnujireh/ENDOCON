import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { processEmailOutbox } from '../src/modules/email/email.worker.js';
import { setEmailProvider, type EmailProvider, type OutgoingEmail } from '../src/modules/email/provider.js';
import { admin, app, at, buy, categoryCode, Client, db, gateway, mailer, participant, resetDb, sendWebhook, webhookBody } from './helpers/app.js';

/** Fails every send (like Brevo answering 401) until healed. */
class BrokenProvider implements EmailProvider {
  healthy = false;
  sent: OutgoingEmail[] = [];
  async send(m: OutgoingEmail) {
    if (!this.healthy) throw new Error('Brevo API 401: {"code":"unauthorized","message":"Key not found"}');
    this.sent.push(m);
  }
}

beforeEach(async () => {
  await resetDb();
  at('2026-09-23T12:00:00+05:30');
});
afterEach(() => setEmailProvider(mailer));
afterAll(() => db.destroy());

describe('email delivery status in API replies', () => {
  it('payment verify reports the confirmation and team notification as sent (team address hidden)', async () => {
    const { client } = await participant('anita@test.in');
    const { verify } = await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    expect(verify.status).toBe(200);
    expect(verify.body.emails).toEqual([
      { to: 'anita@test.in', type: 'registration_confirmation', status: 'sent' },
      { to: 'ENDOCON team', type: 'admin_payment_notification', status: 'sent' },
    ]);
    // Already sent by the request – the worker has nothing left to do and nothing is sent twice.
    expect(await processEmailOutbox()).toBe(0);
    expect(mailer.sent.filter((m) => m.to === 'anita@test.in')).toHaveLength(1);
  });

  it('reports a failed send with the provider error; the worker retries it later', async () => {
    const broken = new BrokenProvider();
    setEmailProvider(broken);
    const { client } = await participant('ravi@test.in');
    const { verify } = await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    expect(verify.status).toBe(200); // the payment itself is fine
    expect(verify.body.emails[0]).toMatchObject({ to: 'ravi@test.in', type: 'registration_confirmation', status: 'retrying' });
    expect(verify.body.emails[0].error).toMatch(/Brevo API 401/);

    broken.healthy = true;
    await db('email_outbox').update({ send_after: new Date(Date.now() - 1000) });
    await processEmailOutbox();
    expect(broken.sent.map((m) => m.to)).toContain('ravi@test.in');
  });

  it('the late verify call after the webhook still reports the confirmation (already sent)', async () => {
    const { client } = await participant('late@test.in');
    const co = (await client.post('/api/payments/checkout', { cart: { conferenceCategoryCode: await categoryCode('sgei-member') } })).body.data;
    const sim = gateway.simulatePayment(co.gatewayOrderId, 'success');
    expect((await sendWebhook(webhookBody('payment.captured', sim.payment), 'evt_x')).status).toBe(200);
    await processEmailOutbox(); // the worker sends what the webhook queued
    const v = await client.post(`/api/payments/${co.paymentId}/verify`, { razorpay_order_id: co.gatewayOrderId, razorpay_payment_id: sim.payment.id, razorpay_signature: sim.signature });
    expect(v.body.emails.find((e: { type: string }) => e.type === 'registration_confirmation')).toEqual({ to: 'late@test.in', type: 'registration_confirmation', status: 'sent' });
  });

  it('forgot password keeps one identical reply (no email details) for known and unknown emails', async () => {
    await new Client().register('known@test.in');
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'known@test.in' });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.in' });
    expect(known.body).toEqual(unknown.body);
    expect(known.body.emails).toBeUndefined();
    // The worker sends it as usual.
    await processEmailOutbox();
    expect(mailer.sent.some((m) => m.to === 'known@test.in')).toBe(true);
  });

  it('admin email log lists every email with its status and error (never the content) and can retry', async () => {
    const broken = new BrokenProvider();
    setEmailProvider(broken);
    const { client } = await participant('log@test.in');
    await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    const a = await admin();

    const log = await a.get('/api/admin/emails?status=retrying');
    expect(log.status).toBe(200);
    expect(log.body.data.rows.map((r: { type: string }) => r.type).sort()).toEqual(['admin_payment_notification', 'registration_confirmation']);
    const row = log.body.data.rows.find((r: { type: string }) => r.type === 'registration_confirmation');
    expect(row).toMatchObject({ to: 'log@test.in', status: 'retrying', attempts: 1 });
    expect(row.error).toMatch(/Key not found/);
    expect(JSON.stringify(log.body)).not.toContain('payload');

    broken.healthy = true;
    const retry = await a.post(`/api/admin/emails/${row.id}/retry`, {});
    expect(retry.status).toBe(200);
    expect(retry.body.data).toMatchObject({ id: row.id, status: 'sent' });
    expect((await a.post(`/api/admin/emails/${row.id}/retry`, {})).body.code).toBe('EMAIL_ALREADY_SENT');

    // Participants cannot read the log.
    expect((await client.get('/api/admin/emails')).status).toBe(403);
  });
});
