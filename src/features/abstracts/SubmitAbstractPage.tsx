import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, CheckCircle2, X } from 'lucide-react';
import { dateTime } from '../../lib/format';
import type { AbstractCategory } from '../../api/types';
import { Alert, ErrorState, LoadingState } from '../../components/ui/States';
import { PortalPage } from '../registration/RegistrationShell';
import { useProfile } from '../registration/hooks';
import { AbstractForm, type AbstractSubmitResult } from './AbstractForm';
import { useSubmissionWindow } from './PublicAbstractForm';

const CATEGORIES: AbstractCategory[] = ['plenary', 'yia', 'oral', 'eposter', 'video'];

/**
 * /abstracts/submit – the abstract submission page (its own page, like conference registration).
 * `?category=video` pre-selects the presentation type (from the category guide on the home page).
 */
export function SubmitAbstractPage() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const requested = params.get('category') as AbstractCategory | null;
  const [preset] = useState(() => (requested && CATEGORIES.includes(requested) ? { key: 1, category: requested } : undefined));
  const [result, setResult] = useState<AbstractSubmitResult | null>(null);
  const [formKey, setFormKey] = useState(0);
  const windowQ = useSubmissionWindow();
  const profileQ = useProfile();

  if (windowQ.isLoading || profileQ.isLoading) return <LoadingState label="Loading the submission form…" />;
  if (profileQ.error || !profileQ.data) return <ErrorState error={profileQ.error} onRetry={() => profileQ.refetch()} />;
  const w = windowQ.data;

  return (
    <PortalPage title="Submit an Abstract" tag={w?.isOpen ? `Open until ${dateTime(w.closesAt)}` : 'Submissions closed'}>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link to="/my-abstracts" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#580c1e] hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> My Abstracts
        </Link>
        {/* <Link to="/?section=abstract" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#580c1e] hover:underline">
          <BookOpen className="w-3.5 h-3.5" /> Category guidelines
        </Link> */}
      </div>

      {result && (
        <div role="status" className="relative flex gap-3 p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-[#1a1918] pr-6">
            <p className="font-bold text-emerald-800">
              Abstract submitted – your abstract number is <span className="font-mono text-[#580c1e]">{result.abstractNumber}</span>
            </p>
            <p className="mt-0.5">“{result.title}”</p>
            <p className="text-xs text-[#58413f] mt-1.5">
              A confirmation has been emailed to {profileQ.data.email}. Follow its review under{' '}
              <Link to="/my-abstracts" className="font-semibold text-[#580c1e] underline">
                My Abstracts
              </Link>
              , or submit another abstract below.
            </p>
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => setResult(null)} className="absolute top-3 right-3 p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_10px_30px_-12px_rgba(88,12,30,0.15)] p-5 sm:p-8 md:p-10">
        {w && !w.isOpen ? (
          <Alert tone="warning">
            Abstract submission is closed. Submissions were accepted from {dateTime(w.opensAt)} to {dateTime(w.closesAt)}. Your abstracts and their decisions are under{' '}
            <Link to="/my-abstracts" className="font-semibold underline">
              My Abstracts
            </Link>
            .
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#faf8f5] border border-black/[0.06] px-4 py-3 text-xs text-[#4e4443] mb-8">
              <span>
                Submitting as <span className="font-semibold text-[#1a1918]">{profileQ.data.fullName || profileQ.data.email}</span> · {profileQ.data.email}
              </span>
              <span className="text-[#8a8280]">Fields marked * are required</span>
            </div>
            <AbstractForm
              key={formKey}
              profile={profileQ.data}
              preset={preset}
              formId="abstract-form"
              onSubmitted={async (r) => {
                setResult(r);
                setFormKey((k) => k + 1);
                await qc.invalidateQueries({ queryKey: ['my-abstracts'] });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}
      </div>
    </PortalPage>
  );
}
