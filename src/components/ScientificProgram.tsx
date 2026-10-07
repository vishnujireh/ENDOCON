import React from 'react';
import { Sparkles } from 'lucide-react';

/** Program highlights as supplied by the organising team (Oct 2026). The detailed day-wise schedule follows later. */
const HIGHLIGHTS = [
  'AI in GI Endoscopy: Hype, Help or Hindrance?',
  'The Endoscopist AI: Who Makes the Final Call?',
  'Precision Endoscopy: Can We Detect What We Cannot See?',
  'The Difficult Polyp: Resect, Refer or Observe?',
  'ESD in 2027: Expanding the Boundaries',
  'EUS vs ERCP: Who Wins the Biliary Battle?',
  'Third-Space Endoscopy: Where Do We Draw the Line?',
  'The Future Scope: What Will We Be Using in 2030?',
  'Robotics in GI Endoscopy: Revolution or Evolution?',
  'When Endoscopy Fails: Rescue Strategies',
  'Complications on the Table: What Would You Do?',
  'Endoscopy Guidelines 2027: What Has Changed?',
  'Practice-Changing Papers of the Year',
  'The Last 12 Months in GI Endoscopy: What Really Matters?',
];

/** "Topic: Question" → headline + the question underneath. */
function split(topic: string): { title: string; question: string | null } {
  const i = topic.indexOf(':');
  return i === -1 ? { title: topic, question: null } : { title: topic.slice(0, i), question: topic.slice(i + 1).trim() };
}

interface ScientificProgramProps {
  /** Kept for the home page wiring; the PDF schedule button returns with the detailed program. */
  onDownloadBrochure?: () => void;
}

export const ScientificProgram: React.FC<ScientificProgramProps> = () => {
  return (
    <section id="program" className="relative isolate overflow-hidden bg-[#1f050c] px-4 sm:px-6 lg:px-8 py-24 md:py-32">
      {/* Background: deep maroon gradient, soft gold glows and a faint dot grid */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-[#2a0610] via-[#4a0a19] to-[#1a040a]" />
      <div aria-hidden className="absolute -top-40 -left-32 -z-10 h-[28rem] w-[28rem] rounded-full bg-[#d4af37]/15 blur-[120px]" />
      <div aria-hidden className="absolute -bottom-48 -right-24 -z-10 h-[30rem] w-[30rem] rounded-full bg-[#9b1b38]/40 blur-[130px]" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(#fef3c7_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-14 flex flex-col items-start justify-between gap-6 md:mb-16 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#e9c96b]">
              <Sparkles className="h-3.5 w-3.5" /> Curriculum
            </span>
            <h2 className="mt-4 font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[#fef3c7] sm:text-6xl">
              Program <span className="bg-gradient-to-r from-[#e9c96b] to-[#c89e37] bg-clip-text text-transparent">Highlights</span>
            </h2>
            <p className="mt-4 text-base font-light leading-relaxed text-[#fef3c7]/65">
              Three days of intensive hands-on workshops, plenary lectures, surgical symposiums, and joint discussions.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
            <span className="font-serif text-4xl font-bold text-[#e9c96b]">{HIGHLIGHTS.length}</span>
            <span className="text-xs font-semibold uppercase leading-tight tracking-[0.16em] text-[#fef3c7]/70">
              Highlight
              <br />
              sessions
            </span>
          </div>
        </div>

        {/* Highlights: bento grid, the first one featured */}
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((topic, i) => {
            const { title, question } = split(topic);
            const featured = i === 0;
            return (
              <li
                key={topic}
                className={`group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm transition-all duration-300 sm:block sm:p-6 hover:-translate-y-1 hover:border-[#d4af37]/40 hover:bg-white/[0.07] hover:shadow-[0_20px_50px_-20px_rgba(212,175,55,0.35)] ${
                  featured ? 'sm:col-span-2 bg-gradient-to-br from-[#d4af37]/[0.14] to-white/[0.03] sm:p-8' : ''
                }`}
              >
                <span className={`block w-9 shrink-0 font-serif text-2xl font-bold leading-none text-[#d4af37]/80 transition-colors group-hover:text-[#e9c96b] sm:w-auto ${featured ? 'sm:text-5xl' : 'sm:text-3xl'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="hidden sm:block mt-5 h-px w-10 bg-gradient-to-r from-[#d4af37] to-transparent transition-all duration-300 group-hover:w-20" />
                <div className="min-w-0 sm:mt-4">
                  <h3 className={`font-serif font-bold leading-snug text-[#fef3c7] ${featured ? 'text-lg sm:text-3xl' : 'text-base sm:text-lg'}`}>{title}</h3>
                  {question && <p className={`mt-1 leading-relaxed text-[#fef3c7]/60 ${featured ? 'text-sm sm:text-base' : 'text-sm'}`}>{question}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
