import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Award, Calendar, ExternalLink, Globe2, MapPin, Mic2, Users } from 'lucide-react';
import { CONFERENCE_IMAGES } from '../data/conferenceData';
import sgeiLogo from '../../public/sgei.png';

interface HeroProps {
  onOpenRegister: () => void;
  onOpenAbstract: () => void;
}

const SGEI_URL = 'https://sgei.org.in/';

const STATS = [
  { value: 15, suffix: '+', label: 'Countries', icon: Globe2 },
  { value: 40, suffix: '+', label: 'Keynotes', icon: Mic2 },
  { value: 1200, suffix: '+', label: 'Delegates', icon: Users },
  { value: 'CME Credit', suffix: '', label: 'Applied For', icon: Award },
];

/** Counts from 0 to `to` once the element scrolls into view (instant when reduced motion is preferred). */
function CountUp({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setN(to);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min((t - start) / 1400, 1);
          setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref} className="tabular-nums">
      {n}
      {suffix}
    </span>
  );
}

/** Single endoscopy banner with the SGEI logo (links to the society's website). */
export const Hero: React.FC<HeroProps> = ({ onOpenRegister, onOpenAbstract }) => (
  <section id="home" className="relative min-h-[760px] lg:min-h-[820px] flex items-center overflow-hidden bg-[#1a0409]">
    {/* Banner image – GI endoscopy procedure */}
    <div className="absolute inset-0">
      <img
        src={CONFERENCE_IMAGES.endoscopyMonitor}
        alt="Gastroenterologist performing a GI endoscopy with the endoscopic view on the monitor"
        className="w-full h-full object-cover object-[70%_center]"
        fetchPriority="high"
      />
      {/* Darker on the left for the text, the procedure stays visible on the right */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#2a0610] via-[#3d0918]/80 to-[#3d0918]/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a0409]/80 via-transparent to-transparent" />
    </div>

    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 text-white">
      <div className="max-w-3xl mx-auto text-center">
        {/* SGEI logo */}
        <a
          href={SGEI_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Society of Gastrointestinal Endoscopy of India – visit website"
          aria-label="Society of Gastrointestinal Endoscopy of India (opens sgei.org.in in a new tab)"
          className="group inline-flex items-center gap-3 bg-white rounded-2xl pl-3 pr-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:shadow-[0_14px_36px_rgba(0,0,0,0.35)] transition-shadow"
        >
          <img src={sgeiLogo} alt="Society of Gastrointestinal Endoscopy of India (SGEI)" className="h-12 sm:h-14 w-auto" />
          <ExternalLink className="w-3.5 h-3.5 text-[#665e5d] group-hover:text-[#580c1e] transition-colors" />
        </a>

        <div className="mt-8 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">27th National Conference of Society of Gastrointestinal Endoscopy of India</div>
        <h1 className="mt-3 font-serif text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.09]">
          Precision, Practice &amp; Progress <span className="block italic font-normal text-[#f7e7b4]">in GI Endoscopy</span>
        </h1>
        <p className="mt-5 text-base sm:text-lg text-white/80 leading-relaxed font-light max-w-xl mx-auto">
          Join leading endoscopists, gastroenterologists and researchers for four days of scientific sessions, live endoscopy and hands-on learning.
        </p>

        <div className="mt-7 flex flex-wrap gap-3 text-sm justify-center">
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/15">
            <Calendar className="w-4 h-4 text-[#d4af37]" />
            22 – 25 April 2027
          </span>
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/15">
            <MapPin className="w-4 h-4 text-[#d4af37]" />
            ITC Royal Bengal, Kolkata
          </span>
        </div>

        <div className="mt-9 flex flex-col sm:flex-row gap-3  justify-center">
          <button
            id="hero-register-btn"
            onClick={onOpenRegister}
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[#d4af37] via-[#f5e6a8] to-[#c89e37] text-[#332200] font-bold text-sm uppercase tracking-wider border border-[#fef3c7]/60 shadow-[0_10px_25px_rgba(212,175,55,0.3)] hover:shadow-[0_14px_32px_rgba(212,175,55,0.45)] active:scale-95 transition-all cursor-pointer"
          >
            Register Now
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            id="hero-abstract-btn"
            onClick={onOpenAbstract}
            className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm tracking-wide border border-white/30 hover:border-white/50 backdrop-blur-md active:scale-95 transition-all cursor-pointer"
          >
            Submit Abstract
          </button>
        </div>
      </div>

      {/* Key stats */}
      <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
        {STATS.map(({ value, suffix, label, icon: Icon }) => (
          <div
            key={label}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl px-4 sm:px-5 py-4 sm:py-5 text-left shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.1] hover:border-[#d4af37]/40"
          >
            <span className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/70 to-transparent" />
            <span className="pointer-events-none absolute -right-8 -top-8 w-24 h-24 rounded-full bg-[#d4af37]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#d4af37]/25 to-[#d4af37]/5 border border-[#d4af37]/30 text-[#f7e7b4] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div
                  className={`font-serif font-bold leading-none text-transparent bg-clip-text bg-gradient-to-b from-[#fff7dc] to-[#d4af37] ${
                    typeof value === 'number' ? 'text-3xl' : 'text-xl sm:text-2xl lg:text-xl leading-tight'
                  }`}
                >
                  {/* Numbers count up; text values (e.g. "CME Credit") are shown as they are. */}
                  {typeof value === 'number' ? <CountUp to={value} suffix={suffix} /> : value}
                </div>
                <div className="mt-1.5 text-xs font-medium text-white/70 tracking-wide">{label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
