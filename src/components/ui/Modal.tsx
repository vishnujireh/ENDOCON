import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  /** Long forms set this to false so a stray click outside doesn't discard the user's input. */
  closeOnBackdrop?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={closeOnBackdrop ? onClose : undefined}>
      <div className={`bg-white rounded-3xl w-full ${width} max-h-[90vh] overflow-y-auto shadow-2xl border border-black/[0.08] relative`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-black/[0.06]">
          <h3 className="font-serif text-lg font-bold text-[#1a1918]">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-[#665e5d] hover:text-[#580c1e] hover:bg-[#faf8f5] cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
