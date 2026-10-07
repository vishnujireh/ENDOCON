import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

/**
 * All runtime configuration comes from environment variables and is validated
 * once at startup. Nothing secret is ever hard-coded.
 */
const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  // URLs
  APP_URL: z.url().default('http://localhost:4000'),
  FRONTEND_URL: z.url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default(''),

  // Database (MySQL 8 / MariaDB 10.6+)
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_USER: z.string().default('endocon'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('endocon'),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Sessions
  SESSION_COOKIE_NAME: z.string().default('endocon_sid'),
  /** Abstract reviewers (judges): emailed one-time codes and their own session. */
  REVIEWER_OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  REVIEWER_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  REVIEWER_OTP_RESEND_SECONDS: z.coerce.number().int().nonnegative().default(60),
  REVIEWER_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 7),
  SESSION_ABSOLUTE_TTL_HOURS: z.coerce.number().int().positive().default(24 * 30),
  COOKIE_SECURE: bool.optional(),
  COOKIE_DOMAIN: z.string().optional(),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  // Event / pricing
  EVENT_TIMEZONE: z.string().default('Asia/Kolkata'),
  /** Path to the static catalogue JSON (categories, workshops, accommodation, prices, GST, USD rate).
   *  Default: ../shared/catalogue.json relative to the backend folder. */
  CATALOGUE_FILE: z.string().optional(),
  ORDER_NUMBER_PREFIX: z.string().default('ENDO'),
  ABSTRACT_NUMBER_PREFIX: z.string().default('ENDO27-ABS'),
  INVOICE_NUMBER_PREFIX: z.string().default('ENDO'),
  ABSTRACT_SUBMISSION_OPENS: z.iso.datetime({ offset: true }).default('2026-09-01T00:00:00+05:30'),
  ABSTRACT_SUBMISSION_CLOSES: z.iso.datetime({ offset: true }).default('2027-02-28T23:59:59+05:30'),
  /** Non-production only: pretend "now" is this instant for pricing (QA of period boundaries). */
  PRICING_NOW_OVERRIDE: z.iso.datetime({ offset: true }).optional(),

  // Razorpay
  PAYMENT_GATEWAY: z.enum(['razorpay', 'fake']).default('razorpay'),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  PAYMENT_RECONCILE_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
  PAYMENT_STALE_AFTER_MINUTES: z.coerce.number().int().positive().default(10),
  PAYMENT_EXPIRE_AFTER_HOURS: z.coerce.number().int().positive().default(24),

  // Email
  // Optional: when not set, Brevo is used as soon as BREVO_API_KEY is present (same as LTSICON), else console.
  EMAIL_TRANSPORT: z.enum(['brevo', 'smtp', 'console']).optional(),
  BREVO_API_KEY: z.string().default(''),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().default('ENDOCON 2027'),
  BREVO_API_URL: z.string().url().default('https://api.brevo.com/v3/smtp/email'),
  EMAIL_HOST: z.string().default(''),
  EMAIL_PORT: z.coerce.number().int().default(587),
  EMAIL_SECURE: bool.default(false),
  EMAIL_USER: z.string().default(''),
  EMAIL_PASSWORD: z.string().default(''),
  EMAIL_FROM: z.string().default('ENDOCON 2027 <no-reply@example.com>'),
  EMAIL_REPLY_TO: z.string().optional(),
  ADMIN_NOTIFICATION_EMAILS: z.string().default(''),
  // Admin accounts created/updated by `npm run seed-admins` (comma-separated) and their password.
  ADMIN_EMAILS: z.string().default(''),
  ADMIN_DEFAULT_PASSWORD: z.string().optional(),
  EMAIL_WORKER_INTERVAL_SECONDS: z.coerce.number().int().positive().default(10),

  // Organisation / invoice details (replace once the invoice format is supplied)
  ORG_NAME: z.string().default('ENDOCON 2027 Organising Committee'),
  ORG_ADDRESS: z.string().default('Kolkata, West Bengal, India'),
  ORG_GSTIN: z.string().default(''),
  ORG_PAN: z.string().default(''),
  ORG_STATE_CODE: z.string().default('19'),
  ORG_SAC_CODE: z.string().default('998596'),
  SUPPORT_PHONE: z.string().default(''),
  SUPPORT_EMAIL: z.string().default('endocon2027@gmail.com'),

  // Storage for uploads and invoices
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  /** Largest document / image upload (abstract PDF or Word, figures). */
  UPLOAD_MAX_MB: z.coerce.number().positive().default(20),
  /** Largest video upload (Video Digest and any other video). */
  UPLOAD_MAX_VIDEO_MB: z.coerce.number().positive().default(500),

  // Background jobs (disable in tests / when running a separate worker)
  RUN_JOBS: bool.default(true),
});

// A blank line such as `COOKIE_SECURE=` in .env means "not set" – use the default.
const definedEnv = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ''));
const parsed = schema.safeParse(definedEnv);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

const brevoKeySet = !!parsed.data.BREVO_API_KEY && !parsed.data.BREVO_API_KEY.startsWith('your-');
const raw = {
  ...parsed.data,
  EMAIL_TRANSPORT: parsed.data.EMAIL_TRANSPORT ?? (brevoKeySet ? 'brevo' : 'console'),
} as const;

if (raw.NODE_ENV === 'production') {
  const missing: string[] = [];
  if (raw.PAYMENT_GATEWAY !== 'razorpay') missing.push('PAYMENT_GATEWAY must be razorpay in production');
  if (!raw.RAZORPAY_KEY_ID || !raw.RAZORPAY_KEY_SECRET) missing.push('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET');
  if (!raw.RAZORPAY_WEBHOOK_SECRET) missing.push('RAZORPAY_WEBHOOK_SECRET');
  if (raw.EMAIL_TRANSPORT === 'console') missing.push('BREVO_API_KEY (email is not configured)');
  if (raw.EMAIL_TRANSPORT === 'brevo' && !brevoKeySet) missing.push('BREVO_API_KEY (missing or still the placeholder)');
  if (raw.EMAIL_TRANSPORT === 'smtp' && !raw.EMAIL_HOST) missing.push('EMAIL_HOST');
  if (!raw.DB_PASSWORD) missing.push('DB_PASSWORD');
  if (raw.PRICING_NOW_OVERRIDE) missing.push('PRICING_NOW_OVERRIDE must not be set in production');
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error('Production configuration errors:\n - ' + missing.join('\n - '));
    process.exit(1);
  }
}

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  cookieSecure: raw.COOKIE_SECURE ?? raw.NODE_ENV === 'production',
  corsOrigins: [raw.FRONTEND_URL, ...raw.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)],
  adminEmails: raw.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  adminNotificationEmails: raw.ADMIN_NOTIFICATION_EMAILS.split(',').map((s) => s.trim()).filter(Boolean),
};

export type Env = typeof env;
