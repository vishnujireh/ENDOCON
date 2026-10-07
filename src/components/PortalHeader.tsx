import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { UserMenu } from './UserMenu';
import endologo from '../../public/endocon-logo.png'

/**
 * Minimal header for the delegate pages (login, register, forgot/reset password and the
 * logged-in portal): logo only, no site navigation. Right side shows "Back to site" or,
 * when logged in, the user's name with a logout dropdown.
 */
export function PortalHeader() {
  const { user } = useAuth();
  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-black/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
        <Link to="/" aria-label="ENDOCON 2027 home" className="flex items-center">
          <img src={endologo} alt="ENDOCON 2027" className="h-10 md:h-14 w-auto" />
        </Link>
        {user ? (
          <UserMenu />
        ) : (
          <Link to="/" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-[#580c1e] border border-[#580c1e]/25 hover:bg-[#580c1e]/5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to site
          </Link>
        )}
      </div>
    </header>
  );
}
