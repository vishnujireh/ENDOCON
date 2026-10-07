import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Catches rendering errors so a bug in one page shows a message instead of a blank screen.
 * In development the technical error is shown to make it easy to report.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ENDOCON] Page crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="max-w-xl mx-auto my-16 px-4">
        <div className="bg-white rounded-2xl border border-red-200 p-6 sm:p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-700 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-semibold text-[#1a1918]">Something went wrong on this page</h1>
          <p className="text-sm text-[#665e5d] mt-1">Your saved details are safe. Please reload the page and try again.</p>
          {import.meta.env.DEV && (
            <pre className="mt-4 text-left text-[11px] leading-snug bg-[#faf8f5] border border-black/[0.06] rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap text-red-800">
              {String(error?.stack ?? error)}
            </pre>
          )}
          <div className="mt-5 flex justify-center gap-3">
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#580c1e] text-[#fef3c7] cursor-pointer">
              Reload page
            </button>
            <a href="/registration" onClick={() => this.setState({ error: null })} className="px-5 py-2.5 rounded-full text-xs font-bold border border-black/15 text-[#1a1918]">
              My Registration
            </a>
          </div>
        </div>
      </div>
    );
  }
}
