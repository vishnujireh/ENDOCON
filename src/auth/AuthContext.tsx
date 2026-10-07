import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setCsrfToken, setUnauthorizedHandler } from '../lib/api';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, opts?: { admin?: boolean }) => Promise<User>;
  register: (input: { fullName: string; email: string; phoneCountryCode: string; phoneNumber: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

type SessionPayload = { user: User | null; csrfToken: string | null };

/** Session lives in an httpOnly cookie; the SPA only keeps the user summary + CSRF token in memory. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const apply = useCallback((s: SessionPayload) => {
    setCsrfToken(s.csrfToken);
    setUser(s.user);
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await api.get<SessionPayload>('/auth/me'));
    } catch {
      apply({ user: null, csrfToken: null });
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
    setUnauthorizedHandler(() => {
      setCsrfToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string, opts: { admin?: boolean } = {}) => {
      const { data } = await api.post<SessionPayload>(opts.admin ? '/admin/auth/login' : '/auth/login', { email, password });
      queryClient.clear();
      apply(data);
      return data.user!;
    },
    [apply, queryClient],
  );

  const register = useCallback(
    async (input: { fullName: string; email: string; phoneCountryCode: string; phoneNumber: string; password: string }) => {
      const { data } = await api.post<SessionPayload>('/auth/register', input);
      queryClient.clear();
      apply(data);
      return data.user!;
    },
    [apply, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      queryClient.clear();
      apply({ user: null, csrfToken: null });
    }
  }, [apply, queryClient]);

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
