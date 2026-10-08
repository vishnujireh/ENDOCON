import React, { useState } from 'react';
import { MapPin, Plane, Hotel, Car, ExternalLink, Compass, PhoneCall } from 'lucide-react';
import venuimg from '../../public/royal-bengal.png';
export const VenueSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'travel' | 'hotel'>('overview');

  return (
    <section id="venue" className="py-24 md:py-32 bg-[#faf8f5] px-4 sm:px-6 lg:px-8 border-b border-black/[0.04]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-14 items-center">
          {/* Left Column: Details */}
          <div className="lg:w-1/2">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#c89e37] mb-2.5">
              <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
              Destination &amp; Stay
            </div>
            <h2 className="font-serif text-3xl sm:text-5xl text-[#1a1918] font-bold tracking-tight mb-2">
              Venue &amp; Stay
            </h2>
            <h3 className="font-serif text-2xl sm:text-3xl text-[#580c1e] font-bold mb-3">
              ITC Royal Bengal
            </h3>
            <p className="text-xs sm:text-sm text-[#665e5d] mb-6 flex items-start gap-2 font-light">
              <MapPin className="w-4 h-4 text-[#c89e37] shrink-0 mt-0.5" />
              <span>1 JBS Haldane Avenue, Kolkata, West Bengal, India, 700046.</span>
            </p>

            <p className="text-base text-[#4e4443] mb-8 leading-relaxed font-light">
              Experience signature Indian hospitality, lush water gardens, and world-class
              conference facilities in the heart of Kolkata. Specially negotiated corporate room
              tariffs have been arranged for registered conference attendees.
            </p>

            {/* Travel Assistance & Hotel Grid */}
            {/* <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-6 border-t border-black/[0.06]">
              <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                <h4 className="font-serif text-base font-bold text-[#1a1918] mb-2 flex items-center gap-2">
                  <Plane className="w-4 h-4 text-[#c89e37]" />
                  Airport Transit
                </h4>
                <p className="text-xs text-[#665e5d] leading-relaxed font-light">
                  Located 14 km (25 mins via EM Bypass) from Netaji Subhash Chandra Bose
                  International Airport (CCU). Dedicated welcome desk available in Terminal 2.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                <h4 className="font-serif text-base font-bold text-[#1a1918] mb-2 flex items-center gap-2">
                  <Hotel className="w-4 h-4 text-[#c89e37]" />
                  Delegate Booking
                </h4>
                <p className="text-xs text-[#665e5d] leading-relaxed font-light">
                  Use exclusive promo code <strong className="text-[#580c1e] font-semibold">IMCK2024</strong> when
                  reserving directly with ITC Sonar or ITC Royal Bengal for 30% discount.
                </p>
              </div>
            </div> */}

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="https://maps.app.goo.gl/BzvvPmAE2T4xdfaK6"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7] font-bold text-xs uppercase tracking-wider hover:brightness-110 transition-all shadow-md cursor-pointer border border-[#d4af37]/30"
              >
                <Compass className="w-4 h-4 text-[#d4af37]" /> Get Directions (Google Maps)
                <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
              </a>
              {/* <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border border-black/[0.08] text-[#4e4443] text-xs font-medium shadow-2xs">
                <PhoneCall className="w-3.5 h-3.5 text-[#580c1e]" /> Hospitality Concierge: +91 33 2345 4545
              </div> */}
            </div>
          </div>

          {/* Right Column: Visual Interactive Map Showcase */}
          <div className="lg:w-1/2 w-full">
            <div className="bg-white rounded-3xl overflow-hidden border border-black/[0.06] shadow-[0_15px_40px_rgba(15,23,42,0.06)]">
              {/* Visual Card Header with Photo */}
              <div className="relative aspect-video bg-slate-100 overflow-hidden">
                <img
                  src={venuimg}
                  alt="ITC Sonar Luxury Hotel & Conference Center"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-7 text-white">
                  <span className="text-[10px] uppercase font-bold tracking-[0.16em] bg-[#d4af37] text-[#332200] px-3 py-0.5 rounded-full w-max mb-2 shadow-xs">
                    Official Venue
                  </span>
                  <h4 className="font-serif text-2xl font-bold text-white">ITC Royal Bengal</h4>
                  {/* <p className="text-xs text-white/80 font-light">Pala Hall, Plenary Halls A/B, Exhibition Arena</p> */}
                </div>
              </div>

              {/* Interactive Floor & Transit Info */}
              <div className="p-7">
                <div className="flex border-b border-black/[0.06] pb-3 mb-5 gap-6 text-xs font-semibold uppercase tracking-wider">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`transition-colors cursor-pointer ${
                      activeTab === 'overview'
                        ? 'text-[#580c1e] border-b-2 border-[#580c1e] pb-3 -mb-3.5 font-bold'
                        : 'text-[#665e5d] hover:text-[#1a1918]'
                    }`}
                  >
                    Venue Facilities
                  </button>
                  <button
                    onClick={() => setActiveTab('travel')}
                    className={`transition-colors cursor-pointer ${
                      activeTab === 'travel'
                        ? 'text-[#580c1e] border-b-2 border-[#580c1e] pb-3 -mb-3.5 font-bold'
                        : 'text-[#665e5d] hover:text-[#1a1918]'
                    }`}
                  >
                    Distance &amp; Cab
                  </button>
                  {/* <button
                    onClick={() => setActiveTab('hotel')}
                    className={`transition-colors cursor-pointer ${
                      activeTab === 'hotel'
                        ? 'text-[#580c1e] border-b-2 border-[#580c1e] pb-3 -mb-3.5 font-bold'
                        : 'text-[#665e5d] hover:text-[#1a1918]'
                    }`}
                  >
                    Partner Hotels
                  </button> */}
                </div>

                {activeTab === 'overview' && (
                  <div className="text-xs text-[#665e5d] space-y-3 font-light">
                    <div className="flex justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="font-semibold text-[#1a1918]">Plenary Hall A:</span>
                      <span>Capacity 1,200 (Tiered auditorium with dual projection)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="font-semibold text-[#1a1918]">Exhibition Arena:</span>
                      <span>70 Booths, E-poster zone, and Networking Lounge</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="font-semibold text-[#1a1918]">Catering:</span>
                      <span>Gourmet multi-cuisine Bengali, Pan-Asian &amp; Continental</span>
                    </div>
                  </div>
                )}

                {activeTab === 'travel' && (
                  <div className="text-xs text-[#665e5d] space-y-3 font-light">
                    <div className="flex justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="font-semibold text-[#1a1918]">CCU Airport:</span>
                      <span>16 Km (~40 Mins)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="font-semibold text-[#1a1918]">Howrah Railway Station:</span>
                      <span>14 Km (~50 Mins)</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="font-semibold text-[#1a1918]">Sealdah Station:</span>
                      <span>6 Km (~25 Mins)</span>
                    </div>
                  </div>
                )}

                {/* {activeTab === 'hotel' && (
                  <div className="text-xs text-[#665e5d] space-y-3 font-light">
                    <div className="flex justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="font-semibold text-[#1a1918]">ITC Royal Bengal (5-Star):</span>
                      <span className="text-[#580c1e] font-semibold">Interconnected to venue</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="font-semibold text-[#1a1918]">JW Marriott Kolkata:</span>
                      <span>1.5 km (~5 mins drive)</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="font-semibold text-[#1a1918]">Hyatt Regency:</span>
                      <span>4 km (~10 mins drive)</span>
                    </div>
                  </div>
                )} */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
