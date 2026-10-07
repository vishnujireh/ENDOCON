import { z } from 'zod';
import { phoneCountryCodeSchema, phoneNumberSchema } from '../auth/auth.schemas.js';

export const TITLES = ['Dr.', 'Mr.', 'Ms.'] as const;
export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;
export const MEMBERSHIP_TYPES = ['sgei_member', 'non_member'] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/**
 * Step 1 – Personal Details. Fields exactly as listed in the Registration Brief, plus country.
 * All fields are mandatory (client decision, Oct 2026), including age and the Medical Council
 * registration (state code + number). The SGEI membership number is required for SGEI members
 * only – non-members have none.
 */
export const profileSchema = z
  .object({
    title: z.enum(TITLES, { message: 'Select a title.' }),
    fullName: z.string().trim().min(2, 'Enter your full name.').max(150),
    age: z.coerce
      .number({ message: 'Enter your age.' })
      .int('Enter a valid age.')
      .min(1, 'Enter your age.')
      .max(120, 'Enter a valid age.'),
    gender: z.enum(GENDERS, { message: 'Select a gender option.' }),
    designation: z.string().trim().min(2, 'Enter your designation.').max(150),
    organization: z.string().trim().min(2, 'Enter your organization / hospital.').max(200),
    mciStateCode: z.string({ message: 'Enter the Medical Council state code.' }).trim().min(2, 'Enter the Medical Council state code.').max(60),
    mciRegNo: z.string({ message: 'Enter your Medical Council registration number.' }).trim().min(1, 'Enter your Medical Council registration number.').max(60),
    membershipType: z.enum(MEMBERSHIP_TYPES, { message: 'Select your membership.' }),
    membershipNo: optionalText(60),
    phoneCountryCode: phoneCountryCodeSchema,
    phoneNumber: phoneNumberSchema,
    address: z.string().trim().min(5, 'Enter your full address.').max(500),
    city: z.string().trim().min(2, 'Enter your city.').max(100),
    state: z.string().trim().min(2, 'Enter your state.').max(100),
    country: z.string().trim().min(2, 'Enter your country.').max(100).default('India'),
    pinCode: z.string().trim().min(3, 'Enter your pin code.').max(12),
  })
  .superRefine((v, ctx) => {
    if (v.membershipType === 'sgei_member' && !v.membershipNo) {
      ctx.addIssue({ code: 'custom', path: ['membershipNo'], message: 'Membership number is required for SGEI members.' });
    }
    if (v.country.toLowerCase() === 'india' && !/^\d{6}$/.test(v.pinCode)) {
      ctx.addIssue({ code: 'custom', path: ['pinCode'], message: 'Enter a valid 6-digit pin code.' });
    }
  });

export type ProfileInput = z.infer<typeof profileSchema>;
