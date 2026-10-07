import React from 'react';
import { Outlet } from 'react-router-dom';
import { ReviewerAuthProvider } from './ReviewerAuth';
import { ReviewerHeader } from './ReviewerHeader';

/** /reviewer/* – the judges' portal (own session, own header, no site navigation). */
export function ReviewerLayout() {
  return (
    <ReviewerAuthProvider>
      <ReviewerHeader />
      <Outlet />
    </ReviewerAuthProvider>
  );
}
