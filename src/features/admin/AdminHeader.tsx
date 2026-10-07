import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, FileText, LayoutDashboard, LogOut, UserCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

const navLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
    isActive ? 'bg-[#580c1e] text-[#fef3c7]' : 'text-[#4e4443] hover:bg-black/[0.04]'
  }`;

/**
 * Header for every /admin page (the public site navbar and footer are not shown there):
 * logo, admin sections (once signed in), "Back to site" and the signed-in admin with Logout.
 */
export function AdminHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const signOut = async () => {
    await logout();
    navigate('/admin', { replace: true });
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-b border-black/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center gap-4">
        <Link to="/admin" aria-label="ENDOCON 2027 admin" className="flex items-center gap-3 shrink-0">
          <img src="/endocon-logo.png" alt="ENDOCON 2027" className="h-9 md:h-12 w-auto" />
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-md bg-[#580c1e]/[0.07] text-[10px] font-bold uppercase tracking-[0.16em] text-[#580c1e]">Admin</span>
        </Link>

        {isAdmin && (
          <nav aria-label="Admin sections" className="hidden md:flex items-center gap-1 ml-4">
            <NavLink to="/admin" end className={navLink}>
              <LayoutDashboard className="w-3.5 h-3.5" /> Registrations
            </NavLink>
            <NavLink to="/admin/abstracts" className={navLink}>
              <FileText className="w-3.5 h-3.5" /> Abstracts
            </NavLink>
            <NavLink to="/admin/reviewers" className={navLink}>
              <UserCheck className="w-3.5 h-3.5" /> Reviewers
            </NavLink>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs font-bold text-[#580c1e] border border-[#580c1e]/25 hover:bg-[#580c1e]/5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to site</span>
            <span className="sm:hidden">Site</span>
          </Link>

          {isAdmin && (
            <div className="pl-2 sm:pl-3 border-l border-black/[0.08]">
              <AdminUserMenu name={user.fullName || 'Administrator'} email={user.email} onLogout={signOut} />
            </div>
          )}
        </div>
      </div>

      {/* Sections on small screens */}
      {isAdmin && (
        <nav aria-label="Admin sections" className="md:hidden border-t border-black/[0.05] px-4 py-2 flex gap-1 overflow-x-auto">
          <NavLink to="/admin" end className={navLink}>
            <LayoutDashboard className="w-3.5 h-3.5" /> Registrations
          </NavLink>
          <NavLink to="/admin/abstracts" className={navLink}>
            <FileText className="w-3.5 h-3.5" /> Abstracts
          </NavLink>
          <NavLink to="/admin/reviewers" className={navLink}>
            <UserCheck className="w-3.5 h-3.5" /> Reviewers
          </NavLink>
        </nav>
      )}
    </header>
  );
}

/** The signed-in admin; clicking opens a dropdown with the account details and Logout. */
function AdminUserMenu({ name, email, onLogout }: { name: string; email: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 pl-1 pr-2 lg:pr-3 py-1 rounded-full hover:bg-black/[0.04] transition-colors cursor-pointer"
      >
        <span aria-hidden className="w-8 h-8 rounded-full bg-gradient-to-br from-[#580c1e] to-[#781029] text-[#fef3c7] text-xs font-bold flex items-center justify-center uppercase">
          {name.trim().charAt(0) || email.charAt(0)}
        </span>
        <span className="hidden lg:block max-w-[180px] leading-tight text-left">
          <span className="block text-xs font-bold text-[#1a1918] truncate">{name}</span>
          <span className="block text-[11px] text-[#665e5d] truncate">{email}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-[#580c1e] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-[0_12px_40px_rgba(88,12,30,0.15)] border border-black/[0.06] py-2 z-[70]">
          <div className="px-4 pb-2 mb-1 border-b border-black/[0.06]">
            <p className="text-sm font-semibold text-[#1a1918] truncate">{name}</p>
            <p className="text-[11px] text-[#665e5d] truncate">{email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
