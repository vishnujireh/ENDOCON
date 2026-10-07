import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingState } from '../../components/ui/States';
import { resumePath } from './hooks';

/** Sends a logged-in participant to their next unfinished registration step. */
export function ResumeRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let alive = true;
    resumePath().then((to) => {
      if (alive) navigate(to, { replace: true });
    });
    return () => {
      alive = false;
    };
  }, [navigate]);
  return <LoadingState label="Opening your registration…" />;
}
