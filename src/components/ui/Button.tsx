import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const styles: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7] hover:brightness-110 shadow-md border border-[#d4af37]/30',
  secondary: 'bg-white border border-black/15 text-[#1a1918] hover:bg-[#faf8f5]',
  ghost: 'text-[#580c1e] hover:bg-[#580c1e]/8',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export function Button({ variant = 'primary', loading, icon, size = 'md', className = '', children, disabled, ...rest }: ButtonProps) {
  const sizing = size === 'sm' ? 'px-4 py-2 text-[11px]' : 'px-6 py-3 text-xs';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${sizing} ${styles[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
