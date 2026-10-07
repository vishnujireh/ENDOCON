import React from 'react';
import { MapPin, Mail, MessageCircle, Phone } from 'lucide-react';

const EMAILS = ['secretariat@endocon2027.in', 'endocon2026@gmail.com'];

const HELPLINES = [
  { label: 'Registration', display: '+91 62072 65423', tel: '+916207265423', name: 'Ms. Komal' },
  { label: 'Program', display: '+91 97187 39944', tel: '+919718739944', name: 'Ms. Shipra' },
  { label: 'Travel', display: '+91 92896 43232', tel: '+919289643232', name: 'Mr. Ankush' },
];

const ESCALATION = { display: '+91 99994 87584', tel: '+919999487584', name: 'Mr. Sohan Pal' };

export const ContactSection: React.FC = () => {
  return (
    <section
      id="contact"
      className="py-20 sm:py-28 bg-[#faf8f5] px-4 sm:px-6 lg:px-8 border-b border-black/[0.04]"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#c89e37] mb-3 px-3.5 py-1 rounded-full bg-[#faeae7] border border-[#f5d5cf]">
            <Mail className="w-3.5 h-3.5 text-[#580c1e]" />
            Official Conference Secretariat
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl text-[#1a1918] font-bold tracking-tight leading-tight mb-3.5">
            Contact &amp; Assistance
          </h2>
          <p className="text-sm sm:text-base text-[#665e5d] font-light leading-relaxed">
            Our organizing secretariat and dedicated desk coordinators are available to assist
            delegates, international faculty, and industry partners.
          </p>
        </div>

        {/* Communication channels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Channel 1: Conference Secretariat */}
          <div className="bg-white p-6 rounded-3xl border border-black/[0.06] shadow-xs hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-2xl bg-[#580c1e]/10 text-[#580c1e] flex items-center justify-center mb-4">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#1a1918] mb-1.5">Conference Secretariat</h3>
            <address className="not-italic text-xs text-[#665e5d] leading-relaxed">
              <span className="block font-semibold text-[#1a1918]">Office of Dr. Sandip Pal</span>
              <span className="block">Department of Gastroenterology</span>
              <span className="block">Narayana - RN Tagore Hospital</span>
              <span className="block">Mukundapur, Kolkata, West Bengal, 700099</span>
            </address>
          </div>

          {/* Channel 2: Email Enquiries */}
          <div className="bg-white p-6 rounded-3xl border border-black/[0.06] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#580c1e]/10 text-[#580c1e] flex items-center justify-center mb-4">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#1a1918] mb-1.5">Email Inquiries</h3>
              <div className="space-y-1.5 text-xs">
                {EMAILS.map((e) => (
                  <div key={e}>
                    <a href={`mailto:${e}`} className="font-medium text-[#580c1e] hover:underline break-all">
                      {e}
                    </a>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-3 mt-4 border-t border-black/[0.05] text-[11px] text-[#665e5d] font-light">
              Response within 24 business hours
            </div>
          </div>

          {/* Channel 3: Helplines */}
          <div className="bg-white p-6 rounded-3xl border border-black/[0.06] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#580c1e]/10 text-[#580c1e] flex items-center justify-center mb-4">
                <Phone className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#1a1918] mb-2">Helplines</h3>
              <ul className="space-y-2 text-xs">
                {HELPLINES.map((h) => (
                  <li key={h.label} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[10px] text-[#665e5d] uppercase font-semibold tracking-wide">{h.label}</span>
                    <span className="text-right">
                      <a href={`tel:${h.tel}`} className="font-semibold text-[#1a1918] hover:text-[#580c1e] whitespace-nowrap">
                        {h.display}
                      </a>
                      <span className="block text-[11px] text-[#665e5d]">{h.name}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-3 mt-4 border-t border-black/[0.05] text-xs">
              <span className="text-[10px] text-[#665e5d] uppercase font-semibold tracking-wide block mb-1.5">For Escalation</span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <a href={`tel:${ESCALATION.tel}`} className="font-semibold text-[#1a1918] hover:text-[#580c1e] whitespace-nowrap">
                    {ESCALATION.display}
                  </a>
                  <span className="block text-[11px] text-[#665e5d]">{ESCALATION.name}</span>
                </span>
                <a
                  href={`https://wa.me/${ESCALATION.tel.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`WhatsApp ${ESCALATION.name}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-1.5 text-[11px] font-bold text-[#128C7E] hover:bg-[#25D366]/20 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
