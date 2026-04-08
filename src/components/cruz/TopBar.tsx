'use client';

import Link from 'next/link';
import { Search, Bell, Menu } from 'lucide-react';
import { useNotificationBadge } from '@/hooks/use-notifications';

interface TopBarProps {
  showNotifications?: boolean;
  onMenuToggle?: () => void;
  portalType?: 'operator' | 'client';
  clientName?: string;
  clientInitials?: string;
}

function openCommandPalette() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
}

export default function TopBar({
  showNotifications = false,
  onMenuToggle,
  portalType = 'operator',
  clientName,
  clientInitials,
}: TopBarProps) {
  const { unreadCount } = useNotificationBadge();
  const badgeText = unreadCount === 0 ? null : unreadCount > 9 ? '9+' : String(unreadCount);
  const isClient = portalType === 'client';

  // ── CLIENT PORTAL TOPBAR — full-width cockpit mode ──
  if (isClient) {
    return (
      <header className="cruz-topbar cruz-topbar--client">
        {/* Logo */}
        <Link href="/" className="topbar-logo" aria-label="CRUZ inicio">
          <span className="topbar-logo-z">Z</span>
          <span className="topbar-logo-text">CRUZ</span>
        </Link>

        {/* Wide search bar (desktop) */}
        <button
          className="topbar-search-wide"
          onClick={openCommandPalette}
          aria-label="Buscar"
        >
          <Search size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
          <span className="topbar-search-placeholder">
            Buscar tráfico, entradas, pedimentos... o presiona ⌘K
          </span>
        </button>

        {/* Compact search icon (mobile — shows when wide bar is hidden) */}
        <div style={{ flex: 1 }} className="topbar-mobile-spacer" />
        <button
          className="topbar-search-icon-mobile"
          onClick={openCommandPalette}
          aria-label="Buscar"
        >
          <Search size={18} />
        </button>

        {/* Right: bell + company name + avatar */}
        <div className="topbar-right">
          {badgeText && (
            <button className="topbar-bell-btn" aria-label={`${unreadCount} notificaciones`}>
              <Bell size={16} />
              <span className="topbar-bell-badge badge-bounce">{badgeText}</span>
            </button>
          )}
          {clientName && (
            <span className="topbar-client-name">{clientName}</span>
          )}
          <div className="topbar-avatar" title={clientName || ''}>
            {clientInitials || 'CL'}
          </div>
        </div>
      </header>
    );
  }

  // ── OPERATOR PORTAL TOPBAR — unchanged ──
  return (
    <header className="cruz-topbar">
      {onMenuToggle && (
        <button className="topbar-hamburger" onClick={onMenuToggle} aria-label="Abrir menú">
          <Menu size={20} />
        </button>
      )}
      <div style={{ flex: 1 }} />
      <button
        className="topbar-search-btn"
        onClick={openCommandPalette}
        aria-label="Buscar"
      >
        <Search size={16} />
        <span className="topbar-search-label">Buscar tráfico, pedimento...</span>
      </button>

      <div className="topbar-right">
        {showNotifications && (
          <button
            className="topbar-bell-btn"
            aria-label={`${unreadCount} notificaciones sin leer`}
          >
            <Bell size={16} />
            {badgeText && (
              <span className="topbar-bell-badge badge-bounce">
                {badgeText}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
