'use client'

import { useEffect, useState } from 'react'

interface BridgeData {
  name: string; nameEs: string; commercial: number | null; status: string
}

interface IntelItem {
  id: string; title: string; severity: string; body: string
}

interface SyncSource {
  source: string; healthy: boolean; minutesAgo: number | null
}

export function RightRail() {
  const [bridges, setBridges] = useState<BridgeData[]>([])
  const [intel, setIntel] = useState<IntelItem[]>([])
  const [sync, setSync] = useState<{ sources: SyncSource[]; allHealthy: boolean }>({ sources: [], allHealthy: true })

  useEffect(() => {
    // Fetch external APIs client-side (they hit external services)
    Promise.allSettled([
      fetch('/api/bridge-times').then(r => r.json()),
      fetch('/api/intelligence-feed?limit=5').then(r => r.json()),
      fetch('/api/sync-status').then(r => r.json()),
    ]).then(results => {
      if (results[0].status === 'fulfilled') {
        const data = results[0].value
        setBridges((data.bridges || []).map((b: Record<string, unknown>) => ({
          name: b.name as string,
          nameEs: b.nameEs as string || b.name as string,
          commercial: b.commercial as number | null,
          status: b.status as string || 'unknown',
        })))
      }
      if (results[1].status === 'fulfilled') {
        const items = Array.isArray(results[1].value) ? results[1].value : []
        setIntel(items.slice(0, 3).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          title: item.title as string,
          severity: item.severity as string,
          body: item.body as string || '',
        })))
      }
      if (results[2].status === 'fulfilled') {
        const data = results[2].value
        setSync({
          sources: (data.sources || []).map((s: Record<string, unknown>) => ({
            source: s.source as string,
            healthy: s.healthy as boolean,
            minutesAgo: s.minutesAgo as number | null,
          })),
          allHealthy: data.allHealthy as boolean ?? true,
        })
      }
    })
  }, [])

  const statusDot = (s: string) => {
    const colors: Record<string, string> = {
      green: 'var(--portal-status-green-fg)', amber: 'var(--portal-status-amber-fg)', red: 'var(--portal-status-red-fg)', unknown: 'var(--portal-fg-5)',
    }
    return colors[s] || colors.unknown
  }

  const severityColor = (s: string) => {
    const colors: Record<string, string> = {
      critical: 'var(--portal-status-red-fg)', warning: 'var(--portal-status-amber-fg)', info: 'var(--portal-fg-4)',
    }
    return colors[s] || colors.info
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {/* FRONTERA */}
      <div style={{
        background: 'rgba(255,255,255,0.045)', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)', padding: 16,
      }}>
        <div style={{
          fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--portal-fg-5)', marginBottom: 12,
        }}>
          Frontera
        </div>
        {bridges.length === 0 ? (
          <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-5)' }}>Cargando puentes...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bridges.filter(b => b.commercial !== null).map(b => (
              <div key={b.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: statusDot(b.status), display: 'inline-block',
                  }} />
                  <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)' }}>{b.nameEs}</span>
                </div>
                <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)' }}>
                  {b.commercial}m
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ALERTAS */}
      <div style={{
        background: 'rgba(255,255,255,0.045)', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)', padding: 16,
      }}>
        <div style={{
          fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--portal-fg-5)', marginBottom: 12,
        }}>
          Alertas
        </div>
        {intel.length === 0 ? (
          <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-5)' }}>Sin alertas</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {intel.map(item => (
              <div key={item.id} style={{
                fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-1)',
                paddingLeft: 12,
                borderLeft: `2px solid ${severityColor(item.severity)}`,
              }}>
                {item.title}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SISTEMA */}
      <div style={{
        background: 'rgba(255,255,255,0.045)', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)', padding: 16,
      }}>
        <div style={{
          fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--portal-fg-5)', marginBottom: 12,
        }}>
          Sistema
        </div>
        {sync.sources.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['PM2', 'Supabase', 'Vercel', 'Sync'].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--portal-fg-5)', display: 'inline-block',
                }} />
                <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)' }}>{s}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sync.sources.map(s => (
              <div key={s.source} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: s.healthy ? 'var(--portal-status-green-fg)' : 'var(--portal-status-red-fg)',
                    display: 'inline-block',
                  }} />
                  <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-1)' }}>{s.source}</span>
                </div>
                {s.minutesAgo !== null && (
                  <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)' }}>
                    {s.minutesAgo}m
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
