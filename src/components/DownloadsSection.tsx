import React, { useState } from 'react';
import { Award, Download, FileText, Loader2 } from 'lucide-react';

/**
 * Downloads – each card downloads its PDF directly. Put the files in
 * Endocon-frontend/public/downloads/ with exactly these names (they are copied into `dist` on build).
 * Until a file is there, the card says it will be available soon instead of downloading a wrong file.
 */
const DOCUMENTS = [
  {
    key: 'brochure',
    icon: FileText,
    title: 'Conference Brochure',
    text: 'Scientific program, committee roster and session schedules.',
    action: 'Download Brochure (PDF)',
    href: '/downloads/ENDOCON-2027-Brochure.pdf',
  },
  {
    key: 'cme',
    icon: Award,
    title: 'CME Certificates',
    text: 'Link will be active post conference.',
    action: 'Download Certificate (PDF)',
    href: '/downloads/ENDOCON-2027-CME-Certificate.pdf',
  },
] as const;

type Key = (typeof DOCUMENTS)[number]['key'];

export const DownloadsSection: React.FC = () => {
  const [busy, setBusy] = useState<Key | null>(null);
  const [unavailable, setUnavailable] = useState<Set<Key>>(new Set());

  const download = async (key: Key, href: string) => {
    setBusy(key);
    try {
      // The site answers unknown paths with the home page, so check that it really is a PDF.
      const res = await fetch(href, { method: 'HEAD', cache: 'no-store' });
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('pdf')) throw new Error('missing');
      const link = document.createElement('a');
      link.href = href;
      link.download = href.split('/').pop() ?? 'document.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setUnavailable((s) => new Set(s).add(key));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="downloads" className="py-24 md:py-32 bg-white px-4 sm:px-6 lg:px-8 border-b border-black/[0.04]">
      <div className="max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#c89e37] mb-2.5">
          <Download className="w-3.5 h-3.5 text-[#d4af37]" />
          Official Documents
        </div>
        <h2 className="font-serif text-3xl sm:text-5xl text-[#1a1918] font-bold tracking-tight mb-4">Downloads &amp; Documentation</h2>
        <p className="text-base text-[#665e5d] max-w-2xl mx-auto mb-16 font-light">
          Access official conference collateral, regulatory clearances for international travel, and digital certification verification.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap justify-center items-stretch gap-6">
          {DOCUMENTS.map(({ key, icon: Icon, title, text, action, href }) => {
            const missing = unavailable.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => download(key, href)}
                disabled={busy === key}
                className="w-full sm:w-80 bg-[#faf8f5] p-8 rounded-3xl border border-black/[0.06] shadow-[0_10px_25px_rgba(15,23,42,0.03)] hover:shadow-[0_15px_30px_rgba(88,12,30,0.08)] transition-all group cursor-pointer flex flex-col items-center text-center disabled:cursor-wait"
              >
                <span className="w-14 h-14 rounded-2xl bg-[#580c1e]/10 text-[#580c1e] flex items-center justify-center mb-5 group-hover:scale-105 group-hover:bg-[#580c1e] group-hover:text-[#fef3c7] transition-all border border-[#580c1e]/15">
                  <Icon className="w-6 h-6" />
                </span>
                <span className="font-serif text-xl font-bold text-[#1a1918] mb-2 group-hover:text-[#580c1e] transition-colors">{title}</span>
                <span className="text-xs text-[#665e5d] mb-5 font-light leading-relaxed">{text}</span>
                <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-[#580c1e] uppercase tracking-wider">
                  {busy === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-[#c89e37]" />}
                  {action}
                </span>
                {missing && (
                  <span role="status" className="mt-3 text-[11px] font-semibold text-[#8b6a1f] bg-[#fef3c7] rounded-full px-3 py-1">
                    The PDF will be available soon.
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
