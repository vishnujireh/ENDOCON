import React, { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, KeyRound, Lock } from 'lucide-react';
import { api } from '../lib/api';
import { ApiErrorAlert, fieldErrors } from '../components/ui/States';
import { AuthCard, authInput, authLabel, authSubmit } from './AuthCard';

export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  // The emailed link carries the token after "#" (/reset-password#token=…) so it never reaches
  // server logs; "?token=" is still accepted for older links.
  const [token] = useState(() => new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? params.get('token') ?? '');
  React.useEffect(() => {
    // Drop the token from the address bar and history once it has been read.
    if (window.location.hash || window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [local, setLocal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocal('');
    setError(null);
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password)) return setLocal('Password must be at least 8 characters with a letter and a number.');
    if (password !== confirm) return setLocal('Passwords do not match.');
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard crumb="Reset Password" tag="Security" icon={<KeyRound className="w-6 h-6" />} title="Set a New Password" subtitle="Choose a new password for your ENDOCON 2027 account.">
      {!token ? (
        <ApiErrorAlert error={new Error('This reset link is incomplete. Please request a new one.')} />
      ) : done ? (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-bold mb-1">Password updated</p>
            <p>For your security, all devices were signed out. Please log in with your new password.</p>
            <Link to="/login" className="inline-block mt-3 font-bold text-[#580c1e] underline">
              Go to login
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ApiErrorAlert error={error ?? (local ? new Error(local) : null)} className="mb-5" />
          {fieldErrors(error).password && <p className="text-[11px] text-red-700 mb-3">{fieldErrors(error).password}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className={authLabel}>
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={authInput} />
              </div>
            </div>
            <div>
              <label htmlFor="confirm" className={authLabel}>
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={authInput} />
              </div>
            </div>
            <button type="submit" disabled={submitting} className={authSubmit}>
              {submitting ? (
                'Saving…'
              ) : (
                <>
                  Update Password <ArrowRight className="w-4 h-4 text-[#d4af37]" />
                </>
              )}
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-[#665e5d]">
            Link expired?{' '}
            <Link to="/forgot-password" className="font-bold text-[#580c1e] hover:underline">
              Request a new one
            </Link>
          </p>
        </>
      )}
    </AuthCard>
  );
};
