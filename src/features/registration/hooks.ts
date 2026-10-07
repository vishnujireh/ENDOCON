import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildCatalogue } from '../../data/catalogue';
import { api } from '../../lib/api';
import type { Catalogue, Profile, RegistrationStatus } from '../../api/types';

export const keys = {
  status: ['registration-status'] as const,
  profile: ['profile'] as const,
};

/**
 * The static catalogue (from ../shared/catalogue.json – no API call). The current pricing period
 * and workshop seats come from the registration status, i.e. from the server clock.
 */
export function useCatalogue() {
  const status = useQuery({ queryKey: keys.status, queryFn: () => api.get<RegistrationStatus>('/registration/status'), enabled: false });
  const data = useMemo<Catalogue>(() => buildCatalogue(status.data), [status.data]);
  return { data, isLoading: false as const, error: null, refetch: status.refetch };
}

/** Backend is the source of truth: the whole wizard is rebuilt from this. */
export function useRegistrationStatus() {
  return useQuery({ queryKey: keys.status, queryFn: () => api.get<RegistrationStatus>('/registration/status') });
}

export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => api.get<Profile>('/profile') });
}

/**
 * Where a participant should land after logging in: their next unfinished wizard step,
 * or the "My Registration" page once everything available has been done.
 */
export async function resumePath(): Promise<string> {
  try {
    const s = await api.get<RegistrationStatus>('/registration/status');
    return s.nextStep === 'complete' ? '/registration' : `/registration/wizard/${s.nextStep}`;
  } catch {
    return '/registration';
  }
}
