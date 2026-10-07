/**
 * RFC 4180 CSV writer.
 * - Fields containing comma, quote, CR or LF are quoted; quotes are doubled.
 * - Output is prefixed with a UTF-8 BOM so Excel opens ₹ and non-ASCII names correctly.
 * - Cells starting with = + - @ (or tab/CR) are prefixed with ' to prevent CSV/formula injection.
 */
export type CsvValue = string | number | boolean | null | undefined | Date;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && FORMULA_PREFIX.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(values: CsvValue[]): string {
  return values.map(csvCell).join(',');
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return '﻿' + [csvRow(header), ...rows.map(csvRow)].join('\r\n') + '\r\n';
}
