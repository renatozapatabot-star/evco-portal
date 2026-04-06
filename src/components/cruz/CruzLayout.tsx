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
}

export default function CruzLayout({
  children,
  portalType,
  clientName,
  clientInitials,
  onLogout,
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
          showNotifications={false}
          onMenuToggle={onMobileToggle}
        />
        {children}
      </main>
    </div>
  );
}
