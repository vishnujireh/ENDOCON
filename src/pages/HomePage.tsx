import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ABSTRACT_FORM_PATH, withNext } from '../lib/nav';
import { AboutSection } from '../components/AboutSection';
import { AbstractSubmissionSection } from '../components/AbstractSubmissionSection';
import type { AbstractCategory } from '../api/types';
import { scrollToAbstractForm } from '../features/abstracts/PublicAbstractForm';
import { ContactSection } from '../components/ContactSection';
import { DownloadsSection } from '../components/DownloadsSection';
import { FacultySpeakers } from '../components/FacultySpeakers';
import { Hero } from '../components/Hero';
import { KolkataSection } from '../components/KolkataSection';
import { OrganizingCommittee } from '../components/OrganizingCommittee';
import { RegistrationSection } from '../components/RegistrationSection';
import { ScientificProgram } from '../components/ScientificProgram';
import { SponsorsSection } from '../components/SponsorsSection';
import { TimelineMilestones } from '../components/TimelineMilestones';
import { VenueSection } from '../components/VenueSection';
import { WelcomeMessage } from '../components/WelcomeMessage';

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** The existing landing page. CTAs now lead into the real registration / abstract flows. */
export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Support in-page anchors like /?section=venue from other pages.
  useEffect(() => {
    const section = new URLSearchParams(location.search).get('section');
    if (section) setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' }), 150);
  }, [location.search]);

  const openRegister = (tierCode?: string) => {
    const target = `/registration/wizard/conference${tierCode ? `?category=${encodeURIComponent(tierCode)}` : ''}`;
    if (!user) return navigate(withNext('/login', target));
    if (user.role === 'admin') return navigate('/admin');
    navigate(target);
  };
  // Abstracts are submitted on their own page (/abstracts/submit) with a free account. Signed-in
  // delegates go straight there; everyone else is shown the sign-in card in the abstract section.
  const openAbstract = (category?: AbstractCategory) => {
    if (user?.role === 'participant') return navigate(`${ABSTRACT_FORM_PATH}${category ? `?category=${category}` : ''}`);
    scrollToAbstractForm();
  };

  return (
    <>
      <Hero onOpenRegister={() => openRegister()} onOpenAbstract={() => openAbstract()} />
      <WelcomeMessage onOpenRegister={() => openRegister()} onOpenAbstract={() => openAbstract()} />
      <TimelineMilestones />
      <OrganizingCommittee />
      <FacultySpeakers />
      <AboutSection />
      <ScientificProgram
        onDownloadBrochure={() =>
          downloadText('ENDOCON2027_Scientific_Program.txt', 'ENDOCON 2027\nScientific Program\nDates: 22–25 April 2027\nVenue: ITC Royal Bengal, Kolkata, India\n(Detailed programme to be announced.)')
        }
      />
      <RegistrationSection onSelectTier={(code) => openRegister(code)} />
      <AbstractSubmissionSection onStartSubmission={openAbstract} />
      <SponsorsSection
        onDownloadProspectus={() => downloadText('ENDOCON2027_Sponsorship_Prospectus.txt', 'ENDOCON 2027\nIndustry Exhibition & Sponsorship Prospectus\n(Details to be announced.)')}
        onContactSponsors={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
      />
      <VenueSection />
      <KolkataSection />
      <DownloadsSection />
      <ContactSection />
    </>
  );
}
