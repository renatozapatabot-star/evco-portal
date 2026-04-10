'use client';

import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AduanaLayoutProps {
  children: ReactNode;
  portalType: 'operator' | 'client';
  clientName?: string;
  clientInitials?: string;
  onLogout?: () => void;
  /** Mobile sidebar state */
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
  /** Hide sidebar entirely (client portal — full-screen cockpit) */
  hideSidebar?: boolean;
}

export default function AduanaLayout({
  children,
  portalType,
  clientName,
  clientInitials,
  onLogout,
  mobileOpen = false,
  onMobileToggle,
  hideSidebar = false,
}: AduanaLayoutProps) {
  return (
    <div className="aduana-layout">
      {/* Sidebar + backdrop — only for operator portal */}
      {!hideSidebar && (
        <>
          <div
            className={`sidebar-backdrop ${mobileOpen ? 'visible' : ''}`}
            onClick={onMobileToggle}
            aria-hidden="true"
          />
          <Sidebar
            portalType={portalType}
            clientName={clientName}
            clientInitials={clientInitials}
            onLogout={onLogout}
            mobileOpen={mobileOpen}
            onMobileClose={onMobileToggle}
          />
        </>
      )}
      <main className={`aduana-main aduana-dark ${hideSidebar ? 'aduana-main--full' : ''}`}>
        <TopBar
          showNotifications={false}
          onMenuToggle={hideSidebar ? undefined : onMobileToggle}
          onLogout={onLogout}
          portalType={portalType}
          clientName={clientName}
          clientInitials={clientInitials}
        />
        {children}
      </main>
    </div>
  );
}
