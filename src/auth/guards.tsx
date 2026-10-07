import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/ui/States';
import { LoginPage } from '../pages/LoginPage';
import { useAuth } from './AuthContext';

/** Participant-only pages. Unauthenticated users go to login and come back afterwards. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

/**
 * Admin-only pages (the API enforces this too). Signed-out visitors see the admin login right
 * at the requested address (/admin, /admin/abstracts …) and land on that page after signing in.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState label="Checking your session…" />;
  if (!user || user.role !== 'admin') return <LoginPage admin />;
  return <>{children}</>;
}
