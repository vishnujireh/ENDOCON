import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { api, apiUrl } from '../../lib/api';
import type { AdminRegistrationDetail, Profile } from '../../api/types';
import { date, dateTime, money, PERIOD_LABEL } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Field, SelectInput, TextArea, TextInput } from '../../components/ui/Field';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Card, DefinitionList } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Alert, ApiErrorAlert, ErrorState, fieldErrors, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ResendButton } from './ResendButton';

type FieldDef = {
  key: keyof Profile;
  label: string;
  type?: 'select' | 'textarea' | 'number' | 'phone';
  options?: [string, string][];
  wide?: boolean;
  /** Shown only when this returns true for the current values. */
  when?: (v: Record<string, string>) => boolean;
};

/** Step 1 fields an admin can correct – all mandatory, as on the participant's own form. */
const EDITABLE: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'select', options: [['Dr.', 'Dr.'], ['Mr.', 'Mr.'], ['Ms.', 'Ms.']] },
  { key: 'fullName', label: 'Full name' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'].map((g) => [g, g]) },
  { key: 'age', label: 'Age', type: 'number' },
  // One field for country code + number, the same widget as the registration form.
  { key: 'phoneNumber', label: 'Mobile / WhatsApp number', type: 'phone' },
  { key: 'designation', label: 'Designation' },
  { key: 'organization', label: 'Organization / Hospital' },
  { key: 'mciStateCode', label: 'Medical Council state code' },
  { key: 'mciRegNo', label: 'Medical Council reg. no.' },
  { key: 'membershipType', label: 'Membership', type: 'select', options: [['sgei_member', 'SGEI Member'], ['non_member', 'Non-Member']] },
  { key: 'membershipNo', label: 'SGEI membership no.', when: (v) => v.membershipType === 'sgei_member' },
  { key: 'address', label: 'Address', type: 'textarea', wide: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'pinCode', label: 'Pin code' },
];

/** Everything the form tracks – the phone widget also holds the country code. */
const TRACKED: (keyof Profile)[] = [...EDITABLE.map((f) => f.key), 'phoneCountryCode'];

const asText = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function EditModal({ open, onClose, onSaved, detail }: { open: boolean; onClose: () => void; onSaved: (msg: string) => void; detail: AdminRegistrationDetail }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);
  const membershipLocked = !!detail.conference;

  useEffect(() => {
    if (open && detail.profile) {
      setValues(Object.fromEntries(TRACKED.map((k) => [k, asText(detail.profile![k])])));
      setPhoneValid(null);
      setReason('');
      setError(null);
    }
  }, [open, detail.profile]);

  const set = (k: string, v: string) => setValues((cur) => ({ ...cur, [k]: v }));
  const changedKeys = TRACKED.filter((k) => values[k] !== undefined && values[k].trim() !== asText(detail.profile?.[k]).trim());
  const phoneChanged = changedKeys.includes('phoneNumber') || changedKeys.includes('phoneCountryCode');
  // Count the phone as one field, as it is shown.
  const changedCount = changedKeys.filter((k) => k !== 'phoneCountryCode').length + (changedKeys.includes('phoneCountryCode') && !changedKeys.includes('phoneNumber') ? 1 : 0);
  const phoneError = phoneChanged && phoneValid === false ? 'Enter a valid mobile number for the selected country.' : undefined;

  const save = async () => {
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = { reason: reason.trim() };
    for (const k of changedKeys) {
      const v = values[k].trim();
      body[k] = k === 'age' ? (v === '' ? null : Number(v)) : v;
    }
    // The number only makes sense with its country code, so send both together.
    if (phoneChanged) {
      body.phoneCountryCode = values.phoneCountryCode.trim();
      body.phoneNumber = values.phoneNumber.trim();
    }
    // Switching to Non-Member clears the membership number.
    if (body.membershipType === 'non_member') body.membershipNo = null;
    try {
      const res = await api.patch<AdminRegistrationDetail>(`/admin/registrations/${detail.user.id}`, body);
      qc.setQueryData(['admin', 'registration', String(detail.user.id)], res.data);
      // The list, counts and search show names / phones too.
      await qc.invalidateQueries({ queryKey: ['admin', 'registrations'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      onSaved(`Participant details updated (${changedCount} field${changedCount === 1 ? '' : 's'}).`);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const errs = fieldErrors(error);
  if (!detail.profile) return null;
  return (
    <Modal open={open} onClose={onClose} title="Edit participant details" width="max-w-2xl" closeOnBackdrop={false}>
      <p className="text-xs text-[#665e5d] mb-4">
        Only participant details can be edited here. Payment amounts, payment IDs and statuses come from the payment gateway and cannot be changed. Every change is recorded in the audit log.
      </p>
      <ApiErrorAlert error={error} className="mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Email (login)" name="email" hint="The login email cannot be changed here." className="sm:col-span-2">
          <TextInput name="email" value={detail.profile.email} disabled />
        </Field>
        {EDITABLE.filter((f) => !f.when || f.when(values)).map((f) => {
          const locked = f.key === 'membershipType' && membershipLocked;
          const changed = f.type === 'phone' ? phoneChanged : changedKeys.includes(f.key);
          const error = f.type === 'phone' ? errs.phoneNumber || errs.phoneCountryCode || phoneError : errs[f.key];
          return (
            <Field
              key={f.key}
              label={f.label}
              name={f.key}
              required
              error={error}
              hint={locked ? 'Locked – the conference registration was paid at this membership price.' : changed ? 'Changed' : undefined}
              className={f.wide ? 'sm:col-span-2' : ''}
            >
              {f.type === 'phone' ? (
                <PhoneInput
                  name={f.key}
                  countryCode={values.phoneCountryCode ?? ''}
                  number={values.phoneNumber ?? ''}
                  invalid={!!error}
                  onChange={(v) => {
                    setValues((cur) => ({ ...cur, phoneCountryCode: v.countryCode, phoneNumber: v.number }));
                    setPhoneValid(v.valid);
                  }}
                />
              ) : f.type === 'select' ? (
                <SelectInput name={f.key} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} invalid={!!errs[f.key]} disabled={locked} placeholder="Select">
                  {f.options!.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              ) : f.type === 'textarea' ? (
                <TextArea name={f.key} rows={2} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} invalid={!!errs[f.key]} />
              ) : (
                <TextInput
                  name={f.key}
                  inputMode={f.type === 'number' || f.key === 'phoneNumber' ? 'numeric' : undefined}
                  value={values[f.key] ?? ''}
                  onChange={(e) => set(f.key, f.type === 'number' ? e.target.value.replace(/\D/g, '').slice(0, 3) : e.target.value)}
                  invalid={!!errs[f.key]}
                />
              )}
            </Field>
          );
        })}
        <Field label="Reason for change" name="reason" required error={errs.reason} className="sm:col-span-2">
          <TextInput name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Participant requested correction by email" />
        </Field>
      </div>
      {/* z-10: keeps the phone widget's flag / dial code (z-index 1–2) from showing through while scrolling. */}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-black/[0.06] bg-white px-6 py-4">
        <span className="w-full sm:w-auto sm:mr-auto text-xs text-[#665e5d]">{changedCount ? `${changedCount} field${changedCount === 1 ? '' : 's'} changed` : 'No changes yet'}</span>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} loading={saving} disabled={!changedCount || reason.trim().length < 3 || !!phoneError}>
          Save changes
        </Button>
      </div>
    </Modal>
  );
}

export function AdminRegistrationDetailPage() {
  const { userId } = useParams();
  const [params, setParams] = useSearchParams();
  const q = useQuery({ queryKey: ['admin', 'registration', userId], queryFn: () => api.get<AdminRegistrationDetail>(`/admin/registrations/${userId}`) });
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 6000);
    return () => clearTimeout(t);
  }, [saved]);
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const p = d.profile;
  const editOpen = params.get('edit') === '1' && !!p;
  const successful = d.payments.filter((x) => ['success', 'partially_refunded', 'refunded', 'conflict'].includes(x.status));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin" className="text-xs font-bold text-[#580c1e] inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> All registrations
        </Link>
        <div className="flex items-center gap-3">
          {d.conference && <ResendButton userId={d.user.id} />}
          <Button size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setParams({ edit: '1' })} disabled={!p} title={p ? undefined : 'This participant has not filled in their details yet.'}>
            Edit details
          </Button>
        </div>
      </div>

      {saved && <Alert tone="success">{saved}</Alert>}

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#c89e37]">Order ID</span>
            <h2 className="font-mono text-2xl font-bold text-[#580c1e]">{d.order?.orderNumber ?? 'Not assigned (no successful payment)'}</h2>
          </div>
          <div className="text-right text-xs text-[#665e5d]">
            Account created {dateTime(d.user.registeredAt)}
            <br />
            {d.order?.confirmedAt && <>Confirmed {dateTime(d.order.confirmedAt)}</>}
          </div>
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Participant details</h3>
        {p ? (
          <DefinitionList
            rows={[
              ['Name', [p.title, p.fullName].filter(Boolean).join(' ')],
              ['Email', p.email],
              ['Mobile / WhatsApp', p.phoneNumber ? `${p.phoneCountryCode ?? ''} ${p.phoneNumber}` : null],
              ['Age', p.age],
              ['Gender', p.gender],
              ['Designation', p.designation],
              ['Organization / Hospital', p.organization],
              ['Medical Council Reg.', p.mciStateCode ? `${p.mciStateCode} – ${p.mciRegNo}` : null],
              ['Membership', p.membershipType === 'sgei_member' ? `SGEI Member (${p.membershipNo})` : p.membershipType === 'non_member' ? 'Non-Member' : null],
              ['Address', p.address],
              ['City / State', [p.city, p.state].filter(Boolean).join(', ')],
              ['Country / Pin code', [p.country, p.pinCode].filter(Boolean).join(' – ')],
              ['Step 1 completed', p.completedAt ? dateTime(p.completedAt) : 'No'],
            ]}
          />
        ) : (
          <p className="text-xs">No profile.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Conference</h3>
          {d.conference ? (
            <DefinitionList
              rows={[
                ['Category', d.conference.categoryName],
                ['Pricing category', PERIOD_LABEL[d.conference.pricingPeriodCode ?? ''] ?? d.conference.source],
                ['Price', `${money(d.conference.amountMinor)} + GST ${money(d.conference.gstMinor)}`],
                ...(d.conference.fxRate ? ([['Original price', `USD ${d.conference.originalUnitAmountMinor / 100} @ ₹${d.conference.fxRate}`]] as [string, string][]) : []),
              ]}
            />
          ) : (
            <p className="text-xs text-[#665e5d]">Not purchased.</p>
          )}
          {d.accompanying.length > 0 && (
            <div className="mt-4">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] mb-1">Accompanying persons</h4>
              <ul className="text-xs space-y-0.5">
                {d.accompanying.map((a) => (
                  <li key={a.id}>
                    {[a.title, a.fullName].filter(Boolean).join(' ')} – {a.categoryName} · {money(a.amountMinor)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Workshops</h3>
          {d.workshops.length ? (
            <ul className="text-sm space-y-1.5">
              {d.workshops.map((w) => (
                <li key={w.id} className="flex justify-between gap-2">
                  <span>{w.name}</span>
                  <span className="text-xs text-[#665e5d] whitespace-nowrap">{money(w.amountMinor)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#665e5d]">None.</p>
          )}
        </Card>
        <Card>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Accommodation</h3>
          {d.accommodation ? (
            <DefinitionList
              rows={[
                ['Hotel / room', `${d.accommodation.hotelName} – ${d.accommodation.occupancy === 'single' ? 'Single' : 'Twin share'}`],
                ['Stay', `${date(d.accommodation.checkIn)} → ${date(d.accommodation.checkOut)} (${d.accommodation.nights} nights)`],
                ['Price', `${money(d.accommodation.unitAmountMinor)} × ${d.accommodation.nights} = ${money(d.accommodation.amountMinor)} + GST`],
              ]}
            />
          ) : (
            <p className="text-xs text-[#665e5d]">None.</p>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Payment breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f5f3f0] text-[10px] uppercase tracking-wider text-[#665e5d]">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">For</th>
                <th className="text-right px-3 py-2">Price</th>
                <th className="text-right px-3 py-2">GST (18%)</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Payment ID</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {d.payments.map((pay) =>
                pay.items.map((it, i) => (
                  <tr key={`${pay.id}-${i}`} className={`border-t border-black/[0.05] ${['success', 'partially_refunded'].includes(pay.status) ? '' : 'text-[#665e5d]'}`}>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{i === 0 ? date(pay.paidAt ?? pay.createdAt) : ''}</td>
                    <td className="px-3 py-2 text-xs">{it.itemType === 'conference' ? it.description : `Add-on: ${it.description}`}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{money(it.amountMinor)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{money(it.gstMinor)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{money(it.totalMinor)}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{pay.gatewayPaymentId ?? pay.gatewayOrderId ?? '—'}</td>
                    <td className="px-3 py-2">{i === 0 && <StatusBadge status={pay.status} />}</td>
                    <td className="px-3 py-2 text-xs">
                      {i === 0 && pay.invoice && (
                        <a href={apiUrl(`/invoices/${pay.invoice.id}/pdf`)} target="_blank" rel="noreferrer" className="text-[#580c1e] font-bold underline">
                          {pay.invoice.number}
                        </a>
                      )}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black/10 font-bold">
                <td colSpan={2} className="px-3 py-3 text-right uppercase text-xs tracking-wider">
                  Total Paid
                </td>
                <td className="px-3 py-3 text-right">{money(d.totals.subtotalMinor)}</td>
                <td className="px-3 py-3 text-right">{money(d.totals.gstMinor)}</td>
                <td className="px-3 py-3 text-right text-[#580c1e]">{money(d.totals.totalPaidMinor)}</td>
                <td colSpan={3} className="px-3 py-3 text-xs font-normal text-[#665e5d]">
                  {successful.length} successful payment(s){d.totals.refundedMinor > 0 && ` · refunded ${money(d.totals.refundedMinor)}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {d.payments.some((x) => x.failureReason) && (
          <ul className="mt-3 text-[11px] text-[#665e5d] space-y-0.5">
            {d.payments
              .filter((x) => x.failureReason)
              .map((x) => (
                <li key={x.id}>
                  Payment #{x.id} ({x.status}): {x.failureReason}
                </li>
              ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Emails</h3>
          {d.emails.length ? (
            <ul className="text-xs space-y-1.5">
              {d.emails.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span>
                    {e.template.replace(/_/g, ' ')} → {e.to_email}
                  </span>
                  <span className="text-[#665e5d] whitespace-nowrap">
                    {e.status}
                    {e.sent_at ? ` · ${dateTime(e.sent_at)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#665e5d]">No emails.</p>
          )}
        </Card>
        <Card>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Audit log</h3>
          {d.audit.length ? (
            <ul className="text-xs space-y-2">
              {d.audit.map((a) => (
                <li key={a.id}>
                  <span className="font-semibold">{a.action}</span> by {a.actor_email ?? 'system'} · {dateTime(a.created_at)}
                  {a.after != null && <pre className="mt-1 text-[10px] bg-[#faf8f5] rounded p-2 overflow-x-auto">{JSON.stringify(a.after, null, 1)}</pre>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#665e5d]">No changes recorded.</p>
          )}
        </Card>
      </div>

      <EditModal open={editOpen} onClose={() => setParams({})} onSaved={setSaved} detail={d} />
    </div>
  );
}
