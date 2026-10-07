import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: 'Enter a valid email address.' }));

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password must contain at least one letter and one number.');

export const phoneCountryCodeSchema = z
  .string()
  .trim()
  .regex(/^\+\d{1,4}$/, 'Country code must look like +91.');

export const phoneNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\d{6,15}$/, 'Enter a valid mobile number (digits only).'));

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(150),
  email: emailSchema,
  phoneCountryCode: phoneCountryCodeSchema.default('+91'),
  phoneNumber: phoneNumberSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(100),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
