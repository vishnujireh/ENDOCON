import React from 'react';
import { Clock, Globe2, MapPin } from 'lucide-react';

interface Faculty {
  name: string;
  /** Photo in public/faculty/ */
  photo: string;
  /** Position first, then department / institution lines, as supplied by the organising team. */
  lines: string[];
  location: string;
}

/**
 * International faculty as supplied by the organising team (Oct 2026).
 * Shown on the website in exactly this order – the same order as the organising team's slide. To change the order, move the entries.
 */
const INTERNATIONAL: Faculty[] = [
  {
    name: 'Dr. Noriya Uedo',
    photo: '/faculty/noriya-uedo.webp',
    lines: ['Gastroenterologist & Clinical Investigator', 'Dept. of Gastrointestinal Oncology', 'Osaka International Cancer Institute'],
    location: 'Osaka, Japan',
  },
  {
    name: 'Dr. Tsao Kin Kwok Stephen',
    photo: '/faculty/tsao-kin-kwok-stephen.webp',
    lines: ['Senior Consultant', 'Dept. Gastroenterologist and Hepatologist', 'Aliveo Medical'],
    location: 'Singapore',
  },
  {
    name: 'Dr. Vikramjit Mitra',
    photo: '/faculty/vikramjit-mitra.webp',
    lines: ['Consultant Gastroenterologist', 'Diagnostic & Therapeutic Endoscopy', 'Tees Valley Hospital'],
    location: 'Middlesbrough, Cleveland',
  },
  {
    name: 'Dr. Mouen Khashab',
    photo: '/faculty/mouen-khashab.webp',
    lines: ['Professor of Medicine Director – Therapeutic Endoscopy', 'Division of Gastroenterology and Hepatology', 'Johns Hopkins Hospital'],
    location: 'Baltimore, USA',
  },
  {
    name: 'Dr. Giuseppe Vanella',
    photo: '/faculty/giuseppe-vanella.webp',
    lines: ['Associate Professor', 'Pancreatobiliary Endoscopy & Endo-sonography Division', 'IRCCS San Raffaele Scientific Institute', 'Vita-Salute San Raffaele University'],
    location: 'Milan, Italy',
  },
  {
    name: 'Dr. Stefano F Crino',
    photo: '/faculty/stefano-crino.webp',
    lines: ['Associate Professor', 'Dept. Gastroenterology and Digestive Endoscopy Unit', 'University Hospital of Verona'],
    location: 'Verona, Italy',
  },
  {
    name: 'Dr. Tae Jung Song',
    photo: '/faculty/tae-jung-song.webp',
    lines: ['Professor', 'Division of Gastroenterology', 'AMC and The University of Ulsan College of Medicine'],
    location: 'Seoul, South Korea',
  },
];

const FacultyCard: React.FC<{ f: Faculty }> = ({ f }) => {
  const [role, ...rest] = f.lines;
  return (
    <div className="group w-full flex flex-col items-center text-center rounded-3xl border border-black/[0.06] bg-[#faf8f5] px-5 pt-8 pb-6 shadow-[0_10px_25px_rgba(15,23,42,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(88,12,30,0.10)]">
      <div className="relative mb-5">
        <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-[#d4af37] via-[#f3dc95] to-[#580c1e]/70 opacity-80 transition-opacity group-hover:opacity-100" />
        <img src={f.photo} alt={f.name} loading="lazy" width={128} height={128} className="relative w-32 h-32 rounded-full object-cover object-top bg-white border-4 border-white" />
      </div>
      <h3 className="font-serif text-lg font-bold leading-snug text-[#1a1918] group-hover:text-[#580c1e] transition-colors">{f.name}</h3>
      <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-[#580c1e]">{role}</p>
      <div className="mt-2 space-y-0.5 text-[13px] leading-relaxed text-[#665e5d]">
        {rest.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      <p className="mt-auto pt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b6a1f]">
        <MapPin className="w-3.5 h-3.5 text-[#c89e37]" /> {f.location}
      </p>
    </div>
  );
};

const ComingSoon: React.FC<{ what: string }> = ({ what }) => (
  <div className="max-w-2xl mx-auto rounded-3xl border border-[#c89e37]/30 bg-gradient-to-br from-[#fffaf0] to-[#fdf3e3] px-6 py-12 shadow-[0_12px_30px_rgba(88,12,30,0.06)]">
    <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#580c1e] to-[#781029] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#fef3c7]">
      <Clock className="w-3.5 h-3.5" /> Coming Soon
    </span>
    <h3 className="mt-4 font-serif text-xl sm:text-2xl font-bold text-[#1a1918]">Our faculty will be announced soon</h3>
    <p className="mt-2 text-sm text-[#665e5d] font-light">The {what} faculty for ENDOCON 2027 will be published here shortly.</p>
  </div>
);

/** International faculty (alphabetical); National faculty stays "Coming Soon" until the list is confirmed. */
export const FacultySpeakers: React.FC = () => {
  return (
    <section id="faculty" className="py-24 md:py-32 bg-white px-4 sm:px-6 lg:px-8 border-b border-black/[0.04]">
      <div className="max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#c89e37] mb-2.5">
          <Globe2 className="w-3.5 h-3.5 text-[#d4af37]" />
          Distinguished Mentors
        </div>
        <h2 className="font-serif text-3xl sm:text-5xl text-[#1a1918] font-bold tracking-tight mb-12">International Faculty</h2>
        <ul className="flex flex-wrap justify-center gap-5 sm:gap-6">
          {INTERNATIONAL.map((f) => (
            <li key={f.name} className="flex w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)]">
              <FacultyCard f={f} />
            </li>
          ))}
        </ul>
      </div>
      <div className="max-w-6xl mx-auto text-center mt-20">
        <h2 className="font-serif text-3xl sm:text-5xl text-[#1a1918] font-bold tracking-tight mb-12">National Faculty</h2>
        <ComingSoon what="national" />
      </div>
    </section>
  );
};
