'use client';

import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AguilaLayoutProps {
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
  /** Hide shell TopBar — use when the page owns its own top bar (e.g. PortalDashboard) */
  hideTopBar?: boolean;
}

export default function AguilaLayout({
  children,
  portalType,
  clientName,
  clientInitials,
  onLogout,
  mobileOpen = false,
  onMobileToggle,
  hideSidebar = false,
  hideTopBar = false,
}: AguilaLayoutProps) {
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
      <main className={`aduana-main aguila-dark ${hideSidebar ? 'aduana-main--full' : ''}`}>
        {!hideTopBar && (
          <TopBar
            showNotifications={portalType === 'operator'}
            onMenuToggle={hideSidebar ? undefined : onMobileToggle}
            onLogout={onLogout}
            portalType={portalType}
            clientName={clientName}
            clientInitials={clientInitials}
          />
        )}
        {children}
      </main>
    </div>
  );
}
