'use client'

import { useEffect, useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import ClientInicioView from '@/components/views/client-inicio-view'
import { Celebrate } from '@/components/celebrate'
import { getSmartGreeting } from '@/lib/greeting'
import { GodView } from '@/components/god-view/GodView'
import Link from 'next/link'

// ── Design tokens (CRUZ Navy light) ──
const T = {
  card: 'var(--card-bg)',
  border: '#E3E7EE',
  green: 'var(--success-500)',
  amber: 'var(--warning-500, #D97706)',
  red: 'var(--danger-500)',
  gray: '#94A3B8',
  gold: 'var(--gold)',
  text: 'var(--body-text)',
  textSec: '#7A8599',
  r: 8,
} as const

// ── Shared types ──
interface TraficoRow {
  trafico: string; estatus: string; company_id: string | null
  semaforo: number | null; descripcion_mercancia: string | null
  fecha_cruce: string | null; proveedores: string | null
  [k: string]: unknown
}

/* ═══════════════════════════════════════════════════════════
   VIEW 1 — ADMIN (Renato Sr): Single status block
   ═══════════════════════════════════════════════════════════ */
function AdminView() {
  const [loading, setLoading] = useState(true)
  const [activeCount, setActiveCount] = useState(0)
  const [blockingCount, setBlockingCount] = useState(0)
  const [rojoCount, setRojoCount] = useState(0)
  const [firstBlocking, setFirstBlocking] = useState<string | null>(null)

  useEffect(() => {
    // Broker/admin: no company_id filter — see all tráficos (matches /traficos page logic)
    const trafParams = new URLSearchParams({
      table: 'traficos', limit: '5000',
      gte_field: 'fecha_llegada', gte_value: '2024-01-01',
    })
    Promise.all([
      fetch(`/api/data?${trafParams}`).then(r => r.json()),
      fetch('/api/data?table=trafico_completeness&limit=5000').then(r => r.json()),
    ]).then(([trafData, compData]) => {
      const allTraficos: TraficoRow[] = trafData.data ?? []
      const active = allTraficos.filter(t => !(t.estatus || '').toLowerCase().includes('cruz'))
      setActiveCount(active.length)

      const rojo = active.filter(t => t.semaforo === 1)
      setRojoCount(rojo.length)

      const compMap: Record<string, number> = {}
      for (const row of (compData.data ?? []) as { trafico_id: string; blocking_count: number }[]) {
        if (row.blocking_count > 0) compMap[row.trafico_id] = row.blocking_count
      }

      const blocking = active.filter(t => compMap[t.trafico] > 0 || t.semaforo === 1)
      setBlockingCount(blocking.length)
      if (blocking.length > 0) setFirstBlocking(blocking[0].trafico)
    }).catch((err: unknown) => console.error('[inicio] data fetch:', (err as Error).message)).finally(() => setLoading(false))
  }, [])

  const level = rojoCount > 0 || blockingCount >= 4 ? 'red' : blockingCount > 0 ? 'amber' : 'green'
  const dotColor = level === 'red' ? T.red : level === 'amber' ? T.amber : T.green
  const headline = level === 'red' ? 'Acción inmediata' : level === 'amber' ? 'Atención requerida' : 'Todo en orden'
  const enCurso = activeCount - blockingCount

  // Admin greeting
  const [adminGreeting, setAdminGreeting] = useState('')
  useEffect(() => {
    setAdminGreeting(getSmartGreeting('Tito', {
      urgentCount: blockingCount,
      enProcesoCount: activeCount,
      crossed24h: 0, newTraficos24h: 0, noPedGt7: 0,
      pendingEntradas: 0, tmecSavings: 0, avgConfidence: 0,
    }).greeting)
  }, [blockingCount, activeCount])

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-dot" />
      </div>
    )
  }

  return (
    <div className="admin-center">
      <Celebrate trigger={level === 'green' && !loading} id="admin-allgreen" />
      {adminGreeting && (
        <div className="text-display" style={{ marginBottom: 16, textAlign: 'center' }}>{adminGreeting}</div>
      )}
      <div
        className="card admin-status-card"
        style={level === 'green' ? { background: 'linear-gradient(180deg, rgba(22,163,74,0.04) 0%, #FFFFFF 60%)' } : undefined}
      >
        {/* Status dot + headline */}
        <div className="admin-headline">
          {level === 'green' ? (
            <CheckCircle size={24} style={{ color: T.green, flexShrink: 0 }} />
          ) : (
            <span
              className="admin-dot dot-live"
              style={{ background: dotColor }}
            />
          )}
          <span className="text-display">{headline}</span>
        </div>

        {/* Counts */}
        <div className="admin-count-primary">
          <span className="font-mono" style={{ fontWeight: 700 }}>{activeCount}</span> tráficos activos
        </div>
        <div className="admin-count-secondary">
          <span className="font-mono">{enCurso}</span> en curso
          {blockingCount > 0 && (
            <> · <span className="font-mono" style={{ color: dotColor, fontWeight: 700 }}>{blockingCount}</span> atención</>
          )}
        </div>

        {/* Link to first blocking tráfico */}
        {firstBlocking && blockingCount > 0 && (
          <Link
            href={blockingCount === 1 ? `/traficos/${encodeURIComponent(firstBlocking)}` : '/traficos?filter=blocking'}
            className="btn btn-primary"
            style={{ marginTop: 24 }}
          >
            {blockingCount === 1 ? 'Ver el único pendiente →' : `Ver ${blockingCount} pendientes →`}
          </Link>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   VIEW 2 — BROKER (Renato Jr): GOD View — mission control
   ═══════════════════════════════════════════════════════════ */
function BrokerView() {
  return <GodView />
}

/* ═══════════════════════════════════════════════════════════
   ROUTER — pick view by role
   ═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [role, setRole] = useState<string>('client')

  useEffect(() => {
    setRole(getCookieValue('user_role') ?? 'client')
  }, [])

  if (role === 'admin') return <AdminView />
  if (role === 'broker') return <BrokerView />
  return <ClientInicioView />
}
