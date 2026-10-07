import React from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_DOCS } from '../data/legalContent';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#1e050b] text-white w-full py-20 border-t border-[#d4af37]/20 flex flex-col items-center px-4 sm:px-8 text-center relative overflow-hidden">
      {/* Subtle gold ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-24 bg-[#d4af37]/10 blur-3xl pointer-events-none" />

      <div className="font-serif text-2xl sm:text-3xl text-[#fef3c7] font-bold mb-3 tracking-wide">
        ENDOCON 2027
      </div>
      <div className="w-12 h-0.5 bg-[#d4af37]/50 mx-auto mb-4" />
      <p className="text-xs text-stone-300 max-w-lg mb-8 font-light leading-relaxed">
        Society of Gastrointestinal Endoscopy of India (SGEI) • 22–25 April 2027 • ITC Royal Bengal, Kolkata, India
      </p>

      <nav aria-label="Policies" className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs font-medium text-stone-300">
        {LEGAL_DOCS.map((d) => (
          <Link key={d.slug} to={`/${d.slug}`} className="hover:text-[#d4af37] transition-colors">
            {d.title}
          </Link>
        ))}
      </nav>

      <div className="text-[11px] text-stone-400 mt-10 font-light">
        © 2027 ENDOCON 2027. All rights reserved.
      </div>

    </footer>
  );
};
