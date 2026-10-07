import React from 'react';
import { Clock, Globe2 } from 'lucide-react';

/**
 * National Faculty – "Coming Soon" until the faculty list is confirmed. The sample speakers are
 * still in data/conferenceData.ts (NATIONAL_FACULTY) for when the real list is published.
 */
export const FacultySpeakers: React.FC = () => {
  return (
    <section id="faculty" className="py-24 md:py-32 bg-white px-4 sm:px-6 lg:px-8 border-b border-black/[0.04]">
      <div className="max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#c89e37] mb-2.5">
          <Globe2 className="w-3.5 h-3.5 text-[#d4af37]" />
          Distinguished Mentors
        </div>
        <h2 className="font-serif text-3xl sm:text-5xl text-[#1a1918] font-bold tracking-tight mb-12">National Faculty</h2>

        <div className="max-w-2xl mx-auto rounded-3xl border border-[#c89e37]/30 bg-gradient-to-br from-[#fffaf0] to-[#fdf3e3] px-6 py-12 shadow-[0_12px_30px_rgba(88,12,30,0.06)]">
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#580c1e] to-[#781029] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#fef3c7]">
            <Clock className="w-3.5 h-3.5" /> Coming Soon
          </span>
          <h3 className="mt-4 font-serif text-xl sm:text-2xl font-bold text-[#1a1918]">Our faculty will be announced soon</h3>
          <p className="mt-2 text-sm text-[#665e5d] font-light">The national faculty for ENDOCON 2027 will be published here shortly.</p>
        </div>
      </div>
    </section>
  );
};
