import React from 'react';
import { money } from '../../lib/format';

export interface MoneyLine {
  description: string;
  amountMinor: number;
  gstMinor?: number;
  totalMinor?: number;
}

/**
 * The order summary table (item / amount, subtotal, GST, grand total). Values always come from
 * the API – the browser never calculates prices.
 */
export function MoneyTable({
  lines,
  subtotalMinor,
  gstMinor,
  totalMinor,
  gstPercent = '18',
  totalLabel = 'Grand Total',
  currency = 'INR',
}: {
  lines: MoneyLine[];
  subtotalMinor: number;
  gstMinor: number;
  totalMinor: number;
  gstPercent?: string;
  totalLabel?: string;
  currency?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.08] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#f5f3f0] text-[10px] uppercase tracking-wider text-[#665e5d]">
          <tr>
            <th className="text-left font-bold px-4 py-2.5">Item</th>
            <th className="text-right font-bold px-4 py-2.5 whitespace-nowrap">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t border-black/[0.05]">
              <td className="px-4 py-3 text-[#1a1918]">{l.description}</td>
              <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{money(l.amountMinor, currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-black/[0.08]">
            <td className="px-4 py-2 text-right text-[#665e5d]">Subtotal</td>
            <td className="px-4 py-2 text-right whitespace-nowrap">{money(subtotalMinor, currency)}</td>
          </tr>
          <tr>
            <td className="px-4 py-2 text-right text-[#665e5d]">GST ({gstPercent}%)</td>
            <td className="px-4 py-2 text-right whitespace-nowrap">{money(gstMinor, currency)}</td>
          </tr>
          <tr className="bg-[#580c1e] text-[#fef3c7]">
            <td className="px-4 py-3 text-right font-bold uppercase tracking-wider text-xs">{totalLabel}</td>
            <td className="px-4 py-3 text-right font-serif text-lg font-bold whitespace-nowrap">{money(totalMinor, currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
