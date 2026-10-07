import React from 'react';
import { Clock, ShieldCheck } from 'lucide-react';

interface SponsorsSectionProps {
  onDownloadProspectus: () => void;
  onContactSponsors: () => void;
}

export const SponsorsSection: React.FC<SponsorsSectionProps> = ({
  onDownloadProspectus,
  onContactSponsors,
}) => {
  return (
    <section id="sponsors" className="py-24 md:py-32 bg-[#faf8f5] px-4 sm:px-6 lg:px-8 border-b border-black/[0.04]">
      <div className="max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#c89e37] mb-2.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37]" />
          Collaborators
        </div>
        <h2 className="font-serif text-3xl sm:text-5xl text-[#1a1918] font-bold tracking-tight mb-3">
          Industry Partners
        </h2>
        <p className="text-base text-[#665e5d] max-w-2xl mx-auto mb-16 font-light">
          We gratefully acknowledge the generous clinical research grants and technological equipment
          support of our esteemed global industry sponsors.
        </p>

        {/* Partners are announced later – placeholder until the list is confirmed. */}
        <div className="max-w-2xl mx-auto rounded-3xl border border-[#c89e37]/30 bg-gradient-to-br from-[#fffaf0] to-[#fdf3e3] px-6 py-12 shadow-[0_12px_30px_rgba(88,12,30,0.06)]">
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#580c1e] to-[#781029] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#fef3c7]">
            <Clock className="w-3.5 h-3.5" /> Coming Soon
          </span>
          <h3 className="mt-4 font-serif text-xl sm:text-2xl font-bold text-[#1a1918]">Our partners will be announced soon</h3>
          <p className="mt-2 text-sm text-[#665e5d] font-light">Partner and exhibitor details for ENDOCON 2027 will be published here shortly.</p>
        </div>
      </div>
    </section>
  );
};
