import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiErrorAlert } from '../components/ui/States';
import { DASHBOARD_PATH, safeNext, withNext } from '../lib/nav';
import { AuthCard, authInput, authLabel, authSubmit } from './AuthCard';

/** Delegate login (and, with admin=true, the separate admin login). */
export const LoginPage: React.FC<{ admin?: boolean }> = ({ admin = false }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // ?next= (e.g. back to the abstract form) or the protected page that sent the visitor here.
  const next = safeNext(params.get('next'));
  const from = next ?? (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(new Error('Please enter your email address and password.'));
      return;
    }
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password, { admin });
      // The admin login is shown in place of the admin page that was requested (/admin, /admin/abstracts …):
      // once signed in, that page renders by itself, so there is nowhere to navigate.
      if (admin && user.role === 'admin') return;
      navigate(from ?? (user.role === 'admin' ? '/admin' : DASHBOARD_PATH), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      crumb={admin ? 'Admin Login' : 'Delegate Login'}
      tag={admin ? 'Organizer Access' : 'Portal Access'}
      icon={admin ? <ShieldCheck className="w-6 h-6" /> : undefined}
      title={admin ? 'Admin Login' : 'Delegate Login'}
      subtitle={admin ? 'Restricted to the ENDOCON 2027 organising team.' : 'Access your ENDOCON 2027 registration, payments, invoices and abstracts.'}
    >
      <ApiErrorAlert error={error} className="mb-5" />
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className={authLabel}>
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={admin ? "name@organisation.org" : "doctor@hospital.org"} className={authInput} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[#4e4443]">
              Password
            </label>
            {!admin && (
              <Link to="/forgot-password" className="text-xs font-semibold text-[#580c1e] hover:text-[#781029] hover:underline">
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={`${authInput} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#665e5d] hover:text-[#1a1918] cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={submitting} className={authSubmit}>
          {submitting ? (
            <span>Signing in…</span>
          ) : (
            <>
              <span>Submit</span>
              <ArrowRight className="w-4 h-4 text-[#d4af37]" />
            </>
          )}
        </button>
      </form>

      {!admin && (
        <div className="mt-8 pt-6 border-t border-black/[0.06] text-center">
          {/* One sign-up for everyone; afterwards the visitor continues where they came from
              (conference registration, the abstract form, …). */}
          <p className="text-xs text-[#665e5d]">
            New to ENDOCON 2027?{' '}
            <Link to={withNext('/create-account', from)} className="font-bold text-[#580c1e] hover:text-[#781029] hover:underline inline-flex items-center gap-0.5 ml-1">
              Create an account <ArrowRight className="w-3 h-3 text-[#580c1e]" />
            </Link>
          </p>
          {/* <p className="text-[11px] text-[#665e5d] mt-3">
            Organising team?{' '}
            <Link to="/admin" className="font-semibold text-[#580c1e] hover:underline">
              Admin login
            </Link>
          </p> */}
        </div>
      )}
    </AuthCard>
  );
};
