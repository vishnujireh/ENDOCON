import React from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react';
import { ApiError } from '../../lib/api';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#665e5d]" role="status">
      <Loader2 className="w-7 h-7 animate-spin text-[#580c1e]" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="py-14 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-red-600" />
      </div>
      <p className="text-sm text-[#1a1918] max-w-md">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-bold text-[#580c1e] underline cursor-pointer">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="py-12 flex flex-col items-center text-center gap-2 text-[#665e5d]">
      {icon}
      <p className="text-sm font-semibold text-[#1a1918]">{title}</p>
      {children && <div className="text-xs max-w-md">{children}</div>}
    </div>
  );
}

type Tone = 'error' | 'success' | 'info' | 'warning';
const tones: Record<Tone, { box: string; icon: React.ReactNode }> = {
  error: { box: 'bg-red-50 border-red-200 text-red-800', icon: <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /> },
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> },
  info: { box: 'bg-[#f7eed2]/60 border-[#c89e37]/30 text-[#5c4300]', icon: <Info className="w-4 h-4 text-[#c89e37] shrink-0 mt-0.5" /> },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /> },
};

export function Alert({ tone = 'info', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-3.5 border rounded-2xl text-xs flex items-start gap-2.5 ${tones[tone].box} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      {tones[tone].icon}
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** Shows an API error's message (field errors are shown next to fields). */
export function ApiErrorAlert({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const message = error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <Alert tone="error" className={className}>
      {message}
    </Alert>
  );
}

export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fieldErrors : {};
}
