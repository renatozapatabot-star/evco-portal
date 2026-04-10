'use client'

import Link from 'next/link'
import { playSound } from '@/lib/sounds'
import { haptic } from '@/hooks/use-haptic'

interface Props {
  /** One sentence: what CRUZ recommends */
  recommendation: string
  /** Confidence 0-100 */
  confidence: number
  /** Primary action label */
  approveLabel?: string
  /** Primary action href or callback */
  approveHref?: string
  onApprove?: () => void
  /** Secondary action */
  reviewLabel?: string
  reviewHref?: string
  /** Show reasoning bullets */
  reasoning?: string[]
  /** Memory badge — shows when applying a learned rule */
  memoryBadge?: string
  /** Compact mode for list rows */
  compact?: boolean
}

export function AduanaRecommendation({
  recommendation, confidence, approveLabel = 'Aprobar', approveHref, onApprove,
  reviewLabel = 'Revisar', reviewHref, reasoning, memoryBadge, compact,
}: Props) {
  const confidenceColor = confidence >= 85 ? '#16A34A' : confidence >= 70 ? '#eab308' : '#D97706'

  const handleApprove = () => {
    playSound('success')
    haptic.confirm()
    onApprove?.()
  }

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 6, marginTop: 6,
        background: 'rgba(201,168,76,0.06)',
        border: '1px solid rgba(201,168,76,0.12)',
      }}>
        <span style={{ fontSize: 11, color: '#eab308', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {recommendation}
        </span>
        <span className="font-mono" style={{ fontSize: 10, color: confidenceColor, flexShrink: 0 }}>
          {confidence}%
        </span>
        {(approveHref || onApprove) && (
          approveHref ? (
            <Link href={approveHref} onClick={handleApprove} style={{
              fontSize: 10, fontWeight: 700, color: '#111', background: '#eab308',
              padding: '3px 10px', borderRadius: 4, textDecoration: 'none', flexShrink: 0,
            }}>
              {approveLabel}
            </Link>
          ) : (
            <button onClick={handleApprove} style={{
              fontSize: 10, fontWeight: 700, color: '#111', background: '#eab308',
              padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', flexShrink: 0,
            }}>
              {approveLabel}
            </button>
          )
        )}
      </div>
    )
  }

  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10, marginTop: 10,
      background: 'rgba(201,168,76,0.06)',
      border: '1px solid rgba(201,168,76,0.15)',
    }}>
      {/* Memory badge */}
      {memoryBadge && (
        <div style={{ fontSize: 10, color: '#eab308', marginBottom: 6, fontWeight: 600 }}>
          🧠 {memoryBadge}
        </div>
      )}

      {/* Recommendation line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: reasoning ? 6 : 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', flex: 1 }}>
          {recommendation}
        </span>
        <span className="font-mono" style={{
          fontSize: 12, fontWeight: 700, color: confidenceColor,
          background: `${confidenceColor}15`, padding: '2px 8px', borderRadius: 4,
          flexShrink: 0,
        }}>
          {confidence}%
        </span>
      </div>

      {/* Reasoning bullets */}
      {reasoning && reasoning.length > 0 && (
        <div style={{ marginBottom: 8, paddingLeft: 8 }}>
          {reasoning.map((r, i) => (
            <div key={i} style={{ fontSize: 11, color: '#8B949E', lineHeight: 1.5 }}>
              · {r}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(approveHref || onApprove) && (
          approveHref ? (
            <Link href={approveHref} onClick={handleApprove} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 16px', borderRadius: 8, minHeight: 44,
              background: '#eab308', color: '#111', fontSize: 13, fontWeight: 700,
              textDecoration: 'none',
            }}>
              {approveLabel} →
            </Link>
          ) : (
            <button onClick={handleApprove} style={{
              flex: 1, padding: '10px 16px', borderRadius: 8, minHeight: 44,
              background: '#eab308', color: '#111', fontSize: 13, fontWeight: 700,
              border: 'none', cursor: 'pointer',
            }}>
              {approveLabel} →
            </button>
          )
        )}
        {reviewHref && (
          <Link href={reviewHref} style={{
            padding: '10px 16px', borderRadius: 8, minHeight: 44,
            background: 'rgba(255,255,255,0.06)', color: '#8B949E',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {reviewLabel}
          </Link>
        )}
      </div>
    </div>
  )
}
