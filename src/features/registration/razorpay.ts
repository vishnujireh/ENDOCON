/** Loads Razorpay Standard Checkout on demand. */
const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loading: Promise<void> | null = null;

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (resp: { error: { code: string; description: string; reason?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load the payment window. Please check your connection and try again.'));
    };
    document.body.appendChild(s);
  });
  return loading;
}

export function openRazorpay(options: {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  orderId: string;
  prefill: { name: string; email: string; contact: string };
  notes?: Record<string, string>;
  onSuccess: (r: RazorpaySuccess) => void;
  onDismiss: () => void;
  onFailedAttempt?: (description: string) => void;
}): void {
  if (!window.Razorpay) throw new Error('Payment window not loaded.');
  const rzp = new window.Razorpay({
    key: options.key,
    amount: options.amount,
    currency: options.currency,
    name: options.name,
    description: options.description,
    order_id: options.orderId,
    prefill: options.prefill,
    notes: options.notes,
    theme: { color: '#580c1e' },
    handler: options.onSuccess,
    modal: { ondismiss: options.onDismiss, confirm_close: true },
    retry: { enabled: true },
    timeout: 900, // close the checkout after 15 min so an old window cannot pay a stale price
  });
  // A failed attempt keeps the modal open so the customer can retry; the final outcome is
  // reported by handler / ondismiss and always verified on the server.
  rzp.on('payment.failed', (resp) => options.onFailedAttempt?.(resp.error?.description ?? 'Payment failed'));
  rzp.open();
}
