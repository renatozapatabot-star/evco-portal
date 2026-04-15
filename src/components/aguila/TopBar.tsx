'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu, LogOut, ChevronLeft } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { AguilaMark } from '@/components/brand/AguilaMark';
import { TopbarStatus } from './TopbarStatus';

interface TopBarProps {
  showNotifications?: boolean;
  onMenuToggle?: () => void;
  onLogout?: () => void;
  portalType?: 'operator' | 'client';
  clientName?: string;
  /** @deprecated kept for back-compat with AguilaLayout callers. */
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
}: TopBarProps) {
  const pathname = usePathname();
  const isClient = portalType === 'client';
  const isHome = pathname === '/';

  // ── CLIENT PORTAL TOPBAR — full-width cockpit mode ──
  if (isClient) {
    return (
      <header className="aduana-topbar aduana-topbar--client">
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

        {/* Home link — plain icon, no brand mark on authenticated surfaces.
            Identity lives on the login hero only (per 2026-04-15 audit). */}
        <Link
          href="/"
          className="topbar-logo"
          aria-label="Inicio"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36, height: 36,
          }}
        >
          <AguilaMark size={28} />
        </Link>

        {/* Wide search bar (desktop) */}
        <button
          className="topbar-search-wide"
          onClick={openCommandPalette}
          aria-label="Buscar"
        >
          <Search size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
          <span className="topbar-search-placeholder">
            Buscar embarque, entradas, pedimentos...
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

        {/* Right: status indicators + company name + logout */}
        <div className="topbar-right">
          <TopbarStatus />
          {clientName && (
            <span className="topbar-client-name">{clientName}</span>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              aria-label="Cerrar sesión"
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

  // ── OPERATOR PORTAL TOPBAR ──
  return (
    <header className="aduana-topbar">
      {onMenuToggle && (
        <button className="topbar-hamburger" onClick={onMenuToggle} aria-label="Abrir menú">
          <Menu size={20} />
        </button>
      )}
      <Link
        href="/"
        className="topbar-logo"
        aria-label="Inicio"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36, height: 36,
        }}
      >
        <AguilaMark size={28} />
      </Link>
      <div style={{ flex: 1 }} />
      <button
        className="topbar-search-btn"
        onClick={openCommandPalette}
        aria-label="Buscar"
      >
        <Search size={16} />
        <span className="topbar-search-label">Buscar embarque, pedimento...</span>
      </button>

      <div className="topbar-right">
        <TopbarStatus />
        {showNotifications && <NotificationBell />}
        {onLogout && (
          <button
            onClick={onLogout}
            className="topbar-logout-btn"
            aria-label="Cerrar sesión"
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
