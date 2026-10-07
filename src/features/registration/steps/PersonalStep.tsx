import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { api } from '../../../lib/api';
import type { Profile, RegistrationStatus } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Field, TextInput } from '../../../components/ui/Field';
import { Alert, ApiErrorAlert, fieldErrors } from '../../../components/ui/States';
import { keys } from '../hooks';
import { PersonalFields, personalFromProfile, personalPayload, validatePersonal, type PersonalForm } from './PersonalFields';

/** Step 1 for an existing account – pre-filled from the saved profile. */
export function PersonalStep({ status, onNext }: { status: RegistrationStatus; onNext: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PersonalForm>(() => personalFromProfile(status.profile));
  const [local, setLocal] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    setForm(personalFromProfile(status.profile));
  }, [status.profile]);

  const errs = { ...fieldErrors(error), ...local };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved('');
    const v = validatePersonal(form);
    setLocal(v);
    if (Object.keys(v).length) {
      document.getElementById(Object.keys(v)[0])?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await api.put<Profile>('/profile', personalPayload(form));
      setSaved(res.message);
      qc.setQueryData(keys.profile, res.data);
      await qc.invalidateQueries({ queryKey: keys.status });
      onNext();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-9">
      <ApiErrorAlert error={error} />
      {saved && <Alert tone="success">{saved}</Alert>}
      <PersonalFields
        form={form}
        setForm={setForm}
        errs={errs}
        membershipLocked={!!status.conference}
        email={
          <Field label="Email Address" name="email">
            <TextInput name="email" value={status.profile.email} disabled readOnly />
          </Field>
        }
      />
      <div className="flex justify-end pt-5 border-t border-black/[0.06]">
        <Button type="submit" loading={saving} icon={<ArrowRight className="w-4 h-4" />}>
          Save &amp; Continue
        </Button>
      </div>
    </form>
  );
}
