import React, { useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Download,
  FileText,
  Layers,
  Mic,
  MonitorPlay,
  Sparkles,
  Ticket,
  TriangleAlert,
  Type,
  Video,
} from 'lucide-react';
import type { AbstractCategory } from '../api/types';
import { GUIDELINES_TEXT } from '../data/abstractGuidelines';
import { AbstractSubmitPanel } from '../features/abstracts/PublicAbstractForm';

interface AbstractSubmissionSectionProps {
  /** Opens the submission page (signed-in delegates) or brings the sign-in card into view, optionally pre-selecting a category. */
  onStartSubmission?: (category?: AbstractCategory) => void;
}

/* ------------------------------------------------------------------------------------------------
 * Content – "Abstract Submission Guideline – ENDOCON 2027"
 * ---------------------------------------------------------------------------------------------- */

type Group = { title?: string; items: React.ReactNode[] };
type Category = {
  id: AbstractCategory;
  name: string;
  /** Tab label. */
  short: string;
  icon: React.ElementType;
  tag: string;
  description: string;
  eligibility: string;
  upload: string;
  groups: Group[];
  notice?: React.ReactNode;
  quote?: string;
};

const CATEGORIES: Category[] = [
  {
    id: 'plenary',
    name: 'Plenary Sessions',
    short: 'Plenary',
    icon: Award,
    tag: 'SGEI members only',
    description: 'The highest-tier podium presentation at ENDOCON 2027, reserved for original research by members of the Society of Gastrointestinal Endoscopy of India.',
    eligibility: 'SGEI members only',
    upload: 'Complete manuscript – single PDF',
    groups: [
      {
        items: [
          'Case reports will not be accepted.',
          'Submission of the complete manuscript is mandatory.',
          'The manuscript must include the abstract, figures and tables.',
          'The complete manuscript should be uploaded as a single PDF file.',
        ],
      },
    ],
    notice: 'Abstracts submitted without the full manuscript upload will be automatically rejected for the Plenary Session.',
  },
  {
    id: 'yia',
    name: 'Young Investigator Awards',
    short: 'Young Investigator',
    icon: Sparkles,
    tag: 'Under 45 years',
    description: 'An award session recognising outstanding research by early-career investigators in gastroenterology and endoscopy.',
    eligibility: 'Presenting author under 45 years of age',
    upload: 'Complete manuscript – single PDF',
    groups: [
      {
        items: [
          'Case reports will not be accepted.',
          'Submission of the complete manuscript is mandatory.',
          'The manuscript must include the abstract, figures and tables.',
          'The complete manuscript should be uploaded as a single PDF file.',
        ],
      },
    ],
    notice: 'Abstracts submitted without the full manuscript upload will be automatically rejected for the Young Investigator Session.',
  },
  {
    id: 'oral',
    name: 'Oral Paper Presentations',
    short: 'Oral Paper',
    icon: Mic,
    tag: 'Original research',
    description: 'Podium presentations of original research in designated scientific sessions.',
    eligibility: 'Original, high-quality scientific research',
    upload: 'Complete abstract – Word file',
    groups: [
      {
        items: [
          'Abstracts must be based on original, high-quality scientific research.',
          'Submissions will be rigorously reviewed by the Scientific Committee for originality, relevance and scientific merit.',
          'Selected abstracts will be assigned for oral presentation in designated scientific sessions.',
          'Presentation guidelines, format and allotted time will be communicated upon acceptance.',
          'The presenting author must complete conference registration to be eligible to present the paper.',
        ],
      },
    ],
  },
  {
    id: 'eposter',
    name: 'E-Poster Presentations',
    short: 'E-Poster',
    icon: MonitorPlay,
    tag: 'Single Word file',
    description:
      'A modern, interactive platform to present your research to leading experts – designed to highlight key findings, stimulate discussion and enhance the visibility of your work.',
    eligibility: 'All researchers with original scientific work',
    upload: 'E-poster – single Word file',
    groups: [
      {
        title: 'Who can submit',
        items: ['Open to all researchers submitting original, high-quality scientific work.', 'Case reports may be considered only if indicated in the session criteria.'],
      },
      {
        title: 'Submission requirements',
        items: [
          'Abstracts must reflect original scientific research of significant quality.',
          'A single Word file with: title and authors with affiliations; a structured abstract (Background, Methods, Results, Conclusion); figures, tables and relevant visuals.',
          'All submissions are reviewed by the Scientific Committee for originality, relevance and scientific merit.',
        ],
      },
      {
        title: 'Design & formatting',
        items: [
          'Recommended size: A0, portrait orientation.',
          'Clear, legible font – minimum 24 pt for body text.',
          'Concise, high-impact content; avoid overcrowding.',
          'High-resolution images, graphs and tables.',
        ],
      },
      {
        title: 'Presentation & engagement',
        items: [
          'Accepted e-posters are displayed on digital screens in designated halls.',
          'Presenting authors are encouraged to engage with attendees and answer questions.',
          'Display and interaction guidelines will be provided upon acceptance.',
        ],
      },
    ],
    notice: 'The presenting author must register for the conference. Incomplete submissions or Word files not adhering to the guidelines may be rejected.',
  },
  {
    id: 'video',
    name: 'Video Digest Session',
    short: 'Video Digest',
    icon: Video,
    tag: 'Procedural video',
    description: 'High-quality educational and scientific videos showcasing procedural expertise. Every submission should work as a teaching tool.',
    eligibility: 'Educational & scientific endoscopy videos',
    upload: 'Video file (MP4 / MOV, up to 500 MB) + abstract',
    groups: [
      {
        title: 'Introduction',
        items: [
          'Background & relevance – why the case or technique matters.',
          'Objectives – what the video aims to teach or show.',
          'Rationale – why this method or approach was chosen.',
        ],
      },
      {
        title: 'Novel techniques',
        items: ['Justification – why this method was selected.', 'Alternatives – other techniques and why they were not selected.'],
      },
      {
        title: 'High-quality video',
        items: [
          'Sharp, stable and well-lit visuals that clearly show the technique, findings or outcomes.',
          'Avoid shaking, poor resolution or artifacts – these may lead to rejection.',
          'Use diagrams, labels or annotations for complex concepts.',
        ],
      },
      {
        title: 'Clear summary',
        items: ['Key findings & outcomes.', 'Clinical relevance for current or future practice.'],
      },
      { title: 'Disclosures', items: ['All authors must declare conflicts of interest or financial disclosures.'] },
      { title: 'English narration', items: ['Speak clearly and at a moderate pace.', 'Guide viewers smoothly through the procedure or findings.'] },
    ],
    quote:
      'Think of your submission as a teaching tool – your audience should understand the significance, learn the technique and appreciate the clinical relevance even without prior exposure to the case.',
  },
];

const GENERAL: { title: string; icon: React.ElementType; items: React.ReactNode[] }[] = [
  {
    title: 'Language & format',
    icon: Type,
    items: [
      'Abstracts must be submitted in English.',
      <>The abstract body must not exceed <strong>300 words</strong> – longer abstracts are not accepted.</>,
      'Check spelling and grammar carefully; abstracts are published exactly as received.',
    ],
  },
  {
    title: 'Title, keywords & files',
    icon: FileText,
    items: [
      'The file must include the title, authors, institution and abstract.',
      <>Title in <strong>sentence case</strong>, without abbreviations.</>,
      <>Provide <strong>3–4 keywords</strong> in alphabetical order.</>,
    ],
  },
  {
    title: 'References',
    icon: BookOpen,
    items: [
      'Number references consecutively, formatted to journal standards.',
      'List all authors if six or fewer; if more than six, list the first three followed by et al.',
      'Include article title, abbreviated journal title, year, volume and page numbers.',
      <span className="font-mono text-[11px] text-[#580c1e]">
        Guzman-Prado Y, Samson O, Segal JP, Limdi JK, Hayee B. Vitamin D therapy in adults with inflammatory bowel disease: A systematic review and meta-analysis. Inflamm Bowel
        Dis. 2020,26:1819-30.
      </span>,
    ],
  },
  {
    title: 'Authors & roles',
    icon: Layers,
    items: [
      <><strong>Submitting author</strong> – receives all communications.</>,
      <><strong>Presenting author</strong> – presents at the conference and must register.</>,
      <><strong>Co-authors</strong> – endorse the scientific content.</>,
      'Enter full names with first letters capitalised, and declare all financial or other conflicts of interest.',
    ],
  },
  {
    title: 'Before you submit',
    icon: Check,
    items: [
      'A free ENDOCON 2027 account is required – log in or create one to submit.',
      'Complete all mandatory fields (*).',
      'Abstracts cannot be edited once submitted, unless the Scientific Committee returns them with a comment – then revise and resubmit from My Abstracts.',
      'A confirmation email is sent on successful submission.',
      'Acceptance by the Scientific Committee does not guarantee permission to present.',
    ],
  },
];

const FACTS: { icon: React.ElementType; value: string; label: string }[] = [
  { icon: Layers, value: '5', label: 'Presentation categories' },
  { icon: Type, value: '300', label: 'Word limit per abstract' },
  { icon: BookOpen, value: 'JDE', label: 'Published in the Journal of Digestive Endoscopy' },
  { icon: Ticket, value: 'Free', label: 'Registration for accepted authors' },
];

function downloadGuidelines() {
  const url = URL.createObjectURL(new Blob([GUIDELINES_TEXT], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ENDOCON_2027_Abstract_Submission_Guidelines.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------------------------------------
 * One section: call for abstracts (facts), category guide + submission card. The form is /abstracts/submit.
 * ---------------------------------------------------------------------------------------------- */

export const AbstractSubmissionSection: React.FC<AbstractSubmissionSectionProps> = () => {
  const [active, setActive] = useState(0);
  const cat = CATEGORIES[active];
  const CatIcon = cat.icon;

  return (
    <section id="abstract" className="relative py-20 sm:py-28 bg-[#faf8f5] px-4 sm:px-6 lg:px-8 border-b border-black/[0.05] overflow-hidden">
      {/* soft backdrop */}
      <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-[#f6ead9]/70 to-transparent pointer-events-none" aria-hidden />
      <div
        className="absolute inset-x-0 top-0 h-[420px] opacity-40 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(88,12,30,0.14) 1px, transparent 0)', backgroundSize: '20px 20px', maskImage: 'linear-gradient(to bottom, black, transparent)' }}
        aria-hidden
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-[#f5d5cf] text-[11px] font-bold uppercase tracking-[0.18em] text-[#70010b] shadow-xs">
              <FileText className="w-3 h-3 text-[#c89e37]" />
              Call for Abstracts
            </div>
            <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-[44px] font-bold text-[#1a1918] tracking-tight leading-[1.1]">
             Abstract <span className="text-[#580c1e]">Submission</span>
            </h2>
            <p className="mt-4 text-sm sm:text-base text-[#665e5d] font-light leading-relaxed">
              Five presentation formats, one simple online submission. Choose your category, read its requirements, then submit and track the Scientific Committee’s decision from your account.
            </p>
          </div>
          {/* <button
            type="button"
            onClick={downloadGuidelines}
            className="justify-self-start lg:justify-self-end inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#580c1e]/20 text-xs font-bold text-[#580c1e] hover:bg-[#580c1e]/5 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download guidelines
          </button> */}
        </div>

        {/* Key facts */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {FACTS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="group bg-white/80 backdrop-blur rounded-2xl border border-black/[0.06] p-4 sm:p-5 flex items-center gap-3.5 shadow-xs hover:shadow-[0_10px_30px_-12px_rgba(88,12,30,0.25)] transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#580c1e] to-[#781029] text-[#fef3c7] flex items-center justify-center shrink-0">
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="font-serif text-xl sm:text-2xl font-bold text-[#1a1918] leading-none">{value}</div>
                <div className="text-[11px] text-[#665e5d] mt-1 leading-snug">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Guide + submission card */}
        <div className="mt-8 grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="bg-white rounded-3xl border border-black/[0.07] shadow-[0_18px_45px_-20px_rgba(88,12,30,0.18)] overflow-hidden">
            {/* Category tabs */}
            <div className="border-b border-black/[0.06] bg-[#fcfaf7] p-2 sm:p-3">
              <div role="tablist" aria-label="Abstract categories" className="flex md:grid md:grid-cols-5 gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {CATEGORIES.map((c, i) => {
                  const selected = i === active;
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActive(i)}
                      className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selected ? 'bg-[#580c1e] text-[#fef3c7] shadow-[0_6px_16px_-6px_rgba(88,12,30,0.6)]' : 'text-[#4e4443] hover:bg-white hover:text-[#580c1e]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${selected ? 'text-[#d4af37]' : 'text-[#580c1e]/70'}`} />
                      {c.short}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category detail */}
            <div key={cat.id} role="tabpanel" className="p-6 sm:p-8 animate-in fade-in duration-200">
              <div className="flex items-start gap-4">
                <span className="hidden sm:flex w-12 h-12 rounded-2xl bg-[#580c1e]/[0.07] text-[#580c1e] items-center justify-center shrink-0">
                  <CatIcon className="w-6 h-6" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-2xl font-bold text-[#1a1918]">{cat.name}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a6a1f] bg-[#fdf3e3] border border-[#c89e37]/30 rounded-full px-2.5 py-0.5">{cat.tag}</span>
                  </div>
                  <p className="text-sm text-[#665e5d] font-light leading-relaxed mt-1.5">{cat.description}</p>
                </div>
              </div>

              <dl className="mt-6 grid sm:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#fcfaf7] border border-black/[0.06] p-4">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">Eligibility</dt>
                  <dd className="text-sm font-semibold text-[#580c1e] mt-1">{cat.eligibility}</dd>
                </div>
                <div className="rounded-2xl bg-[#fcfaf7] border border-black/[0.06] p-4">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d]">Upload</dt>
                  <dd className="text-sm font-semibold text-[#580c1e] mt-1">{cat.upload}</dd>
                </div>
              </dl>

              <div className={`mt-7 grid gap-x-10 gap-y-6 ${cat.groups.length > 1 ? 'md:grid-cols-2' : ''}`}>
                {cat.groups.map((g, gi) => (
                  <div key={gi}>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1918] mb-3">{g.title ?? 'Requirements'}</h4>
                    <ul className="space-y-2.5">
                      {g.items.map((item, ii) => (
                        <li key={ii} className="flex gap-3 text-sm text-[#4e4443] leading-relaxed">
                          <span className="mt-[3px] w-4 h-4 rounded-full bg-[#580c1e]/[0.08] text-[#580c1e] flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {cat.notice && (
                <div className="mt-7 flex gap-3 rounded-2xl border-l-4 border-[#c89e37] bg-[#fdf8ec] px-4 py-3.5 text-sm text-[#5b4a1f]">
                  <TriangleAlert className="w-4 h-4 text-[#b8860b] shrink-0 mt-0.5" />
                  <span>{cat.notice}</span>
                </div>
              )}
              {cat.quote && <blockquote className="mt-7 border-l-4 border-[#580c1e] pl-4 font-serif italic text-[15px] text-[#3a3534] leading-relaxed">{cat.quote}</blockquote>}

               
            </div>
          </div>

          {/* Submission card */}
          <div id="submit-abstract" className="order-first lg:order-none lg:sticky lg:top-28 scroll-mt-28">
            <AbstractSubmitPanel />
          </div>
        </div>

      </div>
    </section>
  );
};
