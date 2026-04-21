'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { PortalBadge } from './PortalBadge'

export interface PaletteSuggestion {
  id: string
  /** Icon name — accepts any small SVG slot. */
  icon?: ReactNode
  label: string
  onClick?: () => void
}

export interface PortalCommandPaletteProps {
  open: boolean
  onClose: () => void
  suggestions?: PaletteSuggestion[]
  placeholder?: string
}

const DEFAULT_SUGGESTIONS: PaletteSuggestion[] = [
  { id: 's1', label: 'Ver embarques en tránsito' },
  { id: 's2', label: 'Mostrar último pedimento' },
  { id: 's3', label: 'SKUs en Anexo 24 por revisar' },
  { id: 's4', label: 'Estado de puentes ahora' },
]

/**
 * Cmd+K modal — full-screen backdrop (black 60% + blur 4px) with a
 * centered card (ink-2, line-3 border, shadow-3). Autofocus input +
 * suggestions list. ESC closes via the useCmdK hook at the caller.
 *
 * Port of .planning/design-handoff/cruz-portal/project/src/screen-dashboard.jsx:602-647.
 */
export function PortalCommandPalette({
  open,
  onClose,
  suggestions = DEFAULT_SUGGESTIONS,
  placeholder = "Pregúntale al Agente IA — '¿cuánto IVA pagué en marzo?'",
}: PortalCommandPaletteProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 120,
        animation: 'portalFadeUp 200ms var(--portal-ease-out)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda y agente"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(620px, 92vw)',
          background: 'var(--portal-ink-2)',
          border: '1px solid var(--portal-line-3)',
          borderRadius: 'var(--portal-r-4)',
          boxShadow: 'var(--portal-shadow-3)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--portal-line-1)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--portal-green-2)',
              boxShadow: '0 0 8px var(--portal-green-glow)',
              animation: 'portalDotPulse 2s ease-in-out infinite',
            }}
          />
          <input
            autoFocus
            placeholder={placeholder}
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              outline: 'none',
              fontSize: 'var(--portal-fs-md)',
              color: 'var(--portal-fg-1)',
              fontFamily: 'var(--portal-font-sans)',
            }}
          />
          <PortalBadge>ESC</PortalBadge>
        </div>
        <div style={{ padding: 14 }}>
          <div className="portal-eyebrow" style={{ padding: '4px 8px 10px' }}>
            SUGERENCIAS
          </div>
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                s.onClick?.()
                onClose()
              }}
              style={{
                width: '100%',
                padding: '10px 8px',
                borderRadius: 'var(--portal-r-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
                color: 'var(--portal-fg-2)',
                fontSize: 'var(--portal-fs-sm)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--portal-ink-3)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              {s.icon ?? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'var(--portal-fg-4)' }}
                >
                  <path d="M12 3v4" />
                  <path d="M12 17v4" />
                  <path d="M3 12h4" />
                  <path d="M17 12h4" />
                  <path d="m5.6 5.6 2.8 2.8" />
                  <path d="m15.6 15.6 2.8 2.8" />
                  <path d="m18.4 5.6-2.8 2.8" />
                  <path d="m8.4 15.6-2.8 2.8" />
                </svg>
              )}
              <span style={{ flex: 1 }}>{s.label}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--portal-fg-5)' }}
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
