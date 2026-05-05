'use client'

import { useEffect, useState } from 'react'

interface TopbarStatusData {
  exchange: { rate: number; date: string; source: string } | null
  bridge: { name: string; wait_min: number | null; direction: string | null; recorded_at: string | null; stale: boolean } | null
}

/**
 * Two compact monospace cells right of the search bar:
 *   - USD/MXN current Banxico rate (with date in tooltip)
 *   - Lider bridge name + wait minutes, dot color reflects freshness
 *
 * Polls every 5 minutes. Renders nothing when data is unavailable —
 * never an error placeholder; the topbar should never look broken.
 */
export function TopbarStatus() {
  const [data, setData] = useState<TopbarStatusData | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = () => {
      fetch('/api/topbar/status')
        .then(r => r.ok ? r.json() : null)
        .then(payload => {
          if (cancelled || !payload?.data) return
          setData(payload.data as TopbarStatusData)
        })
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, 5 * 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (!data) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginRight: 12,
        fontSize: 11,
        color: 'rgba(255,255,255,0.55)',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        whiteSpace: 'nowrap',
      }}
      className="topbar-status"
    >
      {data.exchange && (
        <span
          title={`Banxico · ${data.exchange.date}`}
          style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}
        >
          <span style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>USD/MXN</span>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
            {data.exchange.rate.toFixed(4)}
          </span>
        </span>
      )}
      {data.bridge && (
        <span
          title={data.bridge.recorded_at ? `Actualizado ${new Date(data.bridge.recorded_at).toLocaleString('es-MX')}` : ''}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span
            aria-hidden
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: data.bridge.stale ? '#FBBF24' : '#22C55E',
              boxShadow: data.bridge.stale ? '0 0 4px rgba(251,191,36,0.6)' : '0 0 4px rgba(34,197,94,0.6)',
            }}
          />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Puente líder</span>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
            {data.bridge.wait_min != null ? `${data.bridge.wait_min} min` : '—'}
          </span>
        </span>
      )}
      <style precedence="default">{`
        @media (max-width: 768px) {
          .topbar-status { display: none !important; }
        }
      `}</style>
    </div>
  )
}
