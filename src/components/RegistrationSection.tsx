import React from 'react';
import {
  CONFERENCE_REGISTRATION_PACKAGES,
  ACCOMMODATION_OPTIONS,
} from '../data/conferenceData';
import {
  CheckCircle2,
  Sparkles,
  UtensilsCrossed,
  Wine,
  PartyPopper,
  Briefcase,
  Award,
  BedDouble,
  Calendar,
  ArrowRight,
  Clock,
  Sparkle,
} from 'lucide-react';

interface RegistrationSectionProps {
  onSelectTier: (tierId: string) => void;
}

export const RegistrationSection: React.FC<RegistrationSectionProps> = ({ onSelectTier }) => {
  return (
    <section
      id="registration"
      className="py-20 sm:py-28 bg-[#faf8f5] px-4 sm:px-6 lg:px-8 border-b border-black/[0.05]"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#faeae7] border border-[#f5d5cf] text-[11px] font-bold uppercase tracking-[0.18em] text-[#70010b] mb-3">
            <Sparkle className="w-3 h-3 text-[#c89e37]" />
            CONFERENCE REGISTRATION (Non-Residential)
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-bold text-[#1a1918] tracking-tight leading-tight">
            Registration Fee Schedule
          </h2>

          <p className="mt-3 text-sm sm:text-base text-[#665e5d] font-light leading-relaxed">
            All registration categories, deadlines, and tariffs are presented below. Early Bird
            tariffs apply for registrations completed up to 15th January.
          </p>
        </div>

        {/* Official Inclusions Bar - High Visibility */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-black/[0.06] shadow-xs mb-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#1a1918] shrink-0">
              <Award className="w-4 h-4 text-[#580c1e]" />
              <span>Registration Inclusions:</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[#4e4443]">
              <span className="inline-flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-[#c89e37]" />
                <strong className="text-[#1a1918]">4 Lunch</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wine className="w-3.5 h-3.5 text-[#c89e37]" />
                <strong className="text-[#1a1918]">2 Dinner</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PartyPopper className="w-3.5 h-3.5 text-[#c89e37]" />
                <strong className="text-[#580c1e] font-bold">1 Gala Dinner</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#c89e37]" />
                <span>Registration Kit</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#c89e37]" />
                <span>Certificate of Participation</span>
              </span>
            </div>

            <div className="text-[11px] font-bold text-[#70010b] bg-[#faeae7] px-3 py-1 rounded-md border border-[#f5d5cf] shrink-0">
              18% GST Excluded
            </div>
          </div>
        </div>

        {/* All Data Visible: Modern Clean Fee Schedule */}
        <div className="bg-white rounded-3xl border border-black/[0.08] shadow-sm overflow-hidden mb-8">
          {/* Desktop & Tablet Table Layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#580c1e] text-[#fef3c7] font-serif text-sm">
                  <th className="py-4.5 px-6 font-semibold w-1/3">Category</th>
                  <th className="py-4.5 px-5 font-semibold bg-[#6b0f25] border-x border-white/10">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#c89e37]" />
                      <span>Early Bird</span>
                    </div>
                    <span className="block text-[10px] font-sans font-normal text-[#fef3c7]/80 mt-0.5">
                      “Till 15th January”
                    </span>
                  </th>
                  <th className="py-4.5 px-5 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#c89e37]/80" />
                      <span>Regular</span>
                    </div>
                    <span className="block text-[10px] font-sans font-normal text-[#fef3c7]/80 mt-0.5">
                      “16th January – 10th April”
                    </span>
                  </th>
                  <th className="py-4.5 px-5 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#c89e37]/80" />
                      <span>On-spot</span>
                    </div>
                    <span className="block text-[10px] font-sans font-normal text-[#fef3c7]/80 mt-0.5">
                      “Venue Counter”
                    </span>
                  </th>
                  <th className="py-4.5 px-6 font-semibold text-right">Register</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-sm">
                {CONFERENCE_REGISTRATION_PACKAGES.map((pkg, index) => {
                  const isEven = index % 2 === 0;

                  return (
                    <tr
                      key={pkg.id}
                      className={`hover:bg-[#fef9f5] transition-colors ${
                        isEven ? 'bg-white' : 'bg-[#faf8f5]/60'
                      }`}
                    >
                      {/* Category Name & Subtitle */}
                      <td className="py-4.5 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-base text-[#1a1918]">
                            {pkg.category}
                          </span>
                          {pkg.badge && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#7b5900] border border-[#c89e37]/30">
                              {pkg.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#665e5d] font-light mt-0.5 line-clamp-1">
                          {pkg.qualification}
                        </p>
                      </td>

                      {/* Early Bird Price (Highlighted Column) */}
                      <td className="py-4.5 px-5 bg-[#faf5f0]/80 border-x border-black/[0.04]">
                        <div className="font-serif text-base font-bold text-[#580c1e]">
                          {pkg.earlyBird}
                        </div>
                        <span className="text-[10px] text-[#c89e37] font-semibold block">
                          Best Value Rate
                        </span>
                      </td>

                      {/* Regular Price */}
                      <td className="py-4.5 px-5">
                        <div className="font-serif text-base font-semibold text-[#1a1918]">
                          {pkg.regular}
                        </div>
                      </td>

                      {/* On-Spot Price */}
                      <td className="py-4.5 px-5">
                        <div className="font-serif text-base font-semibold text-[#665e5d]">
                          {pkg.onSpot}
                        </div>
                      </td>

                      {/* Register Button */}
                      <td className="py-4.5 px-6 text-right">
                        <button
                          onClick={() => onSelectTier(pkg.id)}
                          className="px-4 py-2 rounded-xl bg-[#580c1e] hover:bg-[#781029] text-[#fef3c7] text-xs font-bold transition-all shadow-2xs hover:shadow inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Register</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Clean Row-Card Layout (All 6 Visible, No Horizontal Squish) */}
          <div className="block md:hidden divide-y divide-black/[0.08]">
            {CONFERENCE_REGISTRATION_PACKAGES.map((pkg) => (
              <div key={pkg.id} className="p-4.5 bg-white space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-serif font-bold text-base text-[#1a1918]">
                      {pkg.category}
                    </h4>
                    <p className="text-xs text-[#665e5d] font-light">{pkg.qualification}</p>
                  </div>
                  {pkg.badge && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#7b5900] shrink-0 border border-[#c89e37]/30">
                      {pkg.badge}
                    </span>
                  )}
                </div>

                {/* 3 Phases Grid */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#faf8f5] border border-black/[0.04] text-center">
                  <div className="bg-white p-2 rounded-lg border border-[#580c1e]/20 shadow-2xs">
                    <span className="block text-[9px] uppercase font-bold text-[#580c1e]">
                      Early Bird
                    </span>
                    <span className="font-serif text-xs font-bold text-[#580c1e] block mt-0.5">
                      {pkg.earlyBird}
                    </span>
                    <span className="text-[8px] text-[#665e5d] block">Till 15 Jan</span>
                  </div>

                  <div className="p-2 rounded-lg">
                    <span className="block text-[9px] uppercase font-semibold text-[#665e5d]">
                      Regular
                    </span>
                    <span className="font-serif text-xs font-bold text-[#1a1918] block mt-0.5">
                      {pkg.regular}
                    </span>
                    <span className="text-[8px] text-[#665e5d] block">16 Jan - 10 Apr</span>
                  </div>

                  <div className="p-2 rounded-lg">
                    <span className="block text-[9px] uppercase font-semibold text-[#665e5d]">
                      On-Spot
                    </span>
                    <span className="font-serif text-xs font-bold text-[#665e5d] block mt-0.5">
                      {pkg.onSpot}
                    </span>
                    <span className="text-[8px] text-[#665e5d] block">Venue Counter</span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectTier(pkg.id)}
                  className="w-full py-2.5 rounded-xl bg-[#580c1e] text-[#fef3c7] text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-2xs"
                >
                  <span>Register for {pkg.category}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Mandatory Footnotes - Direct from Screenshot */}
          <div className="p-5 sm:p-6 bg-[#faf8f5] border-t border-black/[0.06] text-xs text-[#58413f] space-y-1.5 font-light">
            <p className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#580c1e] shrink-0 mt-1.5" />
              <span>
                <strong className="text-[#1a1918] font-bold">18% GST Excluded.</strong> Taxes will
                be calculated as applicable.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#580c1e] shrink-0 mt-1.5" />
              <span>
                <strong className="text-[#1a1918] font-bold">Registration Inclusions:</strong>{' '}
                Registration, <strong className="text-[#580c1e] font-semibold">4 Lunch</strong>,{' '}
                <strong className="text-[#580c1e] font-semibold">2 Dinner</strong>,{' '}
                <strong className="text-[#580c1e] font-semibold">1 Gala Dinner</strong>,
                Registration Kit and Certificate of Participation.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#580c1e] shrink-0 mt-1.5" />
              <span>
                <strong className="text-[#1a1918] font-bold">Accommodation:</strong> Registration
                fee does not include any accommodation fee. Please see accommodation charges below.
              </span>
            </p>
          </div>
        </div>

        {/* Accommodation Charges Section - Fully Visible */}
        <div id="accommodation-charges" className="mt-14 sm:mt-16 pt-10 border-t border-black/[0.08]">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#faeae7] border border-[#f5d5cf] text-[11px] font-bold uppercase tracking-[0.18em] text-[#70010b] mb-2.5">
              <BedDouble className="w-3 h-3 text-[#c89e37]" />
              ACCOMMODATION CHARGES
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#1a1918]">
              Official Hotel Stays (Per Night Tariffs)
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-[#665e5d] font-light">
              Negotiated delegate rates for conference participants. <strong className="text-[#580c1e]">18% GST Excluded.</strong>
            </p>
          </div>

          {/* Accommodation Schedule - Clean Row/Card Design */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {ACCOMMODATION_OPTIONS.map((hotel) => (
              <div
                key={hotel.id}
                className={`bg-white rounded-3xl p-6 sm:p-7 border flex flex-col justify-between ${
                  hotel.isVenue
                    ? 'border-[#c89e37] shadow-sm ring-1 ring-[#c89e37]/30'
                    : 'border-black/[0.08] shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      {hotel.isVenue && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7b5900] bg-[#fef3c7] px-2.5 py-0.5 rounded-full mb-2 inline-block">
                          Summit Venue Hotel
                        </span>
                      )}
                      <h4 className="font-serif text-xl sm:text-2xl font-bold text-[#1a1918]">
                        {hotel.hotel}
                      </h4>
                      <p className="text-xs text-[#665e5d] font-light mt-0.5">{hotel.category}</p>
                    </div>
                  </div>

                  {/* Pricing Comparison */}
                  <div className="grid grid-cols-2 gap-3 my-5">
                    <div className="p-3.5 rounded-2xl bg-[#faf8f5] border border-black/[0.05]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] block">
                        Single Occupancy
                      </span>
                      <div className="font-serif text-lg sm:text-xl font-bold text-[#580c1e] mt-0.5">
                        {hotel.singleOccupancy}
                        <span className="text-[10px] font-sans font-normal opacity-75 ml-1">/night</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#faf8f5] border border-black/[0.05]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] block">
                        Twin Share
                      </span>
                      <div className="font-serif text-lg sm:text-xl font-bold text-[#580c1e] mt-0.5">
                        {hotel.twinShare}
                        <span className="text-[10px] font-sans font-normal opacity-75 ml-1">/person</span>
                      </div>
                    </div>
                  </div>

                  {/* Highlights */}
                  <ul className="space-y-2 text-xs text-[#4e4443] font-light mb-6">
                    {hotel.highlights.slice(0, 3).map((h, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#c89e37] shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => onSelectTier('sgei-member')}
                  className="w-full py-2.5 rounded-xl border border-[#580c1e] text-[#580c1e] hover:bg-[#580c1e] hover:text-[#fef3c7] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Book Stay with Registration</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Direct Notice Under Hotel Section */}
          <div className="max-w-2xl mx-auto text-center text-xs text-[#665e5d] font-light mb-4">
            • <strong className="text-[#1a1918]">18% GST Excluded.</strong> Early hotel reservation is strongly advised due to limited summit venue inventory.
          </div>
        </div>
      </div>
    </section>
  );
};
