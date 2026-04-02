'use client';

import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface CruzLayoutProps {
  children: ReactNode;
  portalType: 'operator' | 'client';
  clientName?: string;
  clientInitials?: string;
  /** Status bar message */
  statusMessage?: string;
  statusLevel?: 'ok' | 'warning' | 'alert';
  /** MVE countdown days remaining (null to hide) */
  mveDays?: number | null;
  onLogout?: () => void;
  onSearch?: (query: string) => void;
  /** Mobile sidebar state */
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
}

export default function CruzLayout({
  children,
  portalType,
  clientName,
  clientInitials,
  statusMessage = 'Todo en orden',
  statusLevel = 'ok',
  mveDays = null,
  onLogout,
  onSearch,
  mobileOpen = false,
  onMobileToggle,
}: CruzLayoutProps) {
  return (
    <div className="cruz-layout">
      {/* Mobile backdrop */}
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
      <main className="cruz-main">
        <TopBar
          statusMessage={statusMessage}
          statusLevel={statusLevel}
          mveDays={portalType === 'operator' ? mveDays : null}
          showNotifications={false}
          onSearch={onSearch}
          onMenuToggle={onMobileToggle}
        />
        {children}
      </main>
    </div>
  );
}
