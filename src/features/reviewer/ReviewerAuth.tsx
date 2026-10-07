import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { reviewerApi, setReviewerCsrfToken, setReviewerUnauthorizedHandler } from '../../lib/api';
import { LoadingState } from '../../components/ui/States';

/**
 * Reviewer (judge) session – separate from delegate / admin accounts. The session lives in an
 * httpOnly cookie; the portal only keeps the reviewer summary and its CSRF token in memory.
 */

export interface ReviewerUser {
  id: number;
  reviewerCode: string;
  name: string;
  email: string;
}

interface ReviewerAuthState {
  reviewer: ReviewerUser | null;
  loading: boolean;
  requestCode: (email: string) => Promise<string>;
  verifyCode: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

type Me = { reviewer: ReviewerUser | null; csrfToken: string | null };

const Ctx = createContext<ReviewerAuthState | null>(null);

export function ReviewerAuthProvider({ children }: { children: React.ReactNode }) {
  const [reviewer, setReviewer] = useState<ReviewerUser | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((m: Me) => {
    setReviewerCsrfToken(m.csrfToken);
    setReviewer(m.reviewer);
  }, []);

  useEffect(() => {
    reviewerApi
      .get<Me>('/auth/me')
      .then(apply)
      .catch(() => apply({ reviewer: null, csrfToken: null }))
      .finally(() => setLoading(false));
    setReviewerUnauthorizedHandler(() => apply({ reviewer: null, csrfToken: null }));
    return () => setReviewerUnauthorizedHandler(null);
  }, [apply]);

  const requestCode = useCallback(async (email: string) => (await reviewerApi.post<{ sent: boolean }>('/auth/request-otp', { email })).message, []);
  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const { data } = await reviewerApi.post<{ reviewer: ReviewerUser; csrfToken: string }>('/auth/verify-otp', { email, code });
      apply(data);
    },
    [apply],
  );
  const logout = useCallback(async () => {
    try {
      await reviewerApi.post('/auth/logout');
    } finally {
      apply({ reviewer: null, csrfToken: null });
    }
  }, [apply]);

  const value = useMemo(() => ({ reviewer, loading, requestCode, verifyCode, logout }), [reviewer, loading, requestCode, verifyCode, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReviewerAuth(): ReviewerAuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useReviewerAuth must be used inside <ReviewerAuthProvider>');
  return ctx;
}

/** Reviewer-only pages: signed-out visitors go to the reviewer login. */
export function RequireReviewer({ children }: { children: React.ReactNode }) {
  const { reviewer, loading } = useReviewerAuth();
  if (loading) return <LoadingState label="Checking your session…" />;
  if (!reviewer) return <Navigate to="/reviewer/login" replace />;
  return <>{children}</>;
}
