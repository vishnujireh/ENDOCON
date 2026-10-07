import React from 'react';
import { ChevronRight, Calendar, MapPin, ArrowRight } from 'lucide-react';
import auditoriumImage from '../../public/wecombanner.webp';
import mukundapurImage from '../../public/mhesh-goenka.webp';
import sandipPalImage from '../../public/sandeep-pal.webp';

interface WelcomeMessageProps {
  onOpenRegister?: () => void;
  onOpenAbstract?: () => void;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({
  onOpenRegister,
  onOpenAbstract,
}) => {
  return (
    <section
      id="welcome-message"
      className="py-20 sm:py-28 lg:py-32 bg-[#faf8f5] px-4 sm:px-6 lg:px-8 border-b border-black/[0.05] relative overflow-x-clip"
    >
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column: Official Welcome Communiqué */}
          <div className="lg:col-span-6 xl:col-span-7">
            {/* Pill Eyebrow */}
            <div className="inline-block px-4 py-1.5 rounded-full bg-[#faeae7] border border-[#f5d5cf] text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#70010b] mb-6">
              WELCOME MESSAGE
            </div>

            {/* Main Headline */}
            <h2 className="font-serif text-3xl sm:text-5xl lg:text-[52px] font-bold text-[#1a1918] tracking-tight leading-[1.14]">
              Welcome to Endocon 2027,
              <span className="block text-[#70010b] mt-1">the City of Joy</span>
            </h2>

            {/* Gold Accent Bar */}
            <div className="w-14 h-1 bg-[#c89e37] rounded-full mt-5 mb-8" />

            {/* Letter Content with Drop Cap */}
            <div className="text-[#4a4543] text-[15px] sm:text-[16px] leading-[1.75] font-normal space-y-2 mb-9">
              <p className="font-serif italic font-semibold text-[#1a1918] text-lg">Dear Friends and Colleagues,</p>

              <p className="text-justify">
                <span className="float-left font-serif text-5xl sm:text-[56px] font-bold text-[#70010b] leading-none mr-3 pt-1 select-none">
                  I
                </span>
                t is our immense pleasure and privilege to welcome you to ENDOCON 2027, the 27th National
                Conference of the Society of Gastrointestinal Endoscopy of India (SGEI), to be held from
                22nd to 25th April 2027 at the magnificent city of Kolkata.
              </p>

              <p className="text-justify">
                Guided by the theme{' '}
                <strong className="font-semibold text-[#1a1918]">
                  &ldquo;Precision, Practice and Progress in GI Endoscopy,&rdquo;
                </strong>{' '}
                ENDOCON 2027 is envisioned as a meeting that celebrates excellence in gastrointestinal
                endoscopy while embracing the innovations that continue to redefine our specialty. As
                endoscopy evolves with advanced imaging, artificial intelligence, minimally invasive
                therapies, and increasingly sophisticated therapeutic interventions, our commitment remains
                steadfast&mdash;to translate technological advances into better patient care through
                precision, practical learning, and continuous progress.
              </p>

              <p className="text-justify">
                This four-day scientific extravaganza has been thoughtfully designed to bring together the
                finest minds in GI endoscopy from India and across the globe. Delegates can look forward to
                an exceptional academic program featuring live endoscopy demonstrations, state-of-the-art
                lectures, expert panel discussions, hands-on learning experiences, video sessions, debates,
                case-based discussions, young endoscopist forums, and interactive workshops covering the
                entire spectrum of diagnostic and therapeutic endoscopy.
              </p>

              <p className="text-justify">
                Whether you are an experienced endoscopist, a young gastroenterologist, a surgeon, a
                trainee, or an allied healthcare professional, ENDOCON 2027 promises a vibrant platform to
                enhance knowledge, refine skills, exchange ideas, and foster collaborations that will shape
                the future of gastrointestinal endoscopy.
              </p>

              <p className="text-justify">
                Beyond the scientific sessions, we invite you to experience the timeless charm of
                Kolkata&mdash;a city where heritage, culture, literature, art, and hospitality blend
                seamlessly with modern innovation. From the iconic Howrah Bridge and Victoria Memorial to its
                celebrated cuisine and warm hospitality, Kolkata offers an unforgettable backdrop for
                learning, networking, and reconnecting with colleagues and friends.
              </p>

              <p className="text-justify">
                We are confident that ENDOCON 2027 will be an enriching academic journey and a memorable
                professional experience for every participant.
              </p>

              <p className="text-justify">
                We warmly welcome you to Kolkata and look forward to your active participation in making
                ENDOCON 2027 a landmark event in the history of gastrointestinal endoscopy.
              </p>

              <p className="font-serif italic text-[#1a1918]">With warm regards,</p>
            </div>

            {/* Chairman Signature Block */}
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
<div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-full shadow text-white font-bold flex items-center justify-center text-sm tracking-wider shadow-sm shrink-0">
               <img src={mukundapurImage} alt="Dr. Mahesh Goenka" className="w-full h-full object-cover rounded-full" />
              </div>
              <div>
                <p className="font-serif italic font-semibold text-lg text-[#1a1918] tracking-tight leading-tight">
                  Dr. Mahesh Goenka
                </p>
                <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#70010b] mt-0.5">
                  Organizing Chairman · ENDOCON 2027
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-full shadow text-white font-bold flex items-center justify-center text-sm tracking-wider shadow-sm shrink-0">
                <img src={sandipPalImage} alt="Dr. Sandip Pal" className="w-full h-full object-cover rounded-full" />
              </div>
              <div>
                <p className="font-serif italic font-semibold text-lg text-[#1a1918] tracking-tight leading-tight">
                  Dr. Sandip Pal
                </p>
                <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#70010b] mt-0.5">
                  Organizing Secretary · ENDOCON 2027
                </p>
              </div>
            </div>
            </div>
            

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <button
                onClick={onOpenRegister}
                className="px-6 py-3 rounded-xl bg-[#70010b] hover:bg-[#560108] text-white text-sm font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer hover:shadow-md active:scale-98"
              >
                Register Now <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="/?section=program"
                onClick={(e) => {
                  e.preventDefault(); // scroll without putting "#program" in the address bar
                  document.getElementById('program')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3 rounded-xl border border-black/15 hover:border-black/30 hover:bg-black/[0.02] text-[#1a1918] text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
              >
                Explore Programme <ChevronRight className="w-4 h-4 text-[#70010b]" />
              </a>
            </div>
          </div>

          {/* Right Column: Visual Composition with Offset Backdrop and Floating Card */}
          <div className="lg:col-span-6 xl:col-span-5 relative pt-4 pb-8 lg:pb-0 lg:sticky lg:top-32 lg:mt-16">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              {/* Warm Offset Backdrop Accent */}
              <div
                className="absolute -top-4 -left-4 sm:-top-5 sm:-left-5 w-44 h-44 sm:w-56 sm:h-56 bg-[#fde9cf] rounded-[32px] -z-0 pointer-events-none"
                aria-hidden="true"
              />

              {/* Main Auditorium Stage Photo Card */}
              <div className="relative rounded-[28px] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.16)] z-10 border border-black/[0.08] group">
                <img
                  src={auditoriumImage}
                  alt="Endocon 2027 Plenary Auditorium Session"
                  className="w-full aspect-[5/3] object-cover transition-transform duration-700 group-hover:scale-103"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

                {/* Venue & Dates Caption at bottom of photo */}
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#fde9cf]" />
                    APRIL 22–25, 2027
                  </div>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white">
                    ITC Royal Bengal
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm text-white/80 font-light mt-1">
                    <MapPin className="w-3.5 h-3.5 text-[#fde9cf]" />
                    1 JBS Haldane Avenue, Kolkata, West Bengal, India, 700046.
                  </div>
                </div>
              </div>

              {/* Overlapping Floating Milestone Card */}
              {/* <div
                onClick={onOpenAbstract}
                className="absolute -bottom-6 -left-3 sm:-left-8 bg-white/98 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-[0_20px_45px_rgba(0,0,0,0.14)] border border-black/[0.06] z-20 min-w-[210px] sm:min-w-[240px] cursor-pointer hover:shadow-[0_25px_50px_rgba(0,0,0,0.2)] transition-all transform hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#78716c]">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  REGISTRATION OPEN
                </div>
                <div className="mt-2 text-xs sm:text-sm font-medium text-[#1a1918]">
                  Abstracts close
                </div>
                <div className="font-serif text-xl sm:text-2xl font-bold text-[#70010b] mt-0.5 tracking-tight">
                  30 Nov 2026
                </div>
              </div> */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
