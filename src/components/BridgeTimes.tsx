'use client'

import { useEffect, useState } from 'react'

type Bridge = { id: number; name: string; nameEs: string; commercial: number | null; passenger: number | null; status: string; updated: string | null }

export function BridgeTimes() {
  const [data, setData] = useState<{ bridges: Bridge[]; recommended: number | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/bridge-times')
        setData(await res.json())
      } catch {}
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 15 * 60 * 1000) // Refresh every 15 min
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Cargando tiempos de puentes...</div>

  const bridges = data?.bridges || []
  const recommended = data?.recommended

  function statusColor(s: string) { return s === 'green' ? '#16A34A' : s === 'amber' ? '#D97706' : s === 'red' ? '#DC2626' : '#6B7280' }
  function statusBg(s: string) { return s === 'green' ? '#DCFCE7' : s === 'amber' ? '#FEF3C7' : s === 'red' ? '#FEE2E2' : '#F3F4F6' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          🌉 Tiempos de Puentes — Laredo
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          Auto-refresh 15 min
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {bridges.map(b => (
          <div key={b.id} style={{
            background: 'var(--bg-surface)', border: `1px solid var(--border)`,
            borderLeft: `4px solid ${statusColor(b.status)}`,
            borderRadius: 8, padding: '12px 14px', position: 'relative',
          }}>
            {recommended === b.id && (
              <span style={{ position: 'absolute', top: 8, right: 8, background: '#DCFCE7', color: '#166534',
                borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 700 }}>RECOMENDADO</span>
            )}
            <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{b.nameEs}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 8 }}>{b.name}</div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Comercial</div>
                <div style={{ color: statusColor(b.status), fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                  {b.commercial !== null ? `${b.commercial} min` : '—'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pasajero</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                  {b.passenger !== null ? `${b.passenger} min` : '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(b.status),
                ...(b.status === 'red' ? { animation: 'pulse 1.5s infinite' } : {}) }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {b.status === 'green' ? 'Flujo normal' : b.status === 'amber' ? 'Demora moderada' : b.status === 'red' ? 'Congestión alta' : 'Sin datos'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
