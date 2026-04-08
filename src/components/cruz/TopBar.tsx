'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bell, Menu, LogOut, ChevronLeft } from 'lucide-react';
import { useNotificationBadge } from '@/hooks/use-notifications';
import { CruzMark } from '@/components/command-center/CruzMark';

interface TopBarProps {
  showNotifications?: boolean;
  onMenuToggle?: () => void;
  onLogout?: () => void;
  portalType?: 'operator' | 'client';
  clientName?: string;
  clientInitials?: string;
}

function openCommandPalette() {
  document.dispatchEvent(new CustomEvent('cruz:open-search'))
}

export default function TopBar({
  showNotifications = false,
  onMenuToggle,
  onLogout,
  portalType = 'operator',
  clientName,
  clientInitials,
}: TopBarProps) {
  const pathname = usePathname();
  const { unreadCount } = useNotificationBadge();
  const badgeText = unreadCount === 0 ? null : unreadCount > 9 ? '9+' : String(unreadCount);
  const isClient = portalType === 'client';
  const isHome = pathname === '/';

  // ── CLIENT PORTAL TOPBAR — full-width cockpit mode ──
  if (isClient) {
    return (
      <header className="cruz-topbar cruz-topbar--client">
        {/* Back button — shown on inner pages only */}
        {!isHome && (
          <Link
            href="/"
            aria-label="Volver al inicio"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 8,
              color: 'rgba(255,255,255,0.6)',
              transition: 'color 150ms, background 150ms',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'transparent' }}
          >
            <ChevronLeft size={20} />
          </Link>
        )}

        {/* Logo */}
        <Link href="/" className="topbar-logo" aria-label="CRUZ inicio">
          <CruzMark size={40} />
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

        {/* Right: company name + logout */}
        <div className="topbar-right">
          {clientName && (
            <span className="topbar-client-name">{clientName}</span>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              aria-label="Cerrar sesion"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-muted, #888)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'color 150ms, border-color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted, #888)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
            >
              <LogOut size={14} />
              Salir
            </button>
          )}
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
        {onLogout && (
          <button
            onClick={onLogout}
            className="topbar-logout-btn"
            aria-label="Cerrar sesion"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--text-muted, #888)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'color 150ms, border-color 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted, #888)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
          >
            <LogOut size={14} />
            Salir
          </button>
        )}
      </div>
    </header>
  );
}
