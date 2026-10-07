import React from 'react';

/** Shared input styling – matches the existing Login/Register pages. */
export const inputClass =
  'w-full px-4 py-2.5 bg-[#faf8f5] border border-black/[0.08] rounded-xl text-sm text-[#1a1918] placeholder-[#665e5d]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#580c1e]/20 focus:border-[#580c1e] transition-all disabled:opacity-60 disabled:cursor-not-allowed';

const errorInput = 'border-red-400 focus:border-red-500 focus:ring-red-200';

interface FieldProps {
  label: string;
  name?: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, name, required, optional, error, hint, className = '', children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-xs font-bold uppercase tracking-wider text-[#4e4443] mb-1.5">
        {label}
        {required && <span className="text-[#991b3b]"> *</span>}
        {optional && <span className="normal-case tracking-normal font-medium text-[#665e5d]"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={name ? `${name}-error` : undefined} className="mt-1 text-[11px] text-red-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-[#665e5d]">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export const TextInput = React.forwardRef<HTMLInputElement, InputProps>(function TextInput({ invalid, className = '', ...rest }, ref) {
  return <input ref={ref} id={rest.name} aria-invalid={invalid || undefined} className={`${inputClass} ${invalid ? errorInput : ''} ${className}`} {...rest} />;
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; placeholder?: string };
export function SelectInput({ invalid, className = '', placeholder, children, ...rest }: SelectProps) {
  return (
    <select id={rest.name} aria-invalid={invalid || undefined} className={`${inputClass} ${invalid ? errorInput : ''} ${className}`} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };
export function TextArea({ invalid, className = '', ...rest }: TextAreaProps) {
  return <textarea id={rest.name} aria-invalid={invalid || undefined} className={`${inputClass} min-h-[96px] ${invalid ? errorInput : ''} ${className}`} {...rest} />;
}

export function Checkbox({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 text-xs text-[#4e4443] cursor-pointer">
      <input type="checkbox" className="mt-0.5 rounded accent-[#580c1e] cursor-pointer" {...rest} />
      <span>{label}</span>
    </label>
  );
}
