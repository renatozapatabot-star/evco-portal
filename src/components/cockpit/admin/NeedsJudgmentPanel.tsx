'use client'

import Link from 'next/link'
import { fmtRelativeTime } from '../shared/formatters'
import type { AdminData } from '../shared/fetchCockpitData'

interface Props {
  escalations: AdminData['escalations']
}

export function NeedsJudgmentPanel({ escalations }: Props) {
  const overdue = escalations.filter(e => {
    const ageH = (Date.now() - new Date(e.created_at).getTime()) / 3600000
    return ageH > 24
  })

  const urgencyColor = overdue.length > 0
    ? 'rgba(220,38,38,0.7)'
    : escalations.length > 0
      ? 'rgba(217,119,6,0.6)'
      : 'rgba(22,163,74,0.5)'

  return (
    <div style={{
      background: '#222222',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: `3px solid ${urgencyColor}`,
      padding: 16,
    }}>
      <div style={{ marginBottom: 12 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681',
        }}>
          Necesita tu juicio
        </span>
        <span className="font-mono" style={{
          fontSize: 13, color: '#8B949E', marginLeft: 8,
        }}>
          {escalations.length} escalacion{escalations.length !== 1 ? 'es' : ''}
          {overdue.length > 0 && (
            <span style={{ color: '#DC2626' }}> · {overdue.length} vencida{overdue.length !== 1 ? 's' : ''}</span>
          )}
        </span>
      </div>

      {escalations.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
          Sin escalaciones pendientes
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {escalations.slice(0, 5).map(e => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#E6EDF3', marginBottom: 2 }}>
                  {e.description}
                </div>
                <div style={{ fontSize: 11, color: '#6E7681' }}>
                  {e.company} · {fmtRelativeTime(e.created_at)}
                </div>
              </div>
              <Link
                href="/drafts"
                style={{
                  padding: '8px 16px',
                  background: 'rgba(201,168,76,0.15)',
                  color: '#C9A84C',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  flexShrink: 0,
                  minHeight: 36,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                Revisar
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
