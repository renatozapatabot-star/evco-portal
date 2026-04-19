'use client'

import { useState } from 'react'
import { playSound } from '@/lib/sounds'
import { haptic } from '@/hooks/use-haptic'
import type { SurfaceProposal } from '@/lib/proposals/getProposal'

interface Props {
  proposal: SurfaceProposal | null
  onApprove?: () => Promise<{ ok: boolean } | void>
  onReview?: () => void
}

/**
 * Compact inline recommendation for list rows.
 * One line: [proposal text] [confidence dot] [Aprobar]
 * Designed to make scrolling = reviewing.
 */
export function AduanaRecommendationRow({ proposal, onApprove, onReview }: Props) {
  const [cleared, setCleared] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!proposal || proposal.confidence < 0.5) return null

  if (cleared) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
        background: 'rgba(22,163,74,0.06)', borderRadius: 4, marginTop: 4,
      }}>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-status-green-fg)' }}>✓ Aprobado</span>
      </div>
    )
  }

  const dotColor = proposal.confidence >= 0.90 ? 'var(--portal-status-green-fg)'
    : proposal.confidence >= 0.75 ? 'var(--portal-fg-1)'
    : 'var(--portal-status-amber-fg)'

  const handleApprove = async () => {
    if (loading) return
    setLoading(true)
    try {
      const result = await onApprove?.()
      if (!result || (result as { ok: boolean }).ok !== false) {
        playSound('success')
        haptic.confirm()
        setCleared(true)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
      background: 'rgba(192,197,206,0.04)', borderRadius: 4, marginTop: 4,
      flexWrap: 'wrap',
    }}>
      {/* Confidence dot */}
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dotColor, flexShrink: 0,
      }} />

      {/* Proposal text */}
      <span style={{
        fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-1)', flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {proposal.proposal_label_es}
      </span>

      {/* Approve button */}
      {onApprove && (
        <button
          onClick={handleApprove}
          disabled={loading}
          style={{
            fontSize: 'var(--aguila-fs-label)', fontWeight: 700, color: '#111',
            background: 'var(--portal-fg-1)', border: 'none',
            padding: '4px 12px', borderRadius: 4,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
            flexShrink: 0, minHeight: 24,
          }}
        >
          {loading ? '...' : 'Aprobar'}
        </button>
      )}

      {/* Review button */}
      {onReview && (
        <button
          onClick={onReview}
          style={{
            fontSize: 'var(--aguila-fs-label)', fontWeight: 600, color: 'var(--portal-fg-4)',
            background: 'none', border: '1px solid rgba(255,255,255,0.08)',
            padding: '4px 10px', borderRadius: 4,
            cursor: 'pointer', flexShrink: 0, minHeight: 24,
          }}
        >
          Ver
        </button>
      )}
    </div>
  )
}
