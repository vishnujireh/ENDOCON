import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useReviewerAuth } from './ReviewerAuth';

/** Header of the reviewer portal: logo, "Abstract Review", the signed-in judge and Logout. */
export function ReviewerHeader() {
  const { reviewer, logout } = useReviewerAuth();
  const navigate = useNavigate();
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-b border-black/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center gap-3">
        <Link to={reviewer ? '/reviewer' : '/reviewer/login'} className="flex items-center gap-3 shrink-0" aria-label="ENDOCON 2027 abstract review">
          <img src="/endocon-logo.png" alt="ENDOCON 2027" className="h-9 md:h-12 w-auto" />
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-md bg-[#580c1e]/[0.07] text-[10px] font-bold uppercase tracking-[0.16em] text-[#580c1e]">Abstract Review</span>
        </Link>
        {reviewer && (
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-[#1a1918] leading-tight">{reviewer.name}</p>
              <p className="text-[11px] text-[#665e5d]">
                {reviewer.reviewerCode} · {reviewer.email}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/reviewer/login', { replace: true });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-red-700 border border-red-200 hover:bg-red-50 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
