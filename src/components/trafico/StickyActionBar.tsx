'use client'

import { useEffect, useState, useRef } from 'react'

interface StickyActionBarProps {
  traficoNumber: string
  status: string
  valueUSD: string | null
  hasMissingDocs: boolean
  onSolicitar?: () => void
}

/**
 * v2 Sticky Action Bar — appears after 200px scroll.
 * Navy background, uses enter motion token.
 * Implemented with IntersectionObserver on a sentinel div (no scroll listeners).
 */
export function StickyActionBar({
  traficoNumber,
  status,
  valueUSD,
  hasMissingDocs,
  onSolicitar,
}: StickyActionBarProps) {
  const [visible, setVisible] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When sentinel is NOT intersecting (scrolled past), show the bar
        setVisible(!entry.isIntersecting)
      },
      { threshold: 0 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const isCruzado = status.toLowerCase().includes('cruz')
  const badgeClass = isCruzado ? 'badge-cruzado' : 'badge-proceso'
  const badgeLabel = isCruzado ? 'Cruzado' : 'En Proceso'

  return (
    <>
      {/* Sentinel div — placed at approximately 200px from top */}
      <div ref={sentinelRef} style={{ height: 1, width: '100%' }} />

      {/* Sticky bar */}
      {visible && (
        <div
          className="sticky-enter"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'var(--navy-900)',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{
              fontSize: 15, fontWeight: 600, color: '#FFFFFF',
              fontFamily: 'var(--font-mono)',
            }}>
              {traficoNumber}
            </span>
            <span className={`badge ${badgeClass}`}>
              <span className="badge-dot" />{badgeLabel}
            </span>
            {valueUSD && (
              <span style={{
                fontSize: 14, color: '#FFFFFF',
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {valueUSD}
              </span>
            )}
          </div>
          {hasMissingDocs && onSolicitar && (
            <button
              onClick={onSolicitar}
              style={{
                background: 'var(--gold-400)',
                color: 'var(--navy-900)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Solicitar documentos →
            </button>
          )}
        </div>
      )}
    </>
  )
}
