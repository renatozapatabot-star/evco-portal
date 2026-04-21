'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { ActiveShipmentTimeline, type ActiveShipment } from './ActiveShipmentTimeline'

/**
 * TimelineModal — client-side modal that surfaces the <ActiveShipmentTimeline>
 * for the next-imminent embarque. Invoked from the "Próximo cruce" hero KPI
 * tap so the cockpit layout stays calm (invariant #24 — no 2-col grid
 * reintroduced, no right rail) and the timeline only appears on intent.
 *
 * Behavior:
 *   · Mobile (< 640px): fullscreen
 *   · Desktop: centered max-width card over bg-black/60 + backdrop-blur-sm
 *   · Esc dismisses; backdrop click dismisses; close button dismisses
 *   · Body scroll locked while open
 *   · Focus moves to close button on open; returns to opener on close
 *   · Audit log fires once per open (non-blocking)
 *
 * Parent passes the shipment server-side — the modal does not fetch.
 * Prevents double-round-trip on tap; data is already on the page.
 */

export interface TimelineModalProps {
  open: boolean
  onClose: () => void
  shipment: ActiveShipment | null
  /** Ref of the element that opened the modal — focus returns here on close. */
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

export function TimelineModal({ open, onClose, shipment, returnFocusRef }: TimelineModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Fire audit log once per open. Non-blocking; swallows failures so a
  // telemetry outage can't block UX.
  useEffect(() => {
    if (!open) return
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'timeline_modal_opened',
        path: typeof window !== 'undefined' ? window.location.pathname : '/inicio',
        metadata: { trafico_ref: shipment?.trafico ?? null },
      }),
    }).catch(() => {})
  }, [open, shipment?.trafico])

  // Body scroll lock + Esc dismiss + focus trap.
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus to close button on open
    const focusTimer = window.setTimeout(() => closeBtnRef.current?.focus(), 0)

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        // Rudimentary focus trap — cycle within the dialog
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      // Restore focus to opener once closed
      returnFocusRef?.current?.focus()
    }
  }, [open, onClose, returnFocusRef])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="aguila-timeline-modal"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'rgba(10,10,12,0.96)',
          border: '1px solid rgba(192,197,206,0.18)',
          borderRadius: 20,
          padding: 'clamp(16px, 4vw, 24px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(192,197,206,0.08)',
        }}
      >
        <style jsx>{`
          @media (max-width: 640px) {
            .aguila-timeline-modal {
              max-width: 100% !important;
              height: 100vh !important;
              max-height: 100vh !important;
              border-radius: 0 !important;
              border: none !important;
            }
          }
        `}</style>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <h2
            id="timeline-modal-title"
            style={{
              fontSize: 'var(--aguila-fs-title)',
              fontWeight: 600,
              color: 'var(--portal-fg-1)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Próximo embarque
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 60,
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(192,197,206,0.18)',
              borderRadius: 12,
              cursor: 'pointer',
              color: 'var(--portal-fg-3)',
              flexShrink: 0,
            }}
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <ActiveShipmentTimeline shipment={shipment} />
      </div>
    </div>
  )
}
