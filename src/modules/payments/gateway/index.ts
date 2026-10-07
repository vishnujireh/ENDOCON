import { env } from '../../../config/env.js';
import { FakeGateway } from './fake.gateway.js';
import type { PaymentGateway } from './gateway.js';
import { RazorpayGateway } from './razorpay.gateway.js';

let instance: PaymentGateway | null = null;

export function getGateway(): PaymentGateway {
  if (!instance) {
    instance =
      env.PAYMENT_GATEWAY === 'fake' && !env.isProduction
        ? new FakeGateway()
        : new RazorpayGateway(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET);
  }
  return instance;
}

/** Tests only. */
export function setGateway(g: PaymentGateway): void {
  instance = g;
}

export type { PaymentGateway } from './gateway.js';
