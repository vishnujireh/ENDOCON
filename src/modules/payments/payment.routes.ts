import express, { Router } from 'express';
import { trackRelatedEmails } from '../email/email-tracker.js';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { Errors } from '../../lib/errors.js';
import { asyncHandler, idParam, ok, parse } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { checkoutLimiter } from '../../middleware/rate-limit.js';
import { cartSchema } from '../registration/cart.service.js';
import { FakeGateway } from './gateway/fake.gateway.js';
import { getGateway } from './gateway/index.js';
import {
  cancelCheckout,
  checkout,
  handleWebhook,
  markAttemptFailed,
  refreshPaymentForUser,
  verifyCheckout,
} from './payment.service.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const idempotencyKeySchema = z.string().trim().regex(/^[\w-]{8,80}$/).optional();

paymentsRouter.post(
  '/checkout',
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const cart = parse(cartSchema, req.body?.cart ?? {});
    const key = parse(idempotencyKeySchema, req.get('idempotency-key') ?? req.body?.idempotencyKey ?? undefined);
    const data = await checkout(currentUserId(req), cart, key);
    return ok(res, data, 'Checkout created.');
  }),
);

const verifySchema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(255),
});

paymentsRouter.post(
  '/:id/verify',
  asyncHandler(async (req, res) => {
    const body = parse(verifySchema, req.body);
    const data = await verifyCheckout(currentUserId(req), {
      paymentId: idParam(req),
      gatewayOrderId: body.razorpay_order_id,
      gatewayPaymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    if (data.status === 'success') await trackRelatedEmails('payment', idParam(req), ['registration_confirmation', 'admin_payment_notification']);
    return ok(res, data, data.status === 'success' ? 'Payment verified.' : 'Payment received and being verified.');
  }),
);

paymentsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 300) : null;
    return ok(res, await cancelCheckout(currentUserId(req), idParam(req), reason));
  }),
);

paymentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    return ok(res, await refreshPaymentForUser(currentUserId(req), idParam(req)));
  }),
);

/**
 * DEVELOPMENT ONLY (PAYMENT_GATEWAY=fake): simulate the customer completing or failing the
 * checkout. Runs through the exact same verification + settlement code as Razorpay.
 */
paymentsRouter.post(
  '/:id/simulate',
  asyncHandler(async (req, res) => {
    const gateway = getGateway();
    if (env.isProduction || !(gateway instanceof FakeGateway)) throw Errors.notFound();
    const outcome = req.body?.outcome === 'failure' ? 'failure' : 'success';
    const userId = currentUserId(req);
    const { db } = await import('../../db/knex.js');
    const payment = await db('payments').where({ id: idParam(req), user_id: userId }).first();
    if (!payment?.gateway_order_id) throw Errors.notFound('Payment not found.');
    const sim = gateway.simulatePayment(payment.gateway_order_id, outcome);
    if (outcome === 'failure') {
      await markAttemptFailed(payment.id, sim.payment);
      return ok(res, await refreshPaymentForUser(userId, payment.id));
    }
    const data = await verifyCheckout(userId, {
      paymentId: payment.id,
      gatewayOrderId: payment.gateway_order_id,
      gatewayPaymentId: sim.payment.id,
      signature: sim.signature,
    });
    return ok(res, data);
  }),
);

/** Razorpay webhook: raw body (for HMAC), no session, no CSRF. Mounted before JSON parsing. */
export const paymentWebhookRouter = Router();
paymentWebhookRouter.post(
  '/',
  express.raw({ type: '*/*', limit: '1mb' }),
  asyncHandler(async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const outcome = await handleWebhook(raw, req.get('x-razorpay-signature') ?? '', req.get('x-razorpay-event-id') ?? undefined);
    logger.info({ outcome }, 'Webhook handled');
    res.status(200).json({ success: true, message: outcome, data: null });
  }),
);
