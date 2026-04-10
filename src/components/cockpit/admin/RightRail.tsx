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
      green: '#16A34A', amber: '#D97706', red: '#DC2626', unknown: '#6E7681',
    }
    return colors[s] || colors.unknown
  }

  const severityColor = (s: string) => {
    const colors: Record<string, string> = {
      critical: '#DC2626', warning: '#D97706', info: '#8B949E',
    }
    return colors[s] || colors.info
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {/* FRONTERA */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)', padding: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
        }}>
          Frontera
        </div>
        {bridges.length === 0 ? (
          <div style={{ fontSize: 12, color: '#6E7681' }}>Cargando puentes...</div>
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
                  <span style={{ fontSize: 13, color: '#E6EDF3' }}>{b.nameEs}</span>
                </div>
                <span className="font-mono" style={{ fontSize: 13, color: '#8B949E' }}>
                  {b.commercial}m
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ALERTAS */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)', padding: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
        }}>
          Alertas
        </div>
        {intel.length === 0 ? (
          <div style={{ fontSize: 12, color: '#6E7681' }}>Sin alertas</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {intel.map(item => (
              <div key={item.id} style={{
                fontSize: 12, color: '#E6EDF3',
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
        background: 'rgba(255,255,255,0.04)', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)', padding: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
        }}>
          Sistema
        </div>
        {sync.sources.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['PM2', 'Supabase', 'Vercel', 'Sync'].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#6E7681', display: 'inline-block',
                }} />
                <span style={{ fontSize: 12, color: '#8B949E' }}>{s}</span>
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
                    background: s.healthy ? '#16A34A' : '#DC2626',
                    display: 'inline-block',
                  }} />
                  <span style={{ fontSize: 12, color: '#E6EDF3' }}>{s.source}</span>
                </div>
                {s.minutesAgo !== null && (
                  <span className="font-mono" style={{ fontSize: 11, color: '#6E7681' }}>
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
