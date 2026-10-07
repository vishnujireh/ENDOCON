import React, { useEffect, useRef } from 'react';
import intlTelInput from 'intl-tel-input';
import 'intl-tel-input/styles';
import { inputClass } from './Field';

type Iti = ReturnType<typeof intlTelInput>;

/** '+91' -> 'in'. For shared dial codes (e.g. +1) the main country (priority 0) wins. */
function iso2FromDialCode(code: string): string {
  const dial = code.replace(/\D/g, '');
  if (!dial) return 'in';
  const all = intlTelInput.getAllCountries().filter((c) => c.dialCode === dial);
  return (all.find((c) => c.priority === 0) ?? all[0])?.iso2 ?? 'in';
}

export interface PhoneValue {
  /** e.g. '+91' */
  countryCode: string;
  /** National number, digits only. */
  number: string;
  /** libphonenumber validity for the selected country (null until utils have loaded / empty). */
  valid: boolean | null;
}

/**
 * Mobile number with a searchable country-code dropdown (intl-tel-input).
 * Stores the dial code and the national number separately, as the profile API expects.
 */
export function PhoneInput({
  name,
  countryCode,
  number,
  onChange,
  invalid,
  disabled,
}: {
  name: string;
  countryCode: string;
  number: string;
  onChange: (v: PhoneValue) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itiRef = useRef<Iti | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const input = inputRef.current!;
    const iti = intlTelInput(input, {
      initialCountry: iso2FromDialCode(countryCode) as never,
      separateDialCode: true,
      countrySearch: true,
      countryOrder: ['in'],
      formatAsYouType: false,
      placeholderNumberType: 'MOBILE',
      loadUtils: () => import('intl-tel-input/utils'),
    });
    itiRef.current = iti;
    const emit = () => {
      const c = iti.getSelectedCountry();
      const digits = input.value.replace(/\D/g, '');
      onChangeRef.current({
        countryCode: c?.dialCode ? `+${c.dialCode}` : '',
        number: digits,
        valid: digits ? iti.isValidNumber() : null,
      });
    };
    input.addEventListener('input', emit);
    input.addEventListener('countrychange', emit);
    // Re-check validity once the validation utils have arrived.
    iti.promise.then(() => input.value && emit()).catch(() => undefined);
    return () => {
      input.removeEventListener('input', emit);
      input.removeEventListener('countrychange', emit);
      iti.destroy();
      itiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the widget in sync when the value is changed from outside (e.g. profile loaded).
  useEffect(() => {
    const iti = itiRef.current;
    const input = inputRef.current;
    if (!iti || !input) return;
    if (input.value.replace(/\D/g, '') !== number) input.value = number;
    const iso2 = iso2FromDialCode(countryCode);
    if (countryCode && iti.getSelectedCountry()?.dialCode !== countryCode.replace(/\D/g, '')) iti.setSelectedCountry(iso2 as never);
  }, [countryCode, number]);

  useEffect(() => {
    itiRef.current?.setDisabled(!!disabled);
  }, [disabled]);

  return (
    <div className="phone-input">
      <input
        ref={inputRef}
        id={name}
        name={name}
        type="tel"
        autoComplete="tel-national"
        defaultValue={number}
        aria-invalid={invalid || undefined}
        className={`${inputClass} ${invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
      />
    </div>
  );
}
