import React, { useState } from 'react';
import { ATTRACTIONS } from '../data/conferenceData';
import { Attraction } from '../types';
import { Compass, ArrowRight, X, MapPin, Sun, Utensils, Landmark } from 'lucide-react';

export const KolkataSection: React.FC = () => {
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  return (
    <section
      id="kolkata"
      className="py-24 md:py-32 bg-white px-4 sm:px-6 lg:px-8 border-b border-black/[0.04] overflow-hidden"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-14">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#c89e37] mb-2.5">
              <Compass className="w-3.5 h-3.5 text-[#d4af37]" />
              City of Joy
            </div>
            <h2 className="font-serif text-3xl sm:text-5xl text-[#1a1918] font-bold tracking-tight mb-3">
              Discover Iconic Kolkata
            </h2>
            <p className="text-base text-[#665e5d] leading-relaxed font-light">
              Experience the cultural capital of India, where grand colonial architecture meets
              vibrant street life, intellectual literature, and warm Bengali hospitality.
            </p>
          </div>

          {/* <button
            onClick={() => setShowGuideModal(true)}
            className="mt-4 md:mt-0 flex items-center gap-2 text-[#580c1e] font-bold text-xs uppercase tracking-wider hover:text-[#781029] transition-colors group cursor-pointer"
          >
            Explore Delegate Travel Guide
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#c89e37]" />
          </button> */}
        </div>

        {/* 3 Featured Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ATTRACTIONS.map((attraction, idx) => (
            <div
              key={attraction.id}
              onClick={() => setSelectedAttraction(attraction)}
              className={`group relative rounded-3xl overflow-hidden aspect-video sm:aspect-4/3 cursor-pointer shadow-[0_12px_35px_rgba(15,23,42,0.06)] border border-black/[0.06] ${
                idx === 2 ? 'md:col-span-2 lg:col-span-1' : ''
              }`}
            >
              <img
                src={attraction.image}
                alt={attraction.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-[10px] uppercase font-bold text-[#fef3c7] tracking-wider border border-white/20">
                {attraction.highlight}
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end p-6">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-white mb-1.5">
                    {attraction.name}
                  </h3>
                  <p className="text-xs text-white/80 font-light leading-relaxed line-clamp-2">
                    {attraction.description}
                  </p>
                  <span className="text-[11px] font-semibold text-[#fef3c7] inline-flex items-center gap-1.5 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click for history &amp; visiting info <ArrowRight className="w-3.5 h-3.5 text-[#d4af37]" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Single Attraction Detail Modal */}
      {selectedAttraction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-black/[0.08] relative">
            <div className="relative aspect-video bg-slate-100">
              <img
                src={selectedAttraction.image}
                alt={selectedAttraction.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedAttraction(null)}
                className="absolute top-3.5 right-3.5 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-4 left-5 bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-[#d4af37]/40 shadow-xs">
                {selectedAttraction.highlight}
              </div>
            </div>

            <div className="p-7">
              <h3 className="font-serif text-2xl font-bold text-[#1a1918] mb-1.5">
                {selectedAttraction.name}
              </h3>
              <p className="text-xs font-semibold text-[#c89e37] uppercase tracking-wider mb-3">
                {selectedAttraction.description}
              </p>
              <p className="text-sm text-[#4e4443] leading-relaxed mb-6 font-light">
                {selectedAttraction.fullDetails}
              </p>

              <div className="flex justify-between items-center pt-4 border-t border-black/[0.06]">
                <span className="text-xs text-[#665e5d] flex items-center gap-1.5 font-light">
                  <MapPin className="w-3.5 h-3.5 text-[#580c1e]" /> 15-20 min from ITC Sonar
                </span>
                <button
                  onClick={() => setSelectedAttraction(null)}
                  className="bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7] px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer border border-[#d4af37]/30 shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Delegate Travel Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-black/[0.08] relative">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-2 text-[#665e5d] hover:text-[#580c1e] rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#c89e37] mb-1.5">
              <Landmark className="w-3.5 h-3.5 text-[#d4af37]" /> Delegate Excursions
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#1a1918] mb-6">
              Kolkata Delegate Travel &amp; Heritage Guide
            </h3>

            <div className="space-y-5 text-sm text-[#4e4443]">
              <div className="p-5 bg-[#faf8f5] rounded-2xl border border-black/[0.06]">
                <h4 className="font-bold text-[#580c1e] mb-1.5 flex items-center gap-2 font-serif text-base">
                  <Sun className="w-4 h-4 text-[#c89e37]" /> November Weather Advisory
                </h4>
                <p className="leading-relaxed text-xs sm:text-sm font-light text-[#665e5d]">
                  November brings Kolkata’s most agreeable climate. Expect crisp mornings and dry,
                  sunny afternoons with average temperatures ranging between <strong className="font-semibold text-[#1a1918]">18°C and 28°C</strong>.
                  Light business suits or smart casual woolens are ideal for evening functions.
                </p>
              </div>

              <div className="p-5 bg-[#faf8f5] rounded-2xl border border-black/[0.06]">
                <h4 className="font-bold text-[#580c1e] mb-1.5 flex items-center gap-2 font-serif text-base">
                  <Utensils className="w-4 h-4 text-[#c89e37]" /> Celebrated Culinary Heritage
                </h4>
                <p className="leading-relaxed text-xs sm:text-sm font-light text-[#665e5d]">
                  Do not miss authentic Bengali cottage-cheese sweets: warm <em>Rosogolla</em>, roasted <em>Nolen Gur Sondesh</em>, and creamy <em>Mishti Doi</em>. Park Street offers classic Nizam Kathi rolls, while ITC Sonar serves signature Awadhi and Bengali specialties at Dum Pukht and Sonartori.
                </p>
              </div>

              <div className="p-5 bg-[#faf8f5] rounded-2xl border border-black/[0.06]">
                <h4 className="font-bold text-[#580c1e] mb-1.5 flex items-center gap-2 font-serif text-base">
                  <Compass className="w-4 h-4 text-[#580c1e]" /> Official Delegate City Tour
                </h4>
                <p className="leading-relaxed text-xs sm:text-sm font-light text-[#665e5d]">
                  The Conference Hospitality Desk operates curated 4-hour morning and sunset city tours
                  covering Victoria Memorial, St. Paul’s Cathedral, Indian Museum, and Princep Ghat riverboat rides. Inquire at the registration counter for complimentary slots.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-black/[0.06] flex justify-end">
              <button
                onClick={() => setShowGuideModal(false)}
                className="bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7] px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer border border-[#d4af37]/30 shadow-2xs"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
