import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { api } from '../lib/api';
import { ApiErrorAlert } from '../components/ui/States';
import { AuthCard, authInput, authLabel, authSubmit } from './AuthCard';

/** Always shows the same confirmation, whether or not the email has an account. */
export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sentMessage, setSentMessage] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() });
      setSentMessage(res.message);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard crumb="Forgot Password" tag="Security" icon={<KeyRound className="w-6 h-6" />} title="Forgot Password?" subtitle="Enter the email address you registered with and we will email you a reset link.">
      <ApiErrorAlert error={error} className="mb-5" />
      {sentMessage ? (
        <div className="mb-6 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 space-y-1.5">
              <p className="font-bold">Check your email</p>
              <p>{sentMessage}</p>
              <p>The link is valid for 30 minutes and can be used once.</p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className={authLabel}>
              Registered Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#665e5d] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@hospital.org" className={authInput} />
            </div>
          </div>
          <button type="submit" disabled={submitting} className={authSubmit}>
            {submitting ? (
              'Sending…'
            ) : (
              <>
                Send Reset Link <ArrowRight className="w-4 h-4 text-[#d4af37]" />
              </>
            )}
          </button>
        </form>
      )}
      <div className="mt-8 pt-6 border-t border-black/[0.06] text-center">
        <Link to="/login" className="text-xs font-bold text-[#580c1e] hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to login
        </Link>
      </div>
    </AuthCard>
  );
};
