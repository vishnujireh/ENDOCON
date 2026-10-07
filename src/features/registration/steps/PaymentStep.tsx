import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, FlaskConical, ShieldCheck } from 'lucide-react';
import { api } from '../../../lib/api';
import type { CheckoutSession, PaymentDetail, RegistrationStatus } from '../../../api/types';
import { money, newIdempotencyKey } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { Alert, ApiErrorAlert, EmptyState, LoadingState } from '../../../components/ui/States';
import { useCart } from '../CartContext';
import { keys } from '../hooks';
import { loadRazorpay, openRazorpay } from '../razorpay';
import { QuoteError, useQuote } from './SummaryStep';

export function PaymentStep({ status, goTo, onBack }: { status: RegistrationStatus; goTo: (s: string) => void; onBack: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { clear } = useCart();
  const { data: quote, isLoading, error: quoteError, cart, empty } = useQuote(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [attemptNote, setAttemptNote] = useState('');
  const [fakeSession, setFakeSession] = useState<CheckoutSession | null>(null);
  // One idempotency key per cart: double-clicks / retries reuse the same checkout on the server.
  const keyRef = useRef<{ cart: string; key: string } | null>(null);

  const finish = async (paymentId: number, success: boolean) => {
    if (success) clear();
    await qc.invalidateQueries({ queryKey: keys.status });
    navigate(`/payment/${paymentId}`, { replace: true });
  };

  const pay = async () => {
    setError(null);
    setAttemptNote('');
    setBusy(true);
    const cartJson = JSON.stringify(cart);
    if (!keyRef.current || keyRef.current.cart !== cartJson) keyRef.current = { cart: cartJson, key: newIdempotencyKey() };
    try {
      const { data: session } = await api.post<CheckoutSession>('/payments/checkout', { cart }, { 'Idempotency-Key': keyRef.current.key });
      if (session.gateway === 'fake') {
        setFakeSession(session);
        setBusy(false);
        return;
      }
      await loadRazorpay();
      openRazorpay({
        key: session.keyId,
        amount: session.amountMinor,
        currency: session.currency,
        name: session.merchantName,
        description: session.description,
        orderId: session.gatewayOrderId,
        prefill: session.prefill,
        notes: { payment_id: String(session.paymentId) },
        onSuccess: async (resp) => {
          setBusy(true);
          try {
            const { data } = await api.post<PaymentDetail>(`/payments/${session.paymentId}/verify`, resp);
            await finish(session.paymentId, data.status === 'success');
          } catch {
            // Verification call failed (e.g. network). The server will still confirm via webhook /
            // reconciliation – the result page polls for the final status.
            await finish(session.paymentId, false);
          }
        },
        onDismiss: async () => {
          try {
            await api.post(`/payments/${session.paymentId}/cancel`, { reason: 'Checkout closed by user' });
          } finally {
            keyRef.current = null;
            await finish(session.paymentId, false);
          }
        },
        onFailedAttempt: (d) => setAttemptNote(`${d} You can try another payment method in the payment window.`),
      });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const simulate = async (outcome: 'success' | 'failure') => {
    if (!fakeSession) return;
    setBusy(true);
    try {
      const { data } = await api.post<PaymentDetail>(`/payments/${fakeSession.paymentId}/simulate`, { outcome });
      keyRef.current = null;
      await finish(fakeSession.paymentId, data.status === 'success');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  if (empty) {
    return (
      <EmptyState title="Nothing to pay for">
        <Button variant="secondary" onClick={() => goTo('conference')}>
          Choose items
        </Button>
      </EmptyState>
    );
  }
  if (isLoading) return <LoadingState label="Preparing payment…" />;
  if (quoteError) return <QuoteError error={quoteError} goTo={goTo} />;
  if (!quote) return null;

  return (
    <div className="space-y-6">
      <div className="text-center p-8 rounded-3xl bg-[#faf8f5] border border-black/[0.06]">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#665e5d]">Total Amount</span>
        <p className="font-serif text-4xl font-bold text-[#580c1e] mt-1">{money(quote.totalMinor)}</p>
        <p className="text-xs text-[#665e5d] mt-1">
          {money(quote.subtotalMinor)} + GST {money(quote.gstMinor)} · {quote.lines.length} item{quote.lines.length > 1 ? 's' : ''}
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={pay} loading={busy} disabled={!!fakeSession} icon={<CreditCard className="w-4 h-4" />} className="px-10">
            Pay Now
          </Button>
        </div>
        <p className="text-[11px] text-[#665e5d] mt-4 inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Secure payment via Razorpay (UPI, cards, net banking). Your registration is confirmed only after the payment is verified.
        </p>
      </div>

      <ApiErrorAlert error={error} />
      {attemptNote && <Alert tone="warning">{attemptNote}</Alert>}

      {fakeSession && (
        <Alert tone="warning">
          <p className="font-bold flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4" /> Test mode (no real payment gateway configured)
          </p>
          <p className="mt-1">Simulate the outcome of checkout #{fakeSession.paymentId}. This runs the same server-side verification as Razorpay.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => simulate('success')} loading={busy}>
              Simulate successful payment
            </Button>
            <Button size="sm" variant="secondary" onClick={() => simulate('failure')} disabled={busy}>
              Simulate failure
            </Button>
          </div>
        </Alert>
      )}

      <div className="flex justify-start pt-2 border-t border-black/[0.06]">
        <Button variant="secondary" onClick={onBack} disabled={busy} icon={<ArrowLeft className="w-4 h-4" />}>
          Back to summary
        </Button>
      </div>
    </div>
  );
}
