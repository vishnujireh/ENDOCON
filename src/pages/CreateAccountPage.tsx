import React, { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User, UserPlus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiErrorAlert, fieldErrors } from '../components/ui/States';
import { PhoneInput, type PhoneValue } from '../components/ui/PhoneInput';
import { DASHBOARD_PATH, safeNext, withNext } from '../lib/nav';
import { AuthCard, authInput, authLabel, authSubmit } from './AuthCard';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

/**
 * The ONE sign-up page: name, email, mobile and password – a free account, not yet a conference
 * registration. Afterwards the visitor continues to `?next=` (conference registration Step 1, the
 * abstract form, …); without one, to My ENDOCON (choose conference registration or abstracts). Conference registration asks for the rest of
 * the personal details in Step 1, pre-filled with what was entered here.
 */
export const CreateAccountPage: React.FC = () => {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState<PhoneValue>({ countryCode: '+91', number: '', valid: null });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set before register() so the login it performs doesn't trigger the redirect below.
  const signingUp = useRef(false);

  if (user && !signingUp.current) return <Navigate to={user.role === 'admin' ? '/admin' : next ?? DASHBOARD_PATH} replace />;

  const validate = () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 2) e.fullName = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    if (!/^\d{6,15}$/.test(phone.number) || phone.valid === false) e.phoneNumber = 'Enter a valid mobile number.';
    if (!PASSWORD_RULE.test(password)) e.password = 'At least 8 characters with a letter and a number.';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    const e = validate();
    setLocal(e);
    if (Object.keys(e).length) {
      document.getElementById(Object.keys(e)[0])?.focus();
      return;
    }
    setSubmitting(true);
    signingUp.current = true;
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), phoneCountryCode: phone.countryCode, phoneNumber: phone.number, password });
      navigate(next ?? DASHBOARD_PATH, { replace: true });
    } catch (err) {
      signingUp.current = false;
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const errs: Record<string, string | undefined> = { ...fieldErrors(error), ...local };
  const err = (k: string) => errs[k] && <p className="text-[11px] text-red-700 mt-1" role="alert">{errs[k]}</p>;

  return (
    <AuthCard
      crumb="Create Account"
      tag="New Account"
      icon={<UserPlus className="w-6 h-6" />}
      title="Create an Account"
      subtitle="One free account for conference registration and abstract submission."
    >
      <ApiErrorAlert error={error} className="mb-5" />
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="fullName" className={authLabel}>Full Name</label>
          <div className="relative">
            <User className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input id="fullName" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={!!errs.fullName || undefined} placeholder="Dr. First Last" className={authInput} />
          </div>
          {err('fullName')}
        </div>

        <div>
          <label htmlFor="email" className={authLabel}>Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errs.email || undefined} placeholder="doctor@hospital.org" className={authInput} />
          </div>
          {err('email')}
        </div>

        <div>
          <label htmlFor="phoneNumber" className={authLabel}>Mobile Number</label>
          <PhoneInput name="phoneNumber" countryCode={phone.countryCode} number={phone.number} invalid={!!errs.phoneNumber} onChange={(v) => setPhone(v)} />
          {err('phoneNumber') || err('phoneCountryCode')}
        </div>

        <div>
          <label htmlFor="password" className={authLabel}>Create Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errs.password || undefined}
              placeholder="Min. 8 characters, letters & numbers"
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
          {err('password')}
        </div>

        <div>
          <label htmlFor="confirmPassword" className={authLabel}>Confirm Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={!!errs.confirmPassword || undefined}
              placeholder="Re-enter password"
              className={authInput}
            />
          </div>
          {err('confirmPassword')}
        </div>

        <button type="submit" disabled={submitting} className={authSubmit}>
          {submitting ? (
            <span>Creating account…</span>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4 text-[#d4af37]" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-black/[0.06] text-center">
        <p className="text-xs text-[#665e5d]">
          Already have an account?{' '}
          <Link to={withNext('/login', next)} className="font-bold text-[#580c1e] hover:text-[#781029] hover:underline inline-flex items-center gap-0.5 ml-1">
            Log in <ArrowRight className="w-3 h-3 text-[#580c1e]" />
          </Link>
        </p>
      </div>
    </AuthCard>
  );
};
