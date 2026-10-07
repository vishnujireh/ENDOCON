import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { api } from '../../lib/api';

export function ResendButton({ userId, paymentId, compact }: { userId: number; paymentId?: number; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ label: string; error?: string } | null>(null);
  const resend = async () => {
    if (!window.confirm('Resend the registration confirmation email (with invoice) to this participant?')) return;
    setState('busy');
    try {
      const res = await api.post(`/admin/registrations/${userId}/resend-confirmation`, paymentId ? { paymentId } : {});
      const mail = res.emails?.[0];
      if (mail && mail.status !== 'sent' && mail.status !== 'queued') {
        setResult({ label: 'Not sent – retry', error: mail.error });
        setState('error');
      } else {
        setResult({ label: mail?.status === 'sent' ? 'Sent' : 'Queued' });
        setState('done');
      }
    } catch (err) {
      setResult({ label: 'Failed – retry', error: err instanceof Error ? err.message : undefined });
      setState('error');
    }
  };
  return (
    <button onClick={resend} disabled={state === 'busy' || state === 'done'} className="inline-flex items-center gap-1 font-bold text-[#580c1e] hover:underline disabled:opacity-60 cursor-pointer text-xs" title={result?.error ?? 'Resend confirmation email'}>
      <Mail className="w-3.5 h-3.5" />
      {state === 'done' || state === 'error' ? result?.label : state === 'busy' ? 'Sending…' : compact ? 'Resend' : 'Resend confirmation email'}
    </button>
  );
}
