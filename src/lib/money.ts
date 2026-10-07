/**
 * Money helpers. All amounts are integer minor units (paise for INR, cents for USD).
 * No floating-point arithmetic is ever used on money.
 */

export type Currency = 'INR' | 'USD';

/** Round-half-up integer division for non-negative integers. */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

function assertMinor(value: number, label = 'amount'): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer in minor units (got ${value})`);
  }
}

/** GST for a taxable amount. rateBps = basis points (1800 = 18%). */
export function gstFor(amountMinor: number, rateBps: number): number {
  assertMinor(amountMinor);
  assertMinor(rateBps, 'rateBps');
  return Number(divRoundHalfUp(BigInt(amountMinor) * BigInt(rateBps), 10000n));
}

/**
 * Convert a foreign-currency amount to INR paise with a decimal rate given as a string
 * (e.g. "84.25"). Result is rounded half-up to the nearest whole rupee so that invoices
 * never carry odd paise from conversion.
 */
export function convertToInrMinor(foreignMinor: number, rate: string | number): number {
  assertMinor(foreignMinor);
  const [whole, frac = ''] = String(rate).split('.');
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(frac)) throw new Error(`Invalid FX rate: ${rate}`);
  const scale = 10n ** BigInt(frac.length);
  const rateScaled = BigInt(whole + frac); // rate * scale
  // foreignMinor (cents) * rate = INR paise
  const paise = divRoundHalfUp(BigInt(foreignMinor) * rateScaled, scale);
  const rupees = divRoundHalfUp(paise, 100n);
  return Number(rupees * 100n);
}

export function sumMinor(values: number[]): number {
  return values.reduce((acc, v) => {
    assertMinor(v);
    return acc + v;
  }, 0);
}

export function toMinor(major: number): number {
  // Only for trusted constants such as seed data expressed in whole rupees.
  return Math.round(major * 100);
}

/** "₹21,830.00" / "USD 350.00" – Indian digit grouping for INR. */
export function formatMoney(minor: number, currency: Currency | string = 'INR'): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  const grouped =
    currency === 'INR' ? groupIndian(String(major)) : String(major).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${negative ? '-' : ''}${symbol}${grouped}.${fraction}`;
}

/** Plain decimal string without symbol, e.g. "21830.00" (for CSV / gateway notes). */
export function minorToDecimalString(minor: number): string {
  const abs = Math.abs(minor);
  return `${minor < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}
