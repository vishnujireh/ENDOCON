import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Calendar, MapPin } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { UserMenu } from './UserMenu';
import { DASHBOARD_PATH, withNext } from '../lib/nav';
import endologo from '../../public/endocon-logo.png'

/** Site header. Section links scroll on the landing page; auth buttons reflect the session. */
export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const currentPage = pathname === '/' ? 'home' : pathname.replace(/^\//, '');
  // "Register" opens the login page (new users create an account from there). Afterwards they land on
  // My ENDOCON and choose conference registration or abstract submission.
  const onOpenRegister = () => navigate(withNext('/login', DASHBOARD_PATH));
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }

      if (currentPage !== 'home') return;

      // Active section detector
      const sections = [
        'home',
        'committee',
        'faculty',
        'program',
        'registration',
        'abstract',
        'submit-abstract', // the inline submission form belongs to the Abstract menu item
        'sponsors',
        'venue',
        'downloads',
      ];
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && rect.bottom >= 120) {
            setActiveSection(sectionId === 'submit-abstract' ? 'abstract' : sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentPage]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const targetId = href.replace('#', '');

    if (currentPage !== 'home') {
      navigate(`/?section=${targetId}`);
      setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          const headerOffset = 75;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
          });
        }
      }, 150);
      return;
    }

    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 75;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const navLinks = [
    { name: 'Home', href: '#home', id: 'home' },
    { name: 'Organizing Committee', href: '#committee', id: 'committee' },
    { name: 'Faculty', href: '#faculty', id: 'faculty' },
    { name: 'Program', href: '#program', id: 'program' },
    { name: 'Registration', href: '#registration', id: 'registration' },
    { name: 'Abstract', href: '#abstract', id: 'abstract' },
    { name: 'Sponsors', href: '#sponsors', id: 'sponsors' },
    { name: 'Venue', href: '#venue', id: 'venue' },
    // { name: 'Downloads', href: '#downloads', id: 'downloads' },
  ];

  return (
    <header
      id="main-header"
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white border-b border-black/[0.06] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] py-3'
          : 'bg-white border-b border-[#580c1e]/10 py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        {/* Brand Logo */}
        <a
          href="#home"
          onClick={(e) => handleNavClick(e, '#home')}
          className="flex items-center gap-3 group"
          id="brand-logo"
        >
           <img src={endologo} alt="ENDOCON 2027" className="h-10 md:h-16 w-auto" />
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-1 lg:gap-2 text-[13px] font-medium tracking-wide">
          {navLinks.map((link) => {
            const isActive = currentPage === 'home' && activeSection === link.id; // no section is "current" on other pages
            return (
              <a
                key={link.id}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`px-3 py-1.5 rounded-full transition-all duration-150 ${
                  isActive
                    ? 'text-[#580c1e] font-semibold bg-[#580c1e]/8 border border-[#580c1e]/15 shadow-2xs'
                    : 'text-[#4e4443] hover:text-[#580c1e] hover:bg-black/[0.03]'
                }`}
              >
                {link.name}
              </a>
            );
          })}

          <div className="ml-3">
            {user ? (
              <UserMenu />
            ) : (
              <button
                onClick={onOpenRegister}
                className="px-5 py-2 rounded-full active:scale-95 transition-all text-xs font-bold uppercase tracking-wider shadow-sm border border-[#d4af37]/40 cursor-pointer bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7] hover:text-white hover:shadow-[0_4px_14px_rgba(88,12,30,0.25)]"
                id="header-register-btn"
              >
                Register
              </button>
            )}
          </div>
        </nav>

        {/* Mobile / Tablet Menu Button */}
        <div className="flex items-center gap-2 xl:hidden">
          {user ? (
            <UserMenu compact />
          ) : (
            <button onClick={onOpenRegister} className="bg-[#580c1e] text-[#fef3c7] px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs hover:bg-[#781029] transition-colors cursor-pointer border border-[#d4af37]/30">
              Register
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="p-2 text-[#1a1918] hover:text-[#580c1e] focus:outline-none focus:ring-2 focus:ring-[#580c1e]/20 rounded-xl cursor-pointer"
            id="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="xl:hidden bg-[#fbf9f6] border-b border-[#e0bfbc]/50 shadow-xl max-h-[82vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200"
        >
          <div className="px-6 py-4 flex flex-col gap-1 text-sm font-medium">
            <div className="flex items-center gap-3 py-2 px-3 mb-2 bg-[#f5f3f0] rounded-lg text-xs text-[#58413f]">
              <span className="flex items-center gap-1 font-semibold text-[#70010b]">
                <Calendar className="w-3.5 h-3.5" /> 22–25 April 2027
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> ITC Royal Bengal
              </span>
            </div>

            {navLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`py-2.5 px-3 rounded-lg border-b border-[#efeeeb] transition-colors ${
                  currentPage === 'home' && activeSection === link.id
                    ? 'bg-[#70010b]/10 text-[#70010b] font-bold'
                    : 'text-[#353534] hover:bg-[#eae8e5]'
                }`}
              >
                {link.name}
              </a>
            ))}

            {!user && (
              <div className="pt-4 pb-2 flex flex-col gap-2">
                <button onClick={() => { setMobileMenuOpen(false); onOpenRegister(); }} className="w-full bg-[#70010b] text-white py-2.5 rounded-full text-center font-bold text-xs shadow-md hover:bg-[#ac3230] transition-colors">
                  Register Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
