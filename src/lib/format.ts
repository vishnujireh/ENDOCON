/** Display helpers. Amounts from the API are integer minor units (paise / cents). */

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${digits.slice(-3)}`;
}

export function money(minor: number | null | undefined, currency = 'INR', opts: { decimals?: boolean } = {}): string {
  const v = Number(minor ?? 0);
  const abs = Math.abs(v);
  const major = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const showDecimals = opts.decimals ?? true;
  const body = currency === 'INR' ? groupIndian(String(major)) : String(major).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${v < 0 ? '-' : ''}${symbol}${body}${showDecimals ? `.${frac}` : ''}`;
}

const TZ = 'Asia/Kolkata';

export function dateTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}

export function date(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const s = typeof v === 'string' && v.length === 10 ? `${v}T00:00:00+05:30` : v;
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(s));
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);
}

export const PERIOD_LABEL: Record<string, string> = { early_bird: 'Early Bird', regular: 'Regular', on_spot: 'On-spot' };

export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'ck-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** "1234.5" -> 123450 paise, without floating-point arithmetic. Returns NaN when invalid. */
export function majorToMinor(input: string): number {
  const m = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/.exec(input);
  if (!m) return NaN;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}
