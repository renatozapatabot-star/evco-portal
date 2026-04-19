'use client'

import { useEffect, useState } from 'react'

interface LeaderEntry { name: string; count: number; rank: number }

const STAKES = [
  'Ganador elige la música de mañana 🎵',
  'Ganador: café por cuenta de Tito ☕',
  'Ganador: 15 minutos extra de comida 🌮',
  'Ganador elige la música de mañana 🎵',
  'Ganador: tacos del viernes por Tito 🌮',
  'Ganador elige la música de mañana 🎵',
  'Ganador: fin de semana tranquilo 😎',
]

const MEDALS = ['👑', '🥈', '🥉']

export function DueloDelDia() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([])
  const dayOfWeek = new Date().getDay()
  const stake = STAKES[dayOfWeek] || STAKES[0]

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      fetch('/api/data?table=operators&limit=20').then(r => r.json()),
      fetch(`/api/data?table=operator_actions&limit=500&gte_field=created_at&gte_value=${today}T00:00:00&order_by=created_at&order_dir=desc`).then(r => r.json()),
    ]).then(([opsRes, actionsRes]) => {
      const opMap: Record<string, string> = {}
      for (const op of opsRes.data || []) {
        if (op.active && op.role !== 'client') opMap[op.id] = op.full_name || 'Operador'
      }

      const counts: Record<string, number> = {}
      for (const a of actionsRes.data || []) {
        const id = a.operator_id as string
        if (id && opMap[id]) counts[id] = (counts[id] || 0) + 1
      }

      const sorted = Object.entries(counts)
        .map(([id, count]) => ({ name: opMap[id]?.split(' ')[0] || '?', count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((e, i) => ({ ...e, rank: i + 1 }))

      setLeaders(sorted)
    }).catch(() => {})
  }, [])

  if (leaders.length === 0) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.045)', borderRadius: 10, padding: '12px 16px',
      border: '1px solid rgba(192,197,206,0.15)', marginBottom: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--portal-fg-1)' }}>
          Duelo del día
        </span>
        <span style={{ fontSize: 'var(--aguila-fs-label)', color: '#6E7681' }}>{stake}</span>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        {leaders.map((l, i) => (
          <div key={l.name} style={{
            flex: 1, textAlign: 'center', padding: '8px 4px',
            background: i === 0 ? 'rgba(192,197,206,0.08)' : 'transparent',
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 'var(--aguila-fs-headline)', marginBottom: 4 }}>{MEDALS[i]}</div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: i === 0 ? 'var(--portal-fg-1)' : 'var(--portal-fg-1)' }}>
              {l.name}
            </div>
            <div className="font-mono" style={{
              fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 800,
              color: i === 0 ? 'var(--portal-fg-1)' : '#8B949E',
            }}>
              {l.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
