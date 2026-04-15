'use client'

/**
 * LauncherTray — slide-in panel listing every ZAPATA AI tool.
 *
 * Triggered by the `+` button in TopNav (or Cmd+J anywhere). Renders as a
 * right-side sheet on desktop, full-screen on mobile. Every tool is a
 * 60×60 icon tile with label + description. Tools the current role can't
 * use are grayed but visible (showcase value). Counts surface as red dot
 * badges on the icon — at-a-glance "you have stuff to do somewhere."
 *
 * Keyboard: Cmd+J / Ctrl+J toggles. Esc closes. Enter activates focused tile.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BORDER_HAIRLINE,
  BG_ELEVATED,
  GLASS_BLUR,
  GLASS_SHADOW,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  RED,
} from '@/lib/design-system'
import { LAUNCHER_TOOLS, type LauncherCounts, type LauncherRole } from '@/lib/launcher-tools'

interface Props {
  open: boolean
  onClose: () => void
  role: LauncherRole
  counts?: LauncherCounts
}

export function LauncherTray({ open, onClose, role, counts = {} }: Props) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Esc + Cmd+J toggles
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Focus first tile when opened
  useEffect(() => {
    if (open) {
      const el = rootRef.current?.querySelector<HTMLElement>('[data-launcher-tile]:not([data-disabled])')
      el?.focus()
    }
  }, [open])

  const tools = useMemo(() => LAUNCHER_TOOLS.map((t) => ({
    ...t,
    enabled: t.roles.includes(role),
    count: counts[t.key as keyof LauncherCounts] ?? null,
  })), [role, counts])

  if (!open) return null

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
          animation: 'launcherFadeIn 140ms ease',
        }}
      />
      <aside
        ref={rootRef}
        role="dialog"
        aria-label="Herramientas ZAPATA AI"
        aria-modal="true"
        className="launcher-tray"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
          width: 'min(440px, 100vw)',
          background: BG_ELEVATED,
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          borderLeft: `1px solid ${BORDER_HAIRLINE}`,
          boxShadow: GLASS_SHADOW,
          display: 'flex', flexDirection: 'column',
          animation: 'launcherSlideIn 180ms cubic-bezier(0.2, 0.9, 0.4, 1)',
        }}
      >
        <header style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${BORDER_HAIRLINE}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: TEXT_MUTED,
            }}>
              ZAPATA AI
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY, marginTop: 2 }}>
              Herramientas
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'transparent',
              border: `1px solid ${BORDER_HAIRLINE}`,
              color: ACCENT_SILVER,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </header>

        <div style={{
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          overflowY: 'auto',
        }}>
          {tools.map((t) => {
            const Icon = t.icon
            const disabled = !t.enabled
            const showDot = t.enabled && typeof t.count === 'number' && t.count > 0
            return (
              <button
                key={t.key}
                type="button"
                data-launcher-tile
                data-disabled={disabled || undefined}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return
                  if (t.action === 'open-search') {
                    onClose()
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
                    return
                  }
                  onClose()
                  router.push(t.href)
                }}
                style={{
                  position: 'relative',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 10,
                  padding: '14px 14px 12px',
                  minHeight: 120,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.025)',
                  border: `1px solid ${BORDER_HAIRLINE}`,
                  color: 'inherit',
                  textAlign: 'left',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                  transition: 'background 120ms ease, border-color 120ms ease, transform 120ms ease',
                }}
                className="launcher-tile"
                title={disabled ? 'No disponible para tu rol' : t.description}
              >
                <span aria-hidden style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${BORDER_HAIRLINE}`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  flexShrink: 0,
                }}>
                  <Icon size={18} color={disabled ? ACCENT_SILVER_DIM : ACCENT_SILVER_BRIGHT} />
                  {showDot && (
                    <span aria-hidden style={{
                      position: 'absolute', top: -3, right: -3,
                      width: 10, height: 10, borderRadius: '50%',
                      background: RED, boxShadow: `0 0 6px ${RED}`,
                    }} className="aguila-dot-pulse" />
                  )}
                </span>
                <div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: disabled ? ACCENT_SILVER_DIM : TEXT_PRIMARY,
                    letterSpacing: '0.005em',
                  }}>
                    {t.label}
                    {showDot ? (
                      <span style={{
                        marginLeft: 6, fontSize: 11,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        color: RED,
                      }}>
                        {t.count}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2, lineHeight: 1.35 }}>
                    {t.description}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <footer style={{
          padding: '12px 20px',
          borderTop: `1px solid ${BORDER_HAIRLINE}`,
          fontSize: 11, color: TEXT_MUTED,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{tools.filter(t => t.enabled).length} disponibles · {tools.filter(t => !t.enabled).length} bloqueadas</span>
          <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Esc cierra · ⌘J abre</span>
        </footer>
      </aside>

      <style jsx global>{`
        @keyframes launcherFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes launcherSlideIn { from { transform: translateX(20px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        .launcher-tile:hover:not(:disabled) {
          background: rgba(255,255,255,0.045) !important;
          border-color: rgba(192,197,206,0.2) !important;
          transform: translateY(-1px);
        }
        @media (max-width: 768px) {
          .launcher-tray {
            width: 100vw !important;
            border-left: none !important;
          }
        }
      `}</style>
    </>
  )
}
