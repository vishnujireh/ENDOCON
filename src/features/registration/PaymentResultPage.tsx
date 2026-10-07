import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Download, TriangleAlert, XCircle } from 'lucide-react';
import { api, apiUrl } from '../../lib/api';
import type { PaymentDetail } from '../../api/types';
import { dateTime, money } from '../../lib/format';
import { MoneyTable } from '../../components/ui/MoneyTable';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { keys } from './hooks';

const OPEN = ['created', 'pending'];

/**
 * Shows the server-verified outcome of a payment. Never trusts the redirect itself: it polls the
 * API (which also asks the gateway) until the status is final.
 */
import { PortalPage } from './RegistrationShell';

export function PaymentResultPage() {
  const { paymentId } = useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => api.get<PaymentDetail>(`/payments/${paymentId}`),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d || !OPEN.includes(d.status)) return false;
      return query.state.dataUpdateCount < 40 ? 3000 : false; // ~2 minutes of polling
    },
  });

  React.useEffect(() => {
    if (q.data && !OPEN.includes(q.data.status)) void qc.invalidateQueries({ queryKey: keys.status });
  }, [q.data, qc]);

  if (q.isLoading) return <LoadingState label="Checking your payment…" />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data;

  const summary = <MoneyTable lines={p.items} subtotalMinor={p.subtotalMinor} gstMinor={p.gstMinor} totalMinor={p.totalMinor} totalLabel="Total Paid" />;

  let body: React.ReactNode;
  if (p.status === 'success' || p.status === 'partially_refunded') {
    body = (
      <>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="font-serif text-3xl font-bold">{p.purpose === 'registration' ? 'Registration Successful' : 'Payment Successful'}</h1>
          <p className="text-xs text-[#665e5d] mt-1">A confirmation email with your GST invoice has been sent to your registered email address.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-center">
          <div className="p-3 rounded-2xl bg-[#faf8f5]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] block">Order ID</span>
            <span className="font-mono font-bold text-lg text-[#580c1e]">{p.orderNumber}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#faf8f5]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] block">Payment ID</span>
            <span className="font-mono text-sm break-all">{p.gatewayPaymentId}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#faf8f5]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] block">Paid on</span>
            <span className="text-sm">{dateTime(p.paidAt)}</span>
          </div>
        </div>
        {summary}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {p.invoice && (
            <a href={apiUrl(`/invoices/${p.invoice.id}/pdf?download=1`)} className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7]">
              <Download className="w-4 h-4" /> Download Invoice ({p.invoice.number})
            </a>
          )}
          <Link to="/registration" className="inline-flex items-center px-6 py-3 rounded-full text-xs font-bold bg-white border border-black/15">
            Go to my registration
          </Link>
        </div>
      </>
    );
  } else if (OPEN.includes(p.status)) {
    body = (
      <div className="text-center py-6">
        <Clock className="w-10 h-10 text-amber-600 mx-auto mb-3 animate-pulse" />
        <h1 className="font-serif text-2xl font-bold">Confirming your payment…</h1>
        <p className="text-xs text-[#665e5d] mt-2 max-w-md mx-auto">
          We are waiting for confirmation from the payment gateway. This page updates automatically. If you closed the payment window without paying, you can return to your
          registration and try again.
        </p>
        <div className="mt-5 max-w-lg mx-auto text-left">{summary}</div>
        <Link to="/registration" className="inline-block mt-6 text-xs font-bold text-[#580c1e] underline">
          Back to my registration
        </Link>
      </div>
    );
  } else if (p.status === 'conflict') {
    body = (
      <div className="text-center py-6">
        <TriangleAlert className="w-10 h-10 text-orange-600 mx-auto mb-3" />
        <h1 className="font-serif text-2xl font-bold">Payment received – needs review</h1>
        <p className="text-sm text-[#4e4443] mt-2 max-w-md mx-auto">
          We received your payment{p.gatewayPaymentId ? ` (${p.gatewayPaymentId})` : ''}, but some items were no longer available (for example, already purchased or fully booked). The organising team has been
          notified and will contact you; any amount not used will be refunded.
        </p>
        <Link to="/registration" className="inline-block mt-6 text-xs font-bold text-[#580c1e] underline">
          Back to my registration
        </Link>
      </div>
    );
  } else {
    body = (
      <div className="text-center py-6">
        <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
        <h1 className="font-serif text-2xl font-bold text-red-800">Payment failed.</h1>
        <p className="text-sm text-[#1a1918] mt-2">Your registration has not been confirmed.</p>
        <p className="text-sm text-[#1a1918]">Please try again.</p>
        {p.failureReason && <p className="text-xs text-[#665e5d] mt-3">Reason: {p.failureReason}</p>}
        <p className="text-[11px] text-[#665e5d] mt-2">If money was debited, it will be confirmed automatically or refunded by your bank.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/registration/wizard/summary" className="inline-flex items-center px-6 py-3 rounded-full text-xs font-bold bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7]">
            Try again ({money(p.totalMinor)})
          </Link>
          <Link to="/registration" className="inline-flex items-center px-6 py-3 rounded-full text-xs font-bold bg-white border border-black/15">
            My registration
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PortalPage title="Payment">
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_10px_30px_-12px_rgba(88,12,30,0.15)] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#580c1e] via-[#9b2c44] to-[#c89e37]" aria-hidden />
        <div className="p-6 sm:p-8">{body}</div>
      </div>
    </PortalPage>
  );
}
