'use client'

/**
 * AguilaModal — canvas-darkening overlay + glass panel.
 *
 * Deferred from Phase 0.7 because no consumer needed it until Phase 5
 * (/cliente/reportar-problema + /admin/onboard). Now shipped.
 *
 * Features:
 *   - Backdrop: rgba(0,0,0,0.6) + blur(12px), closes on click unless
 *     disableBackdropClose
 *   - Panel: <GlassCard tier="hero" padding={padding}> with max-width
 *   - Focus-trap: first focusable element auto-focuses on open; Tab +
 *     Shift+Tab cycle within the modal; Esc closes
 *   - Motion: fade+lift entrance 220ms, respects prefers-reduced-motion
 *   - Scroll lock: body overflow hidden while open (restores on close)
 *   - Labelled: aria-modal, aria-labelledby from optional title prop
 *
 * Usage:
 *   <AguilaModal
 *     open={isOpen}
 *     onClose={() => setOpen(false)}
 *     title="Asignar embarque"
 *     actions={<><AguilaButton onClick={onCancel}>Cancelar</AguilaButton>
 *              <AguilaButton onClick={onConfirm} variant="primary">Asignar</AguilaButton></>}
 *   >
 *     <AguilaInput label="Trafico" value={trafico} onChange={...} />
 *   </AguilaModal>
 */

import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { GlassCard } from './GlassCard'

export interface AguilaModalProps {
  /** Controls visibility. When false, modal is unmounted. */
  open: boolean
  /** Fires on Esc, backdrop click, or close-button press. */
  onClose: () => void
  /** Title rendered in the header. Wires aria-labelledby automatically. */
  title?: ReactNode
  /** Optional subtitle under the title. */
  subtitle?: ReactNode
  /** Bottom-row action buttons (flex-end justified). */
  actions?: ReactNode
  /** Disable closing on backdrop click (e.g. during a submit). */
  disableBackdropClose?: boolean
  /** Disable closing on Esc. */
  disableEscapeClose?: boolean
  /** Panel max-width. Defaults to 560px. */
  maxWidth?: number | string
  /** Panel padding. Defaults to 28px. */
  padding?: number | string
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function AguilaModal({
  open,
  onClose,
  title,
  subtitle,
  actions,
  disableBackdropClose = false,
  disableEscapeClose = false,
  maxWidth = 560,
  padding = 28,
  children,
}: AguilaModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const titleId = useRef(`aguila-modal-title-${Math.random().toString(36).slice(2, 9)}`)

  // Focus management — capture the element that had focus before the
  // modal opened, restore it on close, and focus the first focusable
  // element inside the panel on open.
  useEffect(() => {
    if (!open) return
    previousActiveElement.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    if (!panel) return
    const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    const first = focusable[0]
    if (first) first.focus()
    return () => {
      previousActiveElement.current?.focus?.()
    }
  }, [open])

  // Scroll lock on body while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape' && !disableEscapeClose) {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      // Focus trap — cycle within the panel.
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [disableEscapeClose, onClose],
  )

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (disableBackdropClose) return
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'portalFadeUp var(--portal-dur-2, 220ms) var(--portal-ease-out, ease) both',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId.current : undefined}
        style={{ width: '100%', maxWidth, maxHeight: 'calc(100vh - 32px)', overflow: 'auto' }}
      >
        <GlassCard tier="hero" padding={padding}>
          {title ? (
            <header style={{ marginBottom: subtitle ? 4 : 20 }}>
              <h2
                id={titleId.current}
                style={{
                  fontSize: 'var(--aguila-fs-title, 20px)',
                  fontWeight: 700,
                  letterSpacing: 'var(--aguila-ls-tight, -0.01em)',
                  margin: 0,
                  color: 'var(--portal-fg-1)',
                }}
              >
                {title}
              </h2>
              {subtitle ? (
                <p
                  style={{
                    fontSize: 'var(--aguila-fs-body, 13px)',
                    color: 'var(--portal-fg-4)',
                    margin: '6px 0 0',
                  }}
                >
                  {subtitle}
                </p>
              ) : null}
            </header>
          ) : null}
          {(title || subtitle) && !actions ? (
            <div style={{ marginTop: 16 }}>{children}</div>
          ) : (
            <div style={{ marginTop: title || subtitle ? 16 : 0 }}>{children}</div>
          )}
          {actions ? (
            <footer
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 10,
                marginTop: 24,
                flexWrap: 'wrap',
              }}
            >
              {actions}
            </footer>
          ) : null}
        </GlassCard>
      </div>
    </div>
  )
}
