import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Plus, Trash2 } from 'lucide-react';
import type { Catalogue, Category, RegistrationStatus } from '../../../api/types';
import { money, PERIOD_LABEL } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { SelectInput, TextInput } from '../../../components/ui/Field';
import { Alert } from '../../../components/ui/States';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useCart } from '../CartContext';

/** Only the price of the period in force now (by server time): Early Bird → Regular → On-spot. */
function priceLine(c: Category, catalogue: Catalogue) {
  const cur = c.current;
  return (
    <>
      <span className="font-serif text-xl font-bold text-[#580c1e]">{money(cur.chargeAmountMinor, 'INR', { decimals: false })}</span>
      {c.currency === 'USD' && (
        <span className="block text-[10px] text-[#665e5d]">
          USD {cur.originalAmountMinor / 100} × ₹{catalogue.usdToInrRate}
        </span>
      )}
      <span className="block text-[10px] font-semibold text-[#8a6d1f]">{catalogue.currentPeriod.label} + GST</span>
    </>
  );
}

export function ConferenceStep({
  status,
  catalogue,
  onBack,
  onNext,
}: {
  status: RegistrationStatus;
  catalogue: Catalogue;
  onBack: () => void;
  onNext: () => void;
}) {
  const { cart, setConference, setAccompanying } = useCart();
  const held = status.conference;
  const p = status.profile;
  const [params, setParams] = useSearchParams();

  // Landing-page "Register" buttons pass ?category=<code> to preselect a category.
  useEffect(() => {
    const code = params.get('category');
    if (!code) return;
    const c = catalogue.categories.find((x) => x.code === code && x.kind === 'delegate');
    if (c && !held && !(c.requiresMembership && !(p.membershipType === 'sgei_member' && p.membershipNo))) setConference(c.code);
    setParams({}, { replace: true });
  }, [params, catalogue.categories, held, setConference, setParams]);
  const delegateCats = catalogue.categories.filter((c) => c.kind === 'delegate');
  const selected = delegateCats.find((c) => c.code === cart.conferenceCategoryCode) ?? null;
  const region = held?.region ?? selected?.region ?? null;
  const accompanyingCat = catalogue.categories.find((c) => c.code === (region === 'international' ? 'accompanying-international' : 'accompanying-national'));

  // Membership comes from Step 1: the SGEI Member rate is only for delegates who chose
  // "SGEI Member" (with their membership no.) there. Everything else is open to all.
  const hasMembership = p.membershipType === 'sgei_member' && !!p.membershipNo;
  const isLocked = (c: Category) => c.requiresMembership && !hasMembership;

  const people = cart.accompanyingPersons;
  const updatePerson = (i: number, patch: Partial<(typeof people)[number]>) => setAccompanying(people.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const canContinue = !!held || (!!selected && !isLocked(selected));

  return (
    <div className="space-y-6">
      <Alert tone="info">
        <strong>{catalogue.currentPeriod.label} prices</strong> – {catalogue.currentPeriod.displayRange}. Prices exclude {catalogue.gstRatePercent}% GST.
      </Alert>

      {held ? (
        <div className="p-5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-[#1a1918]">{held.categoryName}</p>
              <p className="text-xs text-[#4e4443]">
                {PERIOD_LABEL[held.pricingPeriodCode ?? ''] ?? ''} · {money(held.amountMinor)} + GST {money(held.gstMinor)} = {money(held.totalMinor)}
              </p>
              <p className="text-[11px] text-[#665e5d] mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" /> A conference registration can be purchased only once. You can still add workshops, accommodation and accompanying persons.
              </p>
            </div>
          </div>
          <StatusBadge status="paid" label={held.source === 'complimentary' ? 'Complimentary' : 'Purchased'} />
        </div>
      ) : (
        <div role="radiogroup" aria-label="Registration category" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {delegateCats.map((c) => {
            const locked = isLocked(c);
            const isSel = cart.conferenceCategoryCode === c.code;
            return (
              <button
                key={c.code}
                type="button"
                role="radio"
                aria-checked={isSel}
                disabled={locked}
                onClick={() => setConference(isSel ? null : c.code)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  isSel ? 'border-[#580c1e] bg-[#580c1e]/[0.04] ring-2 ring-[#580c1e]/30' : 'border-black/[0.1] bg-white hover:border-[#580c1e]/40'
                } ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-[#1a1918]">{c.name}</p>
                    {c.description && <p className="text-[11px] text-[#665e5d] mt-0.5">{c.description}</p>}
                  </div>
                  <div className="text-right shrink-0">{priceLine(c, catalogue)}</div>
                </div>
                {locked && (
                  <p className="mt-3 text-[11px] text-[#665e5d] flex items-center gap-1.5">
                    <Lock className="w-3 h-3 shrink-0" /> Available only to SGEI members.
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}



      {(held || selected) && accompanyingCat && (
        <div className="p-5 rounded-2xl border border-black/[0.08] bg-[#faf8f5]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="font-bold text-sm">Accompanying persons <span className="text-[10px] uppercase tracking-wider text-[#c89e37] font-semibold">Optional</span></p>
              <p className="text-[11px] text-[#665e5d]">
                {accompanyingCat.name}: {money(accompanyingCat.current.chargeAmountMinor, 'INR', { decimals: false })} + GST per person
                {status.accompanying.length > 0 && ` · already registered: ${status.accompanying.map((a) => a.fullName).join(', ')}`}
              </p>
            </div>
            <Button type="button" size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAccompanying([...people, { title: 'Mrs.', fullName: '' }])} disabled={people.length >= 10}>
              Add person
            </Button>
          </div>
          {people.map((person, i) => (
            <div key={i} className="grid grid-cols-[96px_1fr_auto] gap-2 mb-2">
              <SelectInput aria-label="Title" value={person.title ?? ''} onChange={(e) => updatePerson(i, { title: e.target.value })}>
                <option>Mrs.</option>
                <option>Mr.</option>
                <option>Ms.</option>
                <option>Dr.</option>
                <option value="">—</option>
              </SelectInput>
              <TextInput aria-label="Full name" placeholder="Full name" value={person.fullName} onChange={(e) => updatePerson(i, { fullName: e.target.value })} />
              <button type="button" aria-label="Remove" onClick={() => setAccompanying(people.filter((_, j) => j !== i))} className="p-2 text-[#665e5d] hover:text-red-700 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2 border-t border-black/[0.06]">
        <Button variant="secondary" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canContinue} icon={<ArrowRight className="w-4 h-4" />}>
          Continue
        </Button>
      </div>
    </div>
  );
}
