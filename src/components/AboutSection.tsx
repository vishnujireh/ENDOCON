import React from 'react';
import { GraduationCap, Hand, MessagesSquare, MonitorPlay, Presentation, Sparkles } from 'lucide-react';
import sgeiLogo from '../../public/sgei.png';
/** Formats the programme brings together (from the About text). */
const FORMATS = [
  { icon: Presentation, title: 'Expert-led lectures' },
  { icon: MonitorPlay, title: 'Live demonstrations' },
  { icon: MessagesSquare, title: 'Interactive case discussions' },
  { icon: Hand, title: 'Hands-on learning' },
];

export const AboutSection: React.FC = () => (
  <section id="about" className="relative py-20 sm:py-28 bg-white px-4 sm:px-6 lg:px-8 border-b border-black/[0.05] overflow-hidden">
    {/* soft background accents */}
    <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#d4af37]/10 blur-3xl" />
    <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-[#580c1e]/[0.05] blur-3xl" />

    <div className="relative max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-16 items-start">
        {/* Left: heading, lead and SGEI */}
        <div className="lg:sticky lg:top-28">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#faeae7] border border-[#f5d5cf] text-[11px] font-bold uppercase tracking-[0.18em] text-[#70010b]">
            <Sparkles className="w-3 h-3 text-[#c89e37]" />
            About the Conference
          </div>
          <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-[44px] font-bold text-[#1a1918] tracking-tight leading-[1.1]">
            About <span className="text-[#580c1e]">ENDOCON 2027</span>
          </h2>
          <div className="mt-5 w-14 h-1 rounded-full bg-gradient-to-r from-[#c89e37] to-[#d4af37]/30" />
          <p className="mt-6 text-lg text-[#3a3534] leading-relaxed">
            ENDOCON 2027 – Kolkata brings together leading experts, practicing gastroenterologists, endoscopists, researchers, trainees and healthcare professionals for a
            comprehensive academic experience focused on the evolving landscape of gastrointestinal endoscopy.
          </p>

          <a
            href="https://sgei.org.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 flex items-center gap-4 rounded-2xl border border-black/[0.07] bg-[#faf8f5] p-4 hover:border-[#580c1e]/25 hover:bg-white transition-colors group"
          >
            <span className="shrink-0 bg-white rounded-xl border border-black/[0.06] px-3 py-2">
              <img src={sgeiLogo} alt="Society of Gastrointestinal Endoscopy of India (SGEI)" className="h-10 w-auto" />
            </span>
            <span className="text-sm leading-snug">
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#c89e37]">Under the aegis of</span>
              <strong className="block mt-0.5 text-[#1a1918] group-hover:text-[#580c1e] transition-colors">Society of Gastrointestinal Endoscopy of India</strong>
            </span>
          </a>
        </div>

        {/* Right: story */}
        <div className="space-y-5 text-[15px] sm:text-base text-[#4e4443] leading-relaxed">
          <p>
            Organised under the aegis of the Society of Gastrointestinal Endoscopy of India (SGEI), ENDOCON has established itself as an important platform for scientific
            exchange, advanced endoscopy education, innovation and professional collaboration.
          </p>
          <p>
            The conference will bring together expert-led lectures, live demonstrations, interactive case discussions, hands-on learning and focused sessions covering
            contemporary developments across gastrointestinal endoscopy and related areas.
          </p>

          <ul className="grid grid-cols-2 gap-3 py-2">
            {FORMATS.map(({ icon: Icon, title }) => (
              <li key={title} className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 rounded-2xl bg-white border border-black/[0.07] shadow-[0_6px_20px_rgba(88,12,30,0.05)] px-4 py-3.5">
                <span className="w-10 h-10 rounded-xl bg-[#580c1e]/[0.07] text-[#580c1e] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-sm font-semibold text-[#1a1918] leading-snug">{title}</span>
              </li>
            ))}
          </ul>

          <p>
            ENDOCON 2027 aims to create an environment where experience meets innovation. From established endoscopic techniques to emerging technologies and evolving
            approaches in patient care, the scientific programme will encourage participants to learn, discuss and share practical insights.
          </p>

          <div className="flex gap-4 rounded-2xl bg-gradient-to-br from-[#fdf8ec] to-[#faf3e0] border border-[#d4af37]/30 p-5">
            <span className="w-11 h-11 rounded-xl bg-[#c89e37] text-white flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </span>
            <p className="text-[#4a3b16]">
              A special emphasis will also be placed on <strong className="text-[#1a1918]">young endoscopists and the next generation of specialists</strong>, providing
              opportunities for academic participation, presentation and interaction with experienced experts.
            </p>
          </div>

          <p>
            ENDOCON 2027 is envisioned as a meeting point for knowledge, experience, innovation and collaboration—bringing together the endoscopy community to discuss
            current practices, emerging technologies and the future direction of gastrointestinal endoscopy.
          </p>
        </div>
      </div>

      {/* Closing line */}
      <div className="mt-16 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a0610] via-[#4a0a1b] to-[#580c1e] px-6 sm:px-12 py-10 sm:py-12 text-center border border-[#d4af37]/25">
        <div aria-hidden className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-40 bg-[#d4af37]/20 blur-3xl" />
        <p className="relative font-serif text-2xl sm:text-3xl text-white leading-snug">
          Welcome to ENDOCON 2027, Kolkata
          <span className="block mt-2 italic font-normal text-[#f7e7b4] text-xl sm:text-2xl">where knowledge meets innovation in gastrointestinal endoscopy.</span>
        </p>
      </div>
    </div>
  </section>
);
