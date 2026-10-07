import React from 'react';
import type { Profile } from '../../../api/types';
import { Field, SelectInput, TextArea, TextInput } from '../../../components/ui/Field';
import { PhoneInput } from '../../../components/ui/PhoneInput';

/**
 * Step 1 fields – those of the Registration Brief (+ country). All are mandatory; the SGEI
 * membership number only for SGEI members.
 * Shared by the public Register page (account + Step 1 in one go) and the wizard's Personal step.
 */
export type PersonalForm = {
  title: string;
  fullName: string;
  age: string;
  gender: string;
  designation: string;
  organization: string;
  mciStateCode: string;
  mciRegNo: string;
  membershipType: string;
  membershipNo: string;
  phoneCountryCode: string;
  phoneNumber: string;
  /** Result of the phone widget's check for the selected country (not sent to the API). */
  phoneValid: boolean | null;
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
};

export const emptyPersonalForm: PersonalForm = {
  title: '',
  fullName: '',
  age: '',
  gender: '',
  designation: '',
  organization: '',
  mciStateCode: '',
  mciRegNo: '',
  membershipType: '',
  membershipNo: '',
  phoneCountryCode: '+91',
  phoneNumber: '',
  phoneValid: null,
  address: '',
  city: '',
  state: '',
  country: 'India',
  pinCode: '',
};

export function personalFromProfile(p: Profile): PersonalForm {
  return {
    title: p.title ?? '',
    fullName: p.fullName ?? '',
    age: p.age ? String(p.age) : '',
    gender: p.gender ?? '',
    designation: p.designation ?? '',
    organization: p.organization ?? '',
    mciStateCode: p.mciStateCode ?? '',
    mciRegNo: p.mciRegNo ?? '',
    membershipType: p.membershipType ?? '',
    membershipNo: p.membershipNo ?? '',
    phoneCountryCode: p.phoneCountryCode ?? '+91',
    phoneNumber: p.phoneNumber ?? '',
    phoneValid: null,
    address: p.address ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    country: p.country ?? 'India',
    pinCode: p.pinCode ?? '',
  };
}

/** Immediate feedback; the server re-validates everything. */
export function validatePersonal(f: PersonalForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title) e.title = 'Select a title.';
  if (f.fullName.trim().length < 2) e.fullName = 'Enter your full name.';
  if (!f.age.trim()) e.age = 'Enter your age.';
  else if (!/^\d+$/.test(f.age.trim()) || +f.age < 1 || +f.age > 120) e.age = 'Enter a valid age.';
  if (!f.gender) e.gender = 'Select an option.';
  if (f.designation.trim().length < 2) e.designation = 'Enter your designation.';
  if (f.organization.trim().length < 2) e.organization = 'Enter your organization / hospital.';
  if (f.mciStateCode.trim().length < 2) e.mciStateCode = 'Enter the Medical Council state code.';
  if (!f.mciRegNo.trim()) e.mciRegNo = 'Enter your Medical Council registration number.';
  if (!f.membershipType) e.membershipType = 'Select your membership.';
  if (f.membershipType === 'sgei_member' && !f.membershipNo.trim()) e.membershipNo = 'Membership number is required for SGEI members.';
  if (!/^\+\d{1,4}$/.test(f.phoneCountryCode.trim()) || !/^\d{6,15}$/.test(f.phoneNumber) || f.phoneValid === false) {
    e.phoneNumber = 'Enter a valid mobile number for the selected country.';
  }
  if (f.address.trim().length < 5) e.address = 'Enter your full address.';
  if (f.city.trim().length < 2) e.city = 'Enter your city.';
  if (f.state.trim().length < 2) e.state = 'Enter your state.';
  if (f.country.trim().length < 2) e.country = 'Enter your country.';
  if (f.country.trim().toLowerCase() === 'india' ? !/^\d{6}$/.test(f.pinCode.trim()) : f.pinCode.trim().length < 3) e.pinCode = 'Enter a valid pin code.';
  return e;
}

/** Body for PUT /profile. */
export function personalPayload(f: PersonalForm) {
  const { phoneValid: _ignored, ...rest } = f;
  void _ignored;
  return {
    ...rest,
    age: Number(f.age.trim()),
    membershipNo: f.membershipType === 'sgei_member' ? f.membershipNo : null,
    mciStateCode: f.mciStateCode.trim(),
    mciRegNo: f.mciRegNo.trim(),
  };
}

/**
 * All Step 1 fields in one two-column grid (no section headings).
 * `email` is one grid cell (paired with the mobile number); `passwords` (Register page only)
 * is two grid cells placed on the row after it.
 */
export function PersonalFields({
  form,
  setForm,
  errs,
  email,
  passwords,
  membershipLocked = false,
}: {
  form: PersonalForm;
  setForm: React.Dispatch<React.SetStateAction<PersonalForm>>;
  errs: Record<string, string | undefined>;
  email: React.ReactNode;
  passwords?: React.ReactNode;
  membershipLocked?: boolean;
}) {
  const set = (k: keyof PersonalForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const input = (k: keyof PersonalForm, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <TextInput name={k} value={form[k] as string} onChange={set(k)} invalid={!!errs[k]} aria-describedby={errs[k] ? `${k}-error` : undefined} {...props} />
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
      {/* Name */}
      <div className="grid grid-cols-[100px_1fr] gap-3">
        <Field label="Title" name="title" required error={errs.title}>
          <SelectInput name="title" value={form.title} onChange={set('title')} invalid={!!errs.title} placeholder="Select">
            <option>Dr.</option>
            <option>Mr.</option>
            <option>Ms.</option>
          </SelectInput>
        </Field>
        <Field label="Full Name" name="fullName" required error={errs.fullName}>
          {input('fullName', { autoComplete: 'name', placeholder: 'As it should appear on your badge' })}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gender" name="gender" required error={errs.gender}>
          <SelectInput name="gender" value={form.gender} onChange={set('gender')} invalid={!!errs.gender} placeholder="Select">
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
            <option>Prefer not to say</option>
          </SelectInput>
        </Field>
        <Field label="Age" name="age" required error={errs.age}>
          {input('age', { inputMode: 'numeric', placeholder: 'e.g. 38' })}
        </Field>
      </div>

      {email}
      <Field label="Mobile / WhatsApp Number" name="phoneNumber" required error={errs.phoneNumber || errs.phoneCountryCode}>
        <PhoneInput
          name="phoneNumber"
          countryCode={form.phoneCountryCode}
          number={form.phoneNumber}
          invalid={!!(errs.phoneNumber || errs.phoneCountryCode)}
          onChange={(v) => setForm((f) => ({ ...f, phoneCountryCode: v.countryCode, phoneNumber: v.number, phoneValid: v.valid }))}
        />
      </Field>
      {passwords}

      <Field label="Designation" name="designation" required error={errs.designation}>
        {input('designation', { placeholder: 'e.g. Consultant Gastroenterologist' })}
      </Field>
      <Field label="Organization / Hospital" name="organization" required error={errs.organization}>
        {input('organization', { autoComplete: 'organization' })}
      </Field>

      <Field label="Medical Council Reg. – State Code" name="mciStateCode" required error={errs.mciStateCode}>
        {input('mciStateCode', { placeholder: 'e.g. WBMC' })}
      </Field>
      <Field label="Medical Council Reg. – Registration No." name="mciRegNo" required error={errs.mciRegNo}>
        {input('mciRegNo', { placeholder: 'e.g. 68421' })}
      </Field>

      <Field label="Membership" name="membershipType" required error={errs.membershipType} hint={membershipLocked ? 'Locked after conference registration.' : undefined}>
        <SelectInput name="membershipType" value={form.membershipType} onChange={set('membershipType')} invalid={!!errs.membershipType} disabled={membershipLocked} placeholder="Select">
          <option value="sgei_member">SGEI Member</option>
          <option value="non_member">Non-Member</option>
        </SelectInput>
      </Field>
      {form.membershipType === 'sgei_member' ? (
        <Field label="SGEI Membership No." name="membershipNo" required error={errs.membershipNo}>
          {input('membershipNo', { placeholder: 'e.g. SGEI-LM-4521' })}
        </Field>
      ) : (
        <div className="hidden sm:block" aria-hidden />
      )}

      {/* Address */}
      <Field label="Address" name="address" required error={errs.address} className="sm:col-span-2">
        <TextArea name="address" value={form.address} onChange={set('address')} invalid={!!errs.address} rows={2} autoComplete="street-address" className="min-h-[72px]" />
      </Field>
      <Field label="City" name="city" required error={errs.city}>
        {input('city', { autoComplete: 'address-level2' })}
      </Field>
      <Field label="State" name="state" required error={errs.state}>
        {input('state', { autoComplete: 'address-level1' })}
      </Field>
      <Field label="Country" name="country" required error={errs.country}>
        {input('country', { autoComplete: 'country-name' })}
      </Field>
      <Field label="Pin Code" name="pinCode" required error={errs.pinCode}>
        {input('pinCode', { autoComplete: 'postal-code', inputMode: form.country.toLowerCase() === 'india' ? 'numeric' : 'text' })}
      </Field>
    </div>
  );
}
