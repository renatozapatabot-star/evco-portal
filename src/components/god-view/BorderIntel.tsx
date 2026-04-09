'use client'

import Link from 'next/link'
import type { BridgeTime, IntelFeedItem } from '@/hooks/use-god-view-data'

interface Props {
  bridges: BridgeTime[]
  recommendedBridge: number | null
  intelFeed: IntelFeedItem[]
  error?: string
}

function bridgeColor(minutes: number | null): string {
  if (minutes === null) return 'var(--text-muted)'
  if (minutes < 30) return 'var(--success-500, #16A34A)'
  if (minutes < 60) return 'var(--warning-500, #D97706)'
  return 'var(--danger-500, #DC2626)'
}

function severityColor(severity: string): string {
  if (severity === 'critical') return 'var(--danger-500, #DC2626)'
  if (severity === 'warning') return 'var(--warning-500, #D97706)'
  return 'var(--info-500, #3B82F6)'
}

export function BorderIntel({ bridges, recommendedBridge, intelFeed, error }: Props) {
  const commercialBridges = bridges.filter(b => b.commercial !== null)

  return (
    <div className="god-section">
      <div className="god-section-header">
        <h2 className="god-section-title">Frontera</h2>
        <Link href="/cruces" className="god-link">Puentes &rarr;</Link>
      </div>

      {/* Bridges */}
      {commercialBridges.length > 0 ? (
        <div className="god-bridge-list">
          {commercialBridges.map(b => (
            <div
              key={b.id}
              className={`god-bridge-row${b.id === recommendedBridge ? ' god-bridge-row--best' : ''}`}
            >
              <span
                className="god-bridge-dot"
                style={{ background: bridgeColor(b.commercial) }}
              />
              <span className="god-bridge-name">{b.nameEs}</span>
              <span className="god-bridge-time font-mono" style={{ color: bridgeColor(b.commercial) }}>
                {b.commercial} min
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="god-empty">
          {error ? 'Sin datos de puentes' : 'Sin tiempos de espera disponibles'}
        </div>
      )}

      {/* Intel Feed */}
      {intelFeed.length > 0 && (
        <div className="god-intel-feed">
          <div className="god-intel-title">Alertas</div>
          {intelFeed.map(item => (
            <Link
              key={item.id}
              href={item.action_url || '#'}
              className="god-intel-item"
            >
              <span
                className="god-intel-severity"
                style={{ background: severityColor(item.severity) }}
              />
              <div className="god-intel-content">
                <span className="god-intel-item-title">{item.title}</span>
                <span className="god-intel-body">{item.body}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
