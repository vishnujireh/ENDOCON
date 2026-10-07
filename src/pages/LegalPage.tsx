import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText, Mail, ReceiptText, ShieldCheck } from 'lucide-react';
import { CONTACT_EMAIL, LEGAL_DOCS, type Block, type Bullet, type LegalDoc } from '../data/legalContent';

const ICONS: Record<string, React.ElementType> = {
  'privacy-policy': ShieldCheck,
  'terms-and-conditions': FileText,
  'refund-and-cancellation-policy': ReceiptText,
};

const sectionId = (i: number) => `section-${i + 1}`;
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

function BulletItem({ b }: { b: Bullet }) {
  const text = typeof b === 'string' ? b : b.text;
  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-[0.6em] w-1.5 h-1.5 rounded-full bg-[#c89e37]" />
      {text}
      {typeof b !== 'string' && (
        <ul className="mt-2 space-y-1.5 pl-1">
          {b.sub.map((s) => (
            <li key={s} className="relative pl-5 text-[#58413f]">
              <span className="absolute left-0 top-[0.65em] w-2 h-px bg-[#580c1e]/50" />
              {s}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function BlockView({ block }: { block: Block }) {
  if (typeof block === 'string') return <p>{block}</p>;
  if ('heading' in block) return <h3 className="pt-2 text-sm font-bold text-[#1a1918]">{block.heading}</h3>;
  return (
    <ul className="space-y-2.5">
      {block.list.map((b, i) => (
        <BulletItem key={i} b={b} />
      ))}
    </ul>
  );
}

/** One policy page (Privacy Policy, Terms & Conditions, Refund & Cancellation Policy). */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const Icon = ICONS[doc.slug] ?? FileText;

  return (
    <div className="pb-20">
      {/* Title band */}
      <div className="bg-gradient-to-br from-[#2a0610] via-[#4a0a1b] to-[#580c1e] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-white/60">
            <Link to="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white/90">{doc.title}</span>
          </nav>
          <div className="mt-5 flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-white/10 border border-[#d4af37]/40 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-[#d4af37]" />
            </span>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">ENDOCON 2027</div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mt-1">{doc.title}</h1>
            </div>
          </div>

          {/* Switch between the policies */}
          <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
            {LEGAL_DOCS.map((d) => {
              const active = d.slug === doc.slug;
              return (
                <Link
                  key={d.slug}
                  to={`/${d.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                    active ? 'bg-[#fef3c7] text-[#580c1e]' : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white border border-white/15'
                  }`}
                >
                  {d.short}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 grid lg:grid-cols-[250px_1fr] gap-8 items-start">
        {/* Contents */}
        <aside className="hidden lg:block sticky top-28">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#665e5d] mb-3">On this page</div>
          <ol className="space-y-0.5 border-l border-black/[0.08]">
            {doc.sections.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => scrollTo(sectionId(i))}
                  className="w-full text-left -ml-px pl-4 pr-2 py-1.5 border-l-2 border-transparent hover:border-[#580c1e] text-[13px] text-[#58413f] hover:text-[#580c1e] transition-colors cursor-pointer"
                >
                  <span className="text-[#c89e37] font-semibold mr-2 tabular-nums">{i + 1}.</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        {/* Policy text */}
        <article className="bg-white rounded-3xl border border-black/[0.07] shadow-[0_10px_35px_rgba(88,12,30,0.05)] p-6 sm:p-10">
          <div className="space-y-10">
            {doc.sections.map((s, i) => (
              <section key={s.title} id={sectionId(i)} className="scroll-mt-28">
                <h2 className="flex items-baseline gap-3 font-serif text-xl sm:text-2xl font-bold text-[#1a1918]">
                  <span className="text-[#c89e37] text-lg tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  {s.title}
                </h2>
                <div className="mt-4 space-y-3.5 text-[15px] leading-relaxed text-[#3a3534]">
                  {s.blocks.map((b, bi) => (
                    <BlockView key={bi} block={b} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl bg-[#faf8f5] border border-black/[0.06] p-5">
            <span className="w-11 h-11 rounded-xl bg-[#580c1e] text-[#fef3c7] flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#1a1918]">ENDOCON 2027 Organizing Committee</div>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-[#580c1e] font-semibold hover:underline">
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
