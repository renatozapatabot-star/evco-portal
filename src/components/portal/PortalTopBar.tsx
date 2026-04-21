'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { PortalBadge } from './PortalBadge'
import { PortalButton } from './PortalButton'
import { PortalKbd } from './PortalText'

export interface PortalTopBarProps {
  /** Called when user clicks the center search or hits Cmd+K. */
  onOpenCmd: () => void
  onLogout?: () => void
  /** Optional callback URL when wordmark is clicked. */
  homeHref?: string
  /** Last crossing event for the live toast. Fed via window.__cruzCrossingBus or caller. */
  lastCross?: { id: string; label: string; ts: string } | null
  /** Override the default placeholder copy in the search button. */
  searchPlaceholder?: string
  /** Extra slot right of the logout button (nav links, user menu). */
  rightExtras?: ReactNode
}

/**
 * Sticky top bar — pulsing green dot + PORTAL wordmark on the left,
 * Cmd+K command palette trigger in the center, live status + logout
 * on the right. Pulses emerald on crossing events (when lastCross
 * changes, border + bg glow for 1.1s via the crossFlash animation).
 *
 * Port of .planning/design-handoff/cruz-portal/project/src/screen-dashboard.jsx:5-80.
 */
export function PortalTopBar({
  onOpenCmd,
  onLogout,
  homeHref = '/inicio',
  lastCross,
  searchPlaceholder = 'Busca un SKU, pedimento, embarque, Anexo 24…',
  rightExtras,
}: PortalTopBarProps) {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!lastCross) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 1100)
    return () => clearTimeout(t)
  }, [lastCross?.id])

  return (
    <header
      style={{
        height: 'var(--portal-topbar-h, 56px)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: '0 clamp(12px, 3vw, 24px)',
        borderBottom: `1px solid ${pulse ? 'var(--portal-green-2)' : 'var(--portal-line-1)'}`,
        background: pulse
          ? 'color-mix(in oklch, var(--portal-green-2) 6%, var(--portal-ink-0) 85%)'
          : 'color-mix(in oklch, var(--portal-ink-0) 85%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        transition: 'all 700ms var(--portal-ease-out)',
        boxShadow: pulse ? '0 0 30px -4px var(--portal-green-glow)' : 'none',
      }}
    >
      {/* Left: pulse dot + PORTAL wordmark */}
      <a
        href={homeHref}
        style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
        aria-label="PORTAL home"
      >
        <span style={{ position: 'relative', width: 9, height: 9, flexShrink: 0 }}>
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              background: 'var(--portal-green-2)',
              boxShadow: '0 0 12px var(--portal-green-glow)',
              animation: 'portalDotPulse 2.4s ease-in-out infinite',
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: 999,
              border: '1px solid var(--portal-green-2)',
              opacity: 0.5,
              animation: 'portalPing 2.4s ease-out infinite',
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: 999,
              border: '1px solid var(--portal-green-2)',
              opacity: 0.3,
              animation: 'portalPing 2.4s ease-out 1.2s infinite',
            }}
          />
        </span>
        <span
          style={{
            fontFamily: 'var(--portal-font-display)',
            fontWeight: 300,
            fontSize: 15,
            letterSpacing: '0.45em',
            color: 'var(--portal-fg-1)',
            paddingLeft: '0.3em',
          }}
        >
          PORTAL
        </span>
      </a>

      {/* Center: command palette trigger */}
      <div style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        <button
          onClick={onOpenCmd}
          style={{
            width: '100%',
            maxWidth: 560,
            height: 36,
            padding: '0 12px',
            borderRadius: 'var(--portal-r-2)',
            border: '1px solid var(--portal-line-1)',
            background: 'var(--portal-ink-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 'var(--portal-fs-sm)',
            color: 'var(--portal-fg-3)',
            minWidth: 0,
            cursor: 'pointer',
          }}
          aria-label="Abrir búsqueda y agente"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span
            style={{
              flex: 1,
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {searchPlaceholder}
          </span>
          <PortalKbd>⌘</PortalKbd>
          <PortalKbd>K</PortalKbd>
        </button>
      </div>

      {/* Right: last-cross toast + live badge + logout */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          justifyContent: 'flex-end',
        }}
      >
        {lastCross && (
          <span
            key={lastCross.id}
            style={{
              fontFamily: 'var(--portal-font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              color: pulse ? 'var(--portal-green-2)' : 'var(--portal-fg-4)',
              textTransform: 'uppercase',
              animation: pulse ? 'crossToastIn 400ms var(--portal-ease-out) both' : undefined,
              transition: 'color 700ms',
              whiteSpace: 'nowrap',
            }}
          >
            ✓ {lastCross.label} · {lastCross.ts}
          </span>
        )}
        <PortalBadge tone="live" pulse>
          EN LÍNEA
        </PortalBadge>
        {rightExtras}
        {onLogout && (
          <PortalButton variant="ghost" size="sm" onClick={onLogout}>
            Salir
          </PortalButton>
        )}
      </div>
    </header>
  )
}
