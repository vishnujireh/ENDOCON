import React from 'react';
import { Outlet } from 'react-router-dom';

/** Page frame for the admin sections; the header (logo, sections, back to site, logout) is AdminHeader. */
export function AdminLayout() {
  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Outlet />
      </div>
    </div>
  );
}
