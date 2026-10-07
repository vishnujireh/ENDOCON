import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Alert, ApiErrorAlert } from '../../components/ui/States';
import { AuthCard, authInput, authLabel, authSubmit } from '../../pages/AuthCard';
import { useReviewerAuth } from './ReviewerAuth';

const RESEND_SECONDS = 60;

/** Reviewer login: registered email → 6-digit code by email → portal. */
export function ReviewerLoginPage() {
  const { reviewer, requestCode, verifyCode } = useReviewerAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (reviewer) return <Navigate to="/reviewer" replace />;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(new Error('Enter your registered email address.'));
    setBusy(true);
    try {
      setNotice(await requestCode(email.trim()));
      setStep('code');
      setCode('');
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) return setError(new Error('Enter the 6-digit code from the email.'));
    setBusy(true);
    try {
      await verifyCode(email.trim(), code);
      navigate('/reviewer', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      crumb="Reviewer Login"
      tag="Abstract Review"
      icon={<ShieldCheck className="w-6 h-6" />}
      title="Reviewer Login"
      subtitle={step === 'email' ? 'Enter the email address registered with the organising team. We will send you a one-time login code.' : `Enter the 6-digit code sent to ${email.trim()}.`}
    >
      <ApiErrorAlert error={error} className="mb-5" />
      {step === 'email' ? (
        <form onSubmit={send} className="space-y-4" noValidate>
          <div>
            <label htmlFor="rv-email" className={authLabel}>
              Registered email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input id="rv-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@hospital.org" className={authInput} />
            </div>
          </div>
          <button type="submit" disabled={busy} className={authSubmit}>
            {busy ? (
              'Sending…'
            ) : (
              <>
                <span>Send login code</span>
                <ArrowRight className="w-4 h-4 text-[#d4af37]" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4" noValidate>
          {notice && <Alert tone="info">{notice} The code is valid for 10 minutes. Check your spam folder if it does not arrive.</Alert>}
          <div>
            <label htmlFor="rv-code" className={authLabel}>
              Login code
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="rv-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className={`${authInput} tracking-[0.5em] font-mono text-lg`}
                autoFocus
              />
            </div>
          </div>
          <button type="submit" disabled={busy} className={authSubmit}>
            {busy ? (
              'Verifying…'
            ) : (
              <>
                <span>Verify &amp; log in</span>
                <ArrowRight className="w-4 h-4 text-[#d4af37]" />
              </>
            )}
          </button>
          <div className="flex items-center justify-between text-xs pt-2">
            <button type="button" onClick={() => setStep('email')} className="font-semibold text-[#665e5d] hover:text-[#580c1e] underline cursor-pointer">
              Use a different email
            </button>
            <button type="button" disabled={wait > 0 || busy} onClick={() => void send()} className="font-semibold text-[#580c1e] hover:underline cursor-pointer disabled:text-[#8a8280] disabled:no-underline disabled:cursor-not-allowed">
              {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
      <p className="mt-8 pt-6 border-t border-black/[0.06] text-center text-[11px] text-[#665e5d]">Reviewer access is by invitation of the ENDOCON 2027 Scientific Committee.</p>
    </AuthCard>
  );
}
