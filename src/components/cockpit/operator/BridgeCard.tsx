'use client'

import { useEffect, useState } from 'react'
import { IfThenCard } from '../shared/IfThenCard'

interface Bridge { name: string; nameEs: string; commercial: number | null; status: string }

export function BridgeCard() {
  const [bridges, setBridges] = useState<Bridge[]>([])

  useEffect(() => {
    fetch('/api/bridge-times')
      .then(r => r.json())
      .then(res => setBridges((res.bridges || []).filter((b: Bridge) => b.commercial !== null)))
      .catch(() => {})
  }, [])

  const over60 = bridges.filter(b => (b.commercial ?? 0) > 60)
  const over90 = bridges.filter(b => (b.commercial ?? 0) > 90)
  const best = bridges.length > 0 ? bridges.reduce((a, b) => ((a.commercial ?? 999) < (b.commercial ?? 999) ? a : b)) : null

  return (
    <IfThenCard
      id="operator-bridges"
      state={over90.length > 0 ? 'urgent' : over60.length > 0 ? 'active' : 'quiet'}
      title="Puentes"
      activeCondition={over60.length > 0 ? `${over60.length} puente${over60.length !== 1 ? 's' : ''} con más de 60 min` : undefined}
      activeAction="Ver cruces"
      urgentCondition={over90.length > 0 ? `${over90.length} puente${over90.length !== 1 ? 's' : ''} con más de 90 min` : undefined}
      urgentAction="Redirigir carga"
      actionHref="/cruces"
      quietContent={
        bridges.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6E7681' }}>Cargando puentes...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bridges.slice(0, 4).map(b => (
              <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                    background: (b.commercial ?? 0) <= 30 ? '#16A34A' : (b.commercial ?? 0) <= 60 ? '#D97706' : '#DC2626',
                  }} />
                  <span style={{ fontSize: 12, color: '#E6EDF3' }}>{b.nameEs || b.name}</span>
                </div>
                <span className="font-mono" style={{ fontSize: 12, color: '#8B949E' }}>{b.commercial}m</span>
              </div>
            ))}
            {best && (
              <div style={{ fontSize: 11, color: '#eab308', marginTop: 4 }}>
                Recomendado: {best.nameEs || best.name} ({best.commercial}m)
              </div>
            )}
          </div>
        )
      }
    />
  )
}
