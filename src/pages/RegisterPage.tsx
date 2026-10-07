import React, { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { Profile } from '../api/types';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Field';
import { ApiErrorAlert, fieldErrors } from '../components/ui/States';
import { keys } from '../features/registration/hooks';
import { ResumeRedirect } from '../features/registration/ResumeRedirect';
import { RegistrationShell, STEP_ORDER, type ShellStep } from '../features/registration/RegistrationShell';
import {
  emptyPersonalForm,
  PersonalFields,
  personalPayload,
  validatePersonal,
  type PersonalForm,
} from '../features/registration/steps/PersonalFields';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

/**
 * Public registration page = Step 1 of 6. Creates the login account and saves the
 * personal / professional details in one go, then continues to Step 2 (Conference).
 */
export const RegisterPage: React.FC = () => {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<PersonalForm>(emptyPersonalForm);
  const [accountCreated, setAccountCreated] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set before calling register() so the login it performs doesn't trigger the redirect below.
  const signingUp = useRef(false);

  // Already logged in (and not in the middle of this sign-up) → continue in the wizard.
  if (user && !accountCreated && !signingUp.current) {
    return user.role === 'admin' ? <Navigate to="/admin" replace /> : <ResumeRedirect />;
  }

  const validate = () => {
    const e = validatePersonal(form);
    if (!accountCreated) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email address.';
      if (!PASSWORD_RULE.test(password)) e.password = 'At least 8 characters with a letter and a number.';
      if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    }
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
    try {
      if (!accountCreated) {
        signingUp.current = true;
        await register({
          fullName: form.fullName.trim(),
          email: email.trim(),
          phoneCountryCode: form.phoneCountryCode.trim(),
          phoneNumber: form.phoneNumber,
          password,
        });
        setAccountCreated(true);
      }
      const res = await api.put<Profile>('/profile', personalPayload(form));
      qc.setQueryData(keys.profile, res.data);
      await qc.invalidateQueries({ queryKey: keys.status });
      navigate('/registration/wizard/conference', { replace: true });
    } catch (err) {
      if (!accountCreated && !user) signingUp.current = false;
      setError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const errs: Record<string, string | undefined> = { ...fieldErrors(error), ...local };
  const steps: ShellStep[] = STEP_ORDER.map((key) => ({ key, state: key === 'personal' ? 'current' : 'upcoming' }));

  return (
    <RegistrationShell
      current="personal"
      steps={steps}
      tag="New Registration"
      intro={
        <p className="text-sm text-[#4e4443] text-center">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-[#580c1e] hover:underline">
            Log in to continue
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <ApiErrorAlert error={error} />
        {accountCreated && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4" /> Account created for <span className="font-semibold">{email}</span>. Please correct the highlighted details below to continue.
          </div>
        )}

        <PersonalFields
          form={form}
          setForm={setForm}
          errs={errs}
          email={
            <Field label="Email Address" name="email" required error={errs.email}>
              <TextInput
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                invalid={!!errs.email}
                disabled={accountCreated}
                placeholder="doctor@hospital.org"
              />
            </Field>
          }
          passwords={
            accountCreated ? null : (
              <>
                <Field label="Create Password" name="password" required error={errs.password}>
                  <div className="relative">
                    <TextInput
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      invalid={!!errs.password}
                      placeholder="Min. 8 characters, letters & numbers"
                      className="pr-10"
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
                </Field>
                <Field label="Confirm Password" name="confirmPassword" required error={errs.confirmPassword}>
                  <TextInput
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    invalid={!!errs.confirmPassword}
                    placeholder="Re-enter password"
                  />
                </Field>
              </>
            )
          }
        />

        <div className="flex justify-end pt-5 border-t border-black/[0.06]">
          <Button type="submit" loading={submitting} icon={<ArrowRight className="w-4 h-4" />}>
            {accountCreated ? 'Save & Continue' : 'Create Account & Continue'}
          </Button>
        </div>
      </form>
    </RegistrationShell>
  );
};
