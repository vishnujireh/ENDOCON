import { hmacSha256Hex, safeEqual } from '../../../lib/crypto.js';
import { AppError } from '../../../lib/errors.js';
import { logger } from '../../../lib/logger.js';
import type { GatewayOrder, GatewayPayment, PaymentGateway, WebhookEvent } from './gateway.js';

const API = 'https://api.razorpay.com/v1';

interface RazorpayPaymentEntity {
  id: string;
  order_id: string | null;
  status: string;
  amount: number;
  currency: string;
  method?: string | null;
  amount_refunded?: number;
  error_code?: string | null;
  error_description?: string | null;
}

function mapPayment(p: RazorpayPaymentEntity): GatewayPayment {
  const status = (['created', 'authorized', 'captured', 'refunded', 'failed'] as const).includes(p.status as never)
    ? (p.status as GatewayPayment['status'])
    : 'created';
  return {
    id: p.id,
    orderId: p.order_id ?? null,
    status,
    amountMinor: Number(p.amount),
    currency: p.currency,
    method: p.method ?? null,
    amountRefundedMinor: Number(p.amount_refunded ?? 0),
    errorCode: p.error_code ?? null,
    errorDescription: p.error_description ?? null,
  };
}

/**
 * Razorpay Standard Checkout + Orders API + Webhooks.
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */
export class RazorpayGateway implements PaymentGateway {
  readonly name = 'razorpay' as const;

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
  ) {}

  publicKey(): string {
    return this.keyId;
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!this.keyId || !this.keySecret) {
      throw new AppError(503, 'PAYMENT_GATEWAY_NOT_CONFIGURED', 'Online payment is temporarily unavailable. Please try again later.');
    }
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => ({}))) as T & { error?: { code?: string; description?: string } };
      if (!res.ok) {
        logger.error({ status: res.status, path, error: json?.error }, 'Razorpay API error');
        throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'The payment gateway could not process the request. Please try again.');
      }
      return json;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err, path }, 'Razorpay API unreachable');
      throw new AppError(502, 'PAYMENT_GATEWAY_UNREACHABLE', 'The payment gateway is not reachable right now. Please try again.');
    } finally {
      clearTimeout(timer);
    }
  }

  async createOrder(input: { amountMinor: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<GatewayOrder> {
    const o = await this.call<{ id: string; amount: number; currency: string; status: string }>('POST', '/orders', {
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    });
    return { id: o.id, amountMinor: o.amount, currency: o.currency, status: o.status };
  }

  verifyCheckoutSignature(input: { gatewayOrderId: string; gatewayPaymentId: string; signature: string }): boolean {
    if (!this.keySecret) return false;
    const expected = hmacSha256Hex(this.keySecret, `${input.gatewayOrderId}|${input.gatewayPaymentId}`);
    return safeEqual(expected, input.signature);
  }

  async fetchPayment(gatewayPaymentId: string): Promise<GatewayPayment> {
    return mapPayment(await this.call<RazorpayPaymentEntity>('GET', `/payments/${encodeURIComponent(gatewayPaymentId)}`));
  }

  async fetchOrderPayments(gatewayOrderId: string): Promise<GatewayPayment[]> {
    const res = await this.call<{ items: RazorpayPaymentEntity[] }>('GET', `/orders/${encodeURIComponent(gatewayOrderId)}/payments`);
    return (res.items ?? []).map(mapPayment);
  }

  async capturePayment(gatewayPaymentId: string, amountMinor: number, currency: string): Promise<GatewayPayment> {
    return mapPayment(
      await this.call<RazorpayPaymentEntity>('POST', `/payments/${encodeURIComponent(gatewayPaymentId)}/capture`, {
        amount: amountMinor,
        currency,
      }),
    );
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret || !signature) return false;
    return safeEqual(hmacSha256Hex(this.webhookSecret, rawBody), signature);
  }

  parseWebhook(body: unknown, headers: { eventId?: string }): WebhookEvent {
    const b = body as {
      event?: string;
      payload?: {
        payment?: { entity?: RazorpayPaymentEntity };
        order?: { entity?: { id: string } };
        refund?: { entity?: { id: string; payment_id: string; amount: number } };
      };
    };
    const payment = b.payload?.payment?.entity ? mapPayment(b.payload.payment.entity) : null;
    const refundEntity = b.payload?.refund?.entity;
    return {
      eventId: headers.eventId ?? null,
      type: b.event ?? 'unknown',
      gatewayOrderId: b.payload?.order?.entity?.id ?? payment?.orderId ?? null,
      payment,
      refund: refundEntity ? { id: refundEntity.id, paymentId: refundEntity.payment_id, amountMinor: Number(refundEntity.amount) } : null,
    };
  }
}
