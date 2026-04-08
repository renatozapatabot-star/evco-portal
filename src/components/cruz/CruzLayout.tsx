'use client';

import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface CruzLayoutProps {
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

export default function CruzLayout({
  children,
  portalType,
  clientName,
  clientInitials,
  onLogout,
  mobileOpen = false,
  onMobileToggle,
  hideSidebar = false,
}: CruzLayoutProps) {
  return (
    <div className="cruz-layout">
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
      <main className={`cruz-main ${hideSidebar ? 'cruz-main--full' : ''}`}>
        <TopBar
          showNotifications={false}
          onMenuToggle={hideSidebar ? undefined : onMobileToggle}
          portalType={portalType}
          clientName={clientName}
          clientInitials={clientInitials}
        />
        {children}
      </main>
    </div>
  );
}
