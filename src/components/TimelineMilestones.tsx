import React from 'react';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { IMPORTANT_DATES } from '../data/conferenceData';

export const TimelineMilestones: React.FC = () => {
  return (
    <section className="py-24 md:py-32 bg-white px-4 sm:px-6 lg:px-8 border-b border-black/[0.04]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#c89e37] mb-2.5">
            <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
            Conference Schedule
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl text-[#1a1918] font-bold tracking-tight">
            Important Dates
          </h2>
          <p className="text-sm sm:text-base text-[#665e5d] max-w-xl mx-auto mt-3 font-light">
            Mark your calendar to ensure early bird benefits and timely abstract consideration.
          </p>
        </div>

        <div className="relative">
          {/* Vertical Line with soft gold/wine gradient */}
          <div className="absolute left-4 md:left-1/2 top-3 bottom-3 w-0.5 bg-gradient-to-b from-[#d4af37]/40 via-[#580c1e]/20 to-[#d4af37]/40 transform md:-translate-x-1/2" />

          <div className="space-y-12 md:space-y-16">
            {IMPORTANT_DATES.map((item, index) => {
              const isEven = index % 2 === 1;
              const isCurrent = item.status === 'current';
              const isCompleted = item.status === 'completed';

              return (
                <div
                  key={item.date}
                  className="relative flex flex-col md:flex-row items-start md:items-center justify-between group"
                >
                  {/* Left Column (Desktop) */}
                  <div
                    className={`hidden md:block w-5/12 ${
                      isEven ? 'order-1 text-right pr-10' : 'order-1 text-right pr-10'
                    }`}
                  >
                    {!isEven ? (
                      <div className="p-4 rounded-xl transition-all duration-200 group-hover:bg-[#faf8f5]">
                        <h4 className="font-sans text-lg font-bold text-[#580c1e] group-hover:text-[#781029] transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-sm text-[#665e5d] mt-1 font-light">{item.desc}</p>
                      </div>
                    ) : (
                      <div className="p-4">
                        <span className="font-serif text-2xl sm:text-3xl font-bold text-[#1a1918]">
                          {item.date}
                        </span>
                        {isCurrent && (
                          <span className="inline-block ml-2.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] bg-[#d4af37]/20 text-[#6e4f00] rounded-full border border-[#d4af37]/40">
                            Active
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Marker node */}
                  <div
                    className={`absolute left-4 md:left-1/2 transform -translate-x-1/2 w-5 h-5 rounded-full border-4 border-white z-10 transition-transform duration-300 group-hover:scale-125 shadow-md ${
                      isCurrent
                        ? 'bg-[#580c1e] ring-4 ring-[#580c1e]/25'
                        : isCompleted
                        ? 'bg-[#d4af37]'
                        : 'bg-[#9c9594]'
                    }`}
                  />

                  {/* Right Column (Desktop) */}
                  <div
                    className={`ml-12 md:ml-0 md:w-5/12 ${
                      isEven ? 'md:order-3 md:pl-10' : 'md:order-3 md:pl-10'
                    }`}
                  >
                    {!isEven ? (
                      <div className="p-4">
                        <span className="font-serif text-2xl sm:text-3xl font-bold text-[#1a1918]">
                          {item.date}
                        </span>
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 ml-2.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Closed
                          </span>
                        )}
                        <div className="md:hidden mt-2">
                          <h4 className="font-sans text-base font-bold text-[#580c1e]">
                            {item.title}
                          </h4>
                          <p className="text-xs text-[#665e5d] mt-0.5 font-light">{item.desc}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl transition-all duration-200 group-hover:bg-[#faf8f5]">
                        <div className="md:hidden">
                          <span className="font-serif text-2xl font-bold text-[#1a1918]">
                            {item.date}
                          </span>
                          {isCurrent && (
                            <span className="inline-block ml-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] bg-[#d4af37]/20 text-[#6e4f00] rounded-full border border-[#d4af37]/40">
                              Active
                            </span>
                          )}
                        </div>
                        <h4 className="font-sans text-lg font-bold text-[#580c1e] group-hover:text-[#781029] transition-colors mt-1 md:mt-0">
                          {item.title}
                        </h4>
                        <p className="text-sm text-[#665e5d] mt-1 font-light">{item.desc}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
