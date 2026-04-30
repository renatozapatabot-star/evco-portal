'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu, LogOut, ChevronLeft, Home } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { TopbarStatus } from './TopbarStatus';
import { AguilaLivePill } from './AguilaLivePill';
import { CruzCommand } from '@/components/command/CruzCommand';

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
              // 60 × 60 tap target (CLAUDE.md mobile rule). Visual icon
              // stays 20 × 20; padding absorbs the extra surface so the
              // hit box is the full 60px without enlarging the glyph.
              width: 60,
              height: 60,
              padding: 20,
              boxSizing: 'border-box',
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

        {/* Home link — plain home glyph. The Z wordmark belongs to the
            login hero; the topbar carries the alive signal + search as
            its identity elements, not a repeat brand mark (2026-04-20). */}
        <Link
          href="/"
          className="topbar-logo"
          aria-label="Inicio"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 60,
            height: 60,
            padding: 20,
            boxSizing: 'border-box',
            color: 'rgba(255,255,255,0.55)',
            transition: 'color 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
        >
          <Home size={18} />
        </Link>

        {/* CruzCommand — live search + AI entry point. Replaces the
            legacy open-palette button with an always-visible inline
            input. ⌘K focuses the input (wins over the legacy modal);
            Shift+⌘K still falls through to the advanced palette. */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 12px', minWidth: 0 }}>
          <CruzCommand mode="compact" hideAI={isClient} />
        </div>

        {/* Right: status indicators + alive pill + company name + logout */}
        <div className="topbar-right">
          <TopbarStatus />
          {/* Alive signal — canonical breathing pill visible on every
              authenticated page regardless of portal type. Compact on
              mobile (just the pulsing dot), full chip on desktop. */}
          <span className="topbar-alive-desktop"><AguilaLivePill label="En línea" /></span>
          <span className="topbar-alive-mobile"><AguilaLivePill label="En línea" compact /></span>
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
          width: 60,
          height: 60,
          padding: 20,
          boxSizing: 'border-box',
          color: 'rgba(255,255,255,0.55)',
          transition: 'color 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
      >
        <Home size={18} />
      </Link>
      {/* Operator topbar gets the same inline CruzCommand — one search
          surface, same keyboard contract, regardless of portal type. */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 12px', minWidth: 0 }}>
        <CruzCommand mode="compact" />
      </div>

      <div className="topbar-right">
        <TopbarStatus />
        <span className="topbar-alive-desktop"><AguilaLivePill label="En línea" /></span>
        <span className="topbar-alive-mobile"><AguilaLivePill label="En línea" compact /></span>
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
