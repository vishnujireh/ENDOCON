import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ClipboardList, FileText, House, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

/** Logged-in user's name with a dropdown (portal links + logout). Renders nothing when logged out. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  if (!user) return null;

  const name = [user.title, user.fullName].filter(Boolean).join(' ') || user.email;
  const initials = (user.fullName || user.email)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };
  const doLogout = async () => {
    setOpen(false);
    await logout();
    navigate(user.role === 'admin' ? '/admin' : '/');
  };

  const items =
    user.role === 'admin'
      ? [{ label: 'Admin Panel', icon: <LayoutDashboard className="w-4 h-4" />, to: '/admin' }]
      : [
          { label: 'My ENDOCON', icon: <House className="w-4 h-4" />, to: '/dashboard' },
          { label: 'My Registration', icon: <ClipboardList className="w-4 h-4" />, to: '/registration' },
          { label: 'My Abstracts', icon: <FileText className="w-4 h-4" />, to: '/my-abstracts' },
        ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-[#580c1e]/20 bg-white hover:bg-[#580c1e]/5 transition-colors cursor-pointer"
        id="user-menu-button"
      >
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#580c1e] to-[#781029] text-[#fef3c7] text-xs font-bold flex items-center justify-center">
          {initials}
        </span>
        {!compact && <span className="text-xs font-semibold text-[#1a1918] max-w-[160px] truncate">{name}</span>}
        <ChevronDown className={`w-4 h-4 text-[#580c1e] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-[0_12px_40px_rgba(88,12,30,0.15)] border border-black/[0.06] py-2 z-[70]">
          <div className="px-4 pb-2 mb-1 border-b border-black/[0.06]">
            <p className="text-sm font-semibold text-[#1a1918] truncate">{name}</p>
            <p className="text-[11px] text-[#665e5d] truncate">{user.email}</p>
          </div>
          {items.map((it) => (
            <button
              key={it.to}
              role="menuitem"
              onClick={() => go(it.to)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#1a1918] hover:bg-[#faf8f5] cursor-pointer"
            >
              <span className="text-[#580c1e]">{it.icon}</span> {it.label}
            </button>
          ))}
          <button
            role="menuitem"
            onClick={doLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-700 hover:bg-red-50 cursor-pointer border-t border-black/[0.06] mt-1"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
