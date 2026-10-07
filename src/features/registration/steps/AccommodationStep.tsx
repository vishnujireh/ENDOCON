import React from 'react';
import { ArrowLeft, ArrowRight, BedDouble, CheckCircle2, X } from 'lucide-react';
import type { Catalogue, RegistrationStatus } from '../../../api/types';
import { date, money, nightsBetween } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { Field, TextInput } from '../../../components/ui/Field';
import { Alert } from '../../../components/ui/States';
import { useCart } from '../CartContext';

const OCC = { single: 'Single Occupancy', twin_share: 'Twin Share' } as const;

export function AccommodationStep({ status, catalogue, onBack, onNext }: { status: RegistrationStatus; catalogue: Catalogue; onBack: () => void; onNext: () => void }) {
  const { cart, setAccommodation } = useCart();
  const held = status.accommodation;
  const hasConference = !!status.conference || !!cart.conferenceCategoryCode;
  const sel = cart.accommodation;
  const { start, end } = catalogue.stayWindow;

  const choose = (optionCode: string) => {
    // Accommodation is optional: clicking the selected room again removes it.
    if (sel?.optionCode === optionCode) return setAccommodation(null);
    setAccommodation({ optionCode, checkIn: sel?.checkIn || '2027-04-22', checkOut: sel?.checkOut || '2027-04-25' });
  };

  const nights = sel ? nightsBetween(sel.checkIn, sel.checkOut) : 0;
  const dateError = sel && (nights < 1 ? 'Check-out must be after check-in.' : sel.checkIn < start || sel.checkOut > end ? `Stay must be between ${date(start)} and ${date(end)}.` : '');
  const option = catalogue.accommodation.find((o) => o.code === sel?.optionCode);
  const hotels = [...new Set(catalogue.accommodation.map((o) => o.hotelName))];

  return (
    <div className="space-y-5">
      {held ? (
        <div className="p-5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="font-bold">
              {held.hotelName} – {held.occupancy === 'single' ? 'Single Occupancy' : 'Twin Share'}
            </p>
            <p className="text-xs text-[#4e4443]">
              {date(held.checkIn)} → {date(held.checkOut)} · {held.nights} night{held.nights > 1 ? 's' : ''} · {money(held.totalMinor)} incl. GST
            </p>
            <p className="text-[11px] text-[#665e5d] mt-1">Accommodation is booked. For changes please contact the organising team.</p>
          </div>
        </div>
      ) : (
        <>
          {!hasConference && <Alert tone="warning">Please select a conference registration first.</Alert>}
          <p className="text-xs text-[#665e5d]">
            Optional. Choose one room type and your stay dates. Rates are per night and exclusive of {catalogue.gstRatePercent}% GST.
            {sel && ' Click the selected room again to remove it.'}
          </p>
          {hotels.map((hotel) => {
            const opts = catalogue.accommodation.filter((o) => o.hotelName === hotel);
            return (
              <div key={hotel}>
                <p className="text-xs font-bold uppercase tracking-wider text-[#4e4443] mb-2">
                  {hotel} {opts[0].hotelNote && <span className="normal-case tracking-normal font-normal text-[#665e5d]">({opts[0].hotelNote})</span>}
                </p>
                <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {opts.map((o) => {
                    const isSel = sel?.optionCode === o.code;
                    return (
                      <button
                        key={o.code}
                        type="button"
                        role="radio"
                        aria-checked={isSel}
                        title={isSel ? 'Click again to remove this selection' : undefined}
                        disabled={!hasConference}
                        onClick={() => choose(o.code)}
                        className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
                          isSel ? 'border-[#580c1e] bg-[#580c1e]/[0.04] ring-2 ring-[#580c1e]/30' : 'border-black/[0.1] bg-white hover:border-[#580c1e]/40'
                        } ${hasConference ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <BedDouble className="w-4 h-4 text-[#580c1e]" /> {OCC[o.occupancy]}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-serif font-bold text-[#580c1e]">
                            {money(o.nightlyAmountMinor, 'INR', { decimals: false })}
                            <span className="text-[10px] font-sans font-normal text-[#665e5d]"> /night</span>
                          </span>
                          {isSel && (
                            <span aria-hidden className="w-5 h-5 rounded-full bg-[#580c1e] text-white flex items-center justify-center">
                              <X className="w-3 h-3" />
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {sel && (
            <div className="p-4 rounded-2xl bg-[#faf8f5] border border-black/[0.08]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <Field label="Check-in" name="checkIn" required>
                  <TextInput type="date" name="checkIn" min={start} max={end} value={sel.checkIn} onChange={(e) => setAccommodation({ ...sel, checkIn: e.target.value })} />
                </Field>
                <Field label="Check-out" name="checkOut" required>
                  <TextInput type="date" name="checkOut" min={sel.checkIn || start} max={end} value={sel.checkOut} onChange={(e) => setAccommodation({ ...sel, checkOut: e.target.value })} />
                </Field>
                <div className="text-xs text-[#4e4443] pb-2">
                  {nights > 0 && option && (
                    <>
                      {nights} night{nights > 1 ? 's' : ''} × {money(option.nightlyAmountMinor, 'INR', { decimals: false })}
                      <span className="block text-[10px] text-[#665e5d]">Final amount confirmed on the next page.</span>
                    </>
                  )}
                </div>
              </div>
              {dateError && <p className="text-[11px] text-red-700 mt-2">{dateError}</p>}
              <div className="mt-4 pt-3 border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-[#665e5d]">Selected by mistake? Accommodation is optional.</span>
                <Button size="sm" variant="secondary" onClick={() => setAccommodation(null)} icon={<X className="w-3.5 h-3.5" />}>
                  Remove accommodation
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap justify-between gap-3 pt-2 border-t border-black/[0.06]">
        <Button variant="secondary" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!!dateError} icon={<ArrowRight className="w-4 h-4" />}>
          {held || sel ? 'Continue to summary' : 'Skip accommodation'}
        </Button>
      </div>
    </div>
  );
}
