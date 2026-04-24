'use client'

import { useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

/**
 * PdfPreviewPane — V1 Clean Visibility inline PDF viewer (2026-04-24).
 *
 * Desktop: slides in as a right-side pane (40% width) anchored to the
 * viewport. Mobile (<768px): renders as a full-screen modal. Both
 * embed the PDF via a native <iframe> — no new dependencies, works
 * cross-browser, leverages the browser's built-in PDF viewer.
 *
 * Close via backdrop click, Escape key, or the explicit close button.
 * Download button links to the same `src` with `download` attribute.
 *
 * Tenant isolation: this is a pure UI component. The caller is
 * responsible for only passing `src` URLs that the session is allowed
 * to access (e.g. /api/expediente-doc?id=... — that endpoint enforces
 * the session.companyId filter).
 */

export interface PdfPreviewPaneProps {
  /** Fully-qualified URL or app-relative path to the PDF. */
  src: string | null
  /** Filename shown in the pane header. */
  filename?: string | null
  /** Optional secondary label (doc_type, uploaded_at, etc.). */
  subtitle?: string | null
  /** Fires when the user requests close (backdrop / Escape / close btn). */
  onClose: () => void
}

export function PdfPreviewPane({ src, filename, subtitle, onClose }: PdfPreviewPaneProps) {
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!src) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // lock body scroll while the pane is open
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [src, onClose])

  if (!src) return null

  const PANE_WIDTH_DESKTOP = 'min(40vw, 560px)'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}
      />

      {/* Pane */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={filename ? `Vista previa: ${filename}` : 'Vista previa del documento'}
        style={{
          position: 'fixed',
          top: isMobile ? 0 : 0,
          right: 0,
          bottom: 0,
          width: isMobile ? '100vw' : PANE_WIDTH_DESKTOP,
          zIndex: 9991,
          background: 'var(--bg-deep, #0A0A0C)',
          borderLeft: isMobile ? 'none' : '1px solid var(--border)',
          boxShadow: isMobile ? 'none' : '-8px 0 32px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          minHeight: 64,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {filename ?? 'Documento'}
            </div>
            {subtitle && (
              <div style={{
                fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)',
                marginTop: 2,
              }}>
                {subtitle}
              </div>
            )}
          </div>
          <a
            href={src}
            download={filename ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 'var(--aguila-fs-body)',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              textDecoration: 'none',
              minHeight: 36,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Descargar
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 36, height: 36, minWidth: 36,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 'var(--aguila-fs-body-lg)',
            }}
          >
            ✕
          </button>
        </div>

        {/* PDF iframe */}
        <iframe
          src={src}
          title={filename ?? 'Documento PDF'}
          style={{
            flex: 1,
            width: '100%',
            border: 'none',
            background: '#FFFFFF',
          }}
        />
      </aside>
    </>
  )
}
