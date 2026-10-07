import React, { useState, useEffect } from 'react';
import { SGEI_GOVERNING_COUNCIL, CORE_COMMITTEE } from '../data/conferenceData';
import { CommitteeMember } from '../types';
import { Award, Building2, ChevronRight, X, Shield, Users } from 'lucide-react';

export type CommitteeTab = 'governing-council' | 'core-committee';

interface OrganizingCommitteeProps {
  initialTab?: CommitteeTab;
}

export const OrganizingCommittee: React.FC<OrganizingCommitteeProps> = ({
  initialTab = 'governing-council',
}) => {
  const [activeTab, setActiveTab] = useState<CommitteeTab>(initialTab);
  const [selectedMember, setSelectedMember] = useState<CommitteeMember | null>(null);

  // Listen for navigation clicks from the Header or external triggers
  useEffect(() => {
    const handleSwitchTab = (e: CustomEvent<CommitteeTab>) => {
      if (e.detail === 'governing-council' || e.detail === 'core-committee') {
        setActiveTab(e.detail);
      }
    };

    window.addEventListener('switch-committee-tab' as any, handleSwitchTab as EventListener);
    return () => {
      window.removeEventListener('switch-committee-tab' as any, handleSwitchTab as EventListener);
    };
  }, []);

  const members = activeTab === 'governing-council' ? SGEI_GOVERNING_COUNCIL : CORE_COMMITTEE;

  return (
    <section
      id="committee"
      className="py-24 md:py-32 bg-[#faf8f5] px-4 sm:px-6 lg:px-8 border-b border-black/[0.04]"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#c89e37] mb-2.5">
            <Award className="w-3.5 h-3.5 text-[#d4af37]" />
            Leadership &amp; Governance
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl text-[#1a1918] font-bold tracking-tight mb-3">
            Organizing Committee
          </h2>
          <p className="text-base text-[#665e5d] max-w-2xl mx-auto font-light">
            Guided by distinguished luminaries dedicated to advancing medical endoscopy science,
            clinical practice, and international collaboration.
          </p>
        </div>

        {/* Sub-Tabs: 1. SGEI Governing Council | 2. Core Committee */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex p-1.5 bg-black/[0.04] rounded-full border border-black/[0.06] shadow-2xs">
            <button
              onClick={() => setActiveTab('governing-council')}
              className={`px-6 sm:px-8 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                activeTab === 'governing-council'
                  ? 'bg-[#580c1e] text-[#fef3c7] shadow-sm font-bold'
                  : 'text-[#4e4443] hover:text-[#1a1918] hover:bg-white/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-[#c89e37]" />
              <span>1. SGEI Governing Council</span>
            </button>

            <button
              onClick={() => setActiveTab('core-committee')}
              className={`px-6 sm:px-8 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                activeTab === 'core-committee'
                  ? 'bg-[#580c1e] text-[#fef3c7] shadow-sm font-bold'
                  : 'text-[#4e4443] hover:text-[#1a1918] hover:bg-white/60'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#c89e37]" />
              <span>2. Core Committee</span>
            </button>
          </div>
        </div>

        {/* Tab Intro Description */}
        <div className="text-center mb-10 max-w-xl mx-auto">
          {activeTab === 'governing-council' ? (
            <p className="text-xs sm:text-sm text-[#580c1e] font-medium bg-[#580c1e]/5 py-2 px-4 rounded-full border border-[#580c1e]/10 inline-block">
              Society of Gastrointestinal Endoscopy of India (SGEI) Executive Leadership
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-[#580c1e] font-medium bg-[#580c1e]/5 py-2 px-4 rounded-full border border-[#580c1e]/10 inline-block">
              Local Organizing &amp; Scientific Working Committee — Kolkata 2024
            </p>
          )}
        </div>

        {/* Member Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {members.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-3xl overflow-hidden border border-black/[0.06] shadow-[0_10px_30px_rgba(15,23,42,0.04)] hover:shadow-[0_20px_45px_rgba(88,12,30,0.08)] flex flex-col group cursor-pointer transition-all duration-300"
             
            >
              {/* Image Container with 4:5 Aspect Ratio onClick={() => setSelectedMember(member)} */}
              <div className="aspect-[3/3] bg-slate-100 relative overflow-hidden">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {/* <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-5">
                  <span className="text-xs font-semibold text-[#fef3c7] inline-flex items-center gap-1.5 bg-[#580c1e] px-4 py-1.5 rounded-full border border-[#d4af37]/30 shadow-sm">
                    View Academic Profile <ChevronRight className="w-3 h-3 text-[#d4af37]" />
                  </span>
                </div> */}
              </div>

              {/* Card Body */}
              <div className="p-3 text-center flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-md font-serif font-bold text-[#1a1918] mb-1.5 group-hover:text-[#580c1e] transition-colors">
                    {member.name}
                  </h3>
                  <p className="text-xs font-semibold text-[#580c1e] mb-2">
                    {member.role}
                  </p>
                  {/* <p className="text-xs text-[#665e5d] flex items-center justify-center gap-1.5 font-light">
                    <Building2 className="w-3.5 h-3.5 text-[#c89e37]" />
                    {member.affiliation}
                  </p> */}
                </div>

                {/* <div className="mt-5 pt-3.5 border-t border-black/[0.05] text-xs text-[#c89e37] font-semibold flex items-center justify-center gap-1 group-hover:text-[#580c1e] transition-colors">
                  Academic Profile &amp; Biography
                </div> */}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal for Member Profile */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-black/[0.08] relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 p-2 text-[#665e5d] hover:text-[#580c1e] rounded-full hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
              <div className="w-32 h-40 rounded-2xl overflow-hidden shrink-0 border border-black/[0.08] shadow-sm">
                <img
                  src={selectedMember.image}
                  alt={selectedMember.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <span className="text-[11px] font-bold text-[#580c1e] uppercase tracking-wider bg-[#580c1e]/10 px-3 py-1 rounded-full border border-[#580c1e]/15">
                  {selectedMember.role}
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1a1918] mt-2.5 mb-1">
                  {selectedMember.name}
                </h3>
                {/* <p className="text-xs text-[#c89e37] font-semibold mb-3">
                  {selectedMember.affiliation}
                </p>
                <div className="text-sm text-[#4e4443] leading-relaxed font-light">
                  {selectedMember.bio}
                </div> */}
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setSelectedMember(null)}
                className="bg-[#580c1e] text-[#fef3c7] px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#781029] transition-all cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
