/**
 * Payment gateway abstraction. The rest of the app only talks to this interface, so switching
 * gateway means writing one adapter.
 */

export type GatewayPaymentStatus = 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';

export interface GatewayPayment {
  id: string;
  orderId: string | null;
  status: GatewayPaymentStatus;
  amountMinor: number;
  currency: string;
  method: string | null;
  amountRefundedMinor: number;
  errorCode: string | null;
  errorDescription: string | null;
  raw?: unknown;
}

export interface GatewayOrder {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface WebhookEvent {
  eventId: string | null;
  type: string;
  gatewayOrderId: string | null;
  payment: GatewayPayment | null;
  refund: { id: string; paymentId: string; amountMinor: number } | null;
}

export interface PaymentGateway {
  readonly name: 'razorpay' | 'fake';
  /** Public key id the browser needs to open checkout. Never the secret. */
  publicKey(): string;
  createOrder(input: { amountMinor: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<GatewayOrder>;
  /** Checkout-handler signature: HMAC(order_id|payment_id, key_secret). */
  verifyCheckoutSignature(input: { gatewayOrderId: string; gatewayPaymentId: string; signature: string }): boolean;
  fetchPayment(gatewayPaymentId: string): Promise<GatewayPayment>;
  fetchOrderPayments(gatewayOrderId: string): Promise<GatewayPayment[]>;
  capturePayment(gatewayPaymentId: string, amountMinor: number, currency: string): Promise<GatewayPayment>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  parseWebhook(body: unknown, headers: { eventId?: string }): WebhookEvent;
}
