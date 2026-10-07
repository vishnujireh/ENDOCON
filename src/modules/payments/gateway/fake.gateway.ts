import { hmacSha256Hex, randomToken, safeEqual } from '../../../lib/crypto.js';
import { AppError } from '../../../lib/errors.js';
import type { GatewayOrder, GatewayPayment, PaymentGateway, WebhookEvent } from './gateway.js';

/**
 * In-process gateway for local development and automated tests. Behaves like Razorpay
 * (orders, payments, signatures, webhooks) without network access. Refused in production.
 */
export class FakeGateway implements PaymentGateway {
  readonly name = 'fake' as const;
  readonly secret = 'fake_key_secret';
  readonly webhookSecret = 'fake_webhook_secret';
  orders = new Map<string, GatewayOrder>();
  payments = new Map<string, GatewayPayment>();
  /** When true, orders are created but capture stays at "authorized" (manual capture mode). */
  autoCapture = true;
  failNextCreateOrder = false;

  publicKey(): string {
    return 'rzp_test_fake';
  }

  async createOrder(input: { amountMinor: number; currency: string }): Promise<GatewayOrder> {
    if (this.failNextCreateOrder) {
      this.failNextCreateOrder = false;
      throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'The payment gateway could not process the request. Please try again.');
    }
    const order: GatewayOrder = { id: `order_fake_${randomToken(9)}`, amountMinor: input.amountMinor, currency: input.currency, status: 'created' };
    this.orders.set(order.id, order);
    return order;
  }

  /** Simulate the customer paying (or failing) in the checkout modal. */
  simulatePayment(gatewayOrderId: string, outcome: 'success' | 'failure', overrides: Partial<GatewayPayment> = {}) {
    const order = this.orders.get(gatewayOrderId);
    if (!order) throw new Error('Unknown fake order');
    const payment: GatewayPayment = {
      id: `pay_fake_${randomToken(9)}`,
      orderId: gatewayOrderId,
      status: outcome === 'success' ? (this.autoCapture ? 'captured' : 'authorized') : 'failed',
      amountMinor: order.amountMinor,
      currency: order.currency,
      method: 'upi',
      amountRefundedMinor: 0,
      errorCode: outcome === 'failure' ? 'BAD_REQUEST_ERROR' : null,
      errorDescription: outcome === 'failure' ? 'Payment was declined by the bank (simulated).' : null,
      ...overrides,
    };
    this.payments.set(payment.id, payment);
    if (payment.status === 'captured') order.status = 'paid';
    const signature = hmacSha256Hex(this.secret, `${gatewayOrderId}|${payment.id}`);
    return { payment, signature };
  }

  verifyCheckoutSignature(input: { gatewayOrderId: string; gatewayPaymentId: string; signature: string }): boolean {
    return safeEqual(hmacSha256Hex(this.secret, `${input.gatewayOrderId}|${input.gatewayPaymentId}`), input.signature);
  }

  async fetchPayment(id: string): Promise<GatewayPayment> {
    const p = this.payments.get(id);
    if (!p) throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'Unknown payment');
    return { ...p };
  }

  async fetchOrderPayments(orderId: string): Promise<GatewayPayment[]> {
    return [...this.payments.values()].filter((p) => p.orderId === orderId).map((p) => ({ ...p }));
  }

  async capturePayment(id: string, amountMinor: number): Promise<GatewayPayment> {
    const p = this.payments.get(id);
    if (!p || p.status !== 'authorized' || p.amountMinor !== amountMinor) throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'Cannot capture');
    p.status = 'captured';
    return { ...p };
  }

  refund(id: string, amountMinor: number): void {
    const p = this.payments.get(id);
    if (!p) throw new Error('Unknown payment');
    p.amountRefundedMinor += amountMinor;
    if (p.amountRefundedMinor >= p.amountMinor) p.status = 'refunded';
  }

  signWebhook(rawBody: string): string {
    return hmacSha256Hex(this.webhookSecret, rawBody);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    return !!signature && safeEqual(hmacSha256Hex(this.webhookSecret, rawBody), signature);
  }

  parseWebhook(body: unknown, headers: { eventId?: string }): WebhookEvent {
    const b = body as {
      event?: string;
      payload?: { payment?: { entity?: GatewayPayment & { order_id?: string } }; refund?: { entity?: { id: string; payment_id: string; amount: number } } };
    };
    const p = b.payload?.payment?.entity ?? null;
    const r = b.payload?.refund?.entity;
    return {
      eventId: headers.eventId ?? null,
      type: b.event ?? 'unknown',
      gatewayOrderId: p?.orderId ?? null,
      payment: p,
      refund: r ? { id: r.id, paymentId: r.payment_id, amountMinor: r.amount } : null,
    };
  }
}
