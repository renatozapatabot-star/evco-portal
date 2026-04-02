'use client'

import { useEffect, useState, useMemo } from 'react'
import { CheckCircle } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import ClientInicioView from '@/components/views/client-inicio-view'
import { fmtId, fmtDate } from '@/lib/format-utils'
import Link from 'next/link'

// ── Design tokens (CRUZ Navy light) ──
const T = {
  card: 'var(--card-bg)',
  border: '#E3E7EE',
  green: 'var(--success-500)',
  amber: '#D97706',
  red: 'var(--danger-500)',
  gray: '#94A3B8',
  gold: '#D4A843',
  text: 'var(--body-text)',
  textSec: '#7A8599',
  r: 8,
} as const

// ── Shared types ──
interface TraficoRow {
  trafico: string; estatus: string; company_id: string | null
  semaforo: string | null; descripcion_mercancia: string | null
  fecha_cruce: string | null; proveedores: string | null
  [k: string]: unknown
}
interface BridgeTime {
  id: number; name: string; nameEs: string
  commercial: number | null; status: string; updated: string | null
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

      const rojo = active.filter(t => t.semaforo === 'rojo')
      setRojoCount(rojo.length)

      const compMap: Record<string, number> = {}
      for (const row of (compData.data ?? []) as { trafico_id: string; blocking_count: number }[]) {
        if (row.blocking_count > 0) compMap[row.trafico_id] = row.blocking_count
      }

      const blocking = active.filter(t => compMap[t.trafico] > 0 || t.semaforo === 'rojo')
      setBlockingCount(blocking.length)
      if (blocking.length > 0) setFirstBlocking(blocking[0].trafico)
    }).catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) }).finally(() => setLoading(false))
  }, [])

  const level = rojoCount > 0 || blockingCount >= 4 ? 'red' : blockingCount > 0 ? 'amber' : 'green'
  const dotColor = level === 'red' ? T.red : level === 'amber' ? T.amber : T.green
  const headline = level === 'red' ? 'Acción inmediata' : level === 'amber' ? 'Atención requerida' : 'Todo en orden'
  const enCurso = activeCount - blockingCount

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: T.gray, animation: 'cruzPulse 1.5s infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 32 }}>
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: '48px 56px',
        textAlign: 'center', maxWidth: 440, width: '100%',
      }}>
        {/* Status dot + headline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%', background: dotColor, flexShrink: 0,
            animation: level !== 'green' ? 'cruzPulse 2s infinite' : undefined,
          }} />
          <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--body-text)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>{headline}</span>
        </div>

        {/* Counts */}
        <div style={{ fontSize: 16, color: T.text, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)' }}>{activeCount}</span> tráficos activos
        </div>
        <div style={{ fontSize: 14, color: T.textSec }}>
          <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{enCurso}</span> en curso
          {blockingCount > 0 && (
            <> · <span style={{ color: dotColor, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)' }}>{blockingCount}</span> atención</>
          )}
        </div>

        {/* Link to first blocking tráfico */}
        {firstBlocking && blockingCount > 0 && (
          <Link
            href={blockingCount === 1 ? `/traficos/${encodeURIComponent(firstBlocking)}` : '/traficos?filter=blocking'}
            style={{
              display: 'inline-flex', alignItems: 'center',
              marginTop: 24, padding: '12px 24px',
              background: T.gold, color: '#FFFFFF',
              borderRadius: T.r, fontSize: 14, fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            {blockingCount === 1 ? 'Ver el único pendiente →' : `Ver ${blockingCount} pendientes →`}
          </Link>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   VIEW 2 — BROKER (Renato Jr): Self-writing action queue
   ═══════════════════════════════════════════════════════════ */
interface ActionItem {
  id: string
  type: 'urgent' | 'today' | 'new' | 'bridge'
  icon: string
  label: string
  detail: string
  href: string
}

function BrokerView() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ActionItem[]>([])
  const [activeCount, setActiveCount] = useState(0)
  const [readyToFile, setReadyToFile] = useState(0)
  const [cruzadosHoy, setCruzadosHoy] = useState(0)
  const companyName = typeof document !== 'undefined'
    ? (getCookieValue('company_name') ?? '')
    : ''

  useEffect(() => {
    // Broker/admin: no company_id or trafico_prefix filters — see all tráficos
    const trafParams = new URLSearchParams({
      table: 'traficos', limit: '5000',
      gte_field: 'fecha_llegada', gte_value: '2024-01-01',
    })
    const entParams = new URLSearchParams({
      table: 'entradas', limit: '100',
      order_by: 'fecha_llegada_mercancia', order_dir: 'desc',
    })
    const pipeParams = new URLSearchParams({
      table: 'pipeline_overview', limit: '500',
    })
    Promise.all([
      fetch(`/api/data?${trafParams}`).then(r => r.json()),
      fetch('/api/data?table=trafico_completeness&limit=5000').then(r => r.json()),
      fetch(`/api/data?${entParams}`).then(r => r.json()),
      fetch('/api/bridge-times').then(r => r.json()),
      fetch(`/api/data?${pipeParams}`).then(r => r.json()),
    ]).then(([trafData, compData, entData, bridgeData, pipeData]) => {
      const allTraficos: TraficoRow[] = trafData.data ?? []
      const active = allTraficos.filter(t => !(t.estatus || '').toLowerCase().includes('cruz'))
      setActiveCount(active.length)

      // Cruzados hoy
      const today = new Date().toISOString().split('T')[0]
      const crossed = allTraficos.filter(t =>
        (t.estatus || '').toLowerCase().includes('cruz') && t.fecha_cruce && t.fecha_cruce >= today
      )
      setCruzadosHoy(crossed.length)

      // Ready to file from pipeline
      const pipeRows = (pipeData.data ?? []) as { pipeline_status: string }[]
      setReadyToFile(pipeRows.filter(r =>
        (r.pipeline_status || '').toLowerCase().replace(/\s+/g, '_') === 'ready_to_file'
      ).length)

      // Blocking tráficos → URGENT items
      const compMap: Record<string, number> = {}
      for (const row of (compData.data ?? []) as { trafico_id: string; blocking_count: number }[]) {
        if (row.blocking_count > 0) compMap[row.trafico_id] = row.blocking_count
      }

      const queue: ActionItem[] = []

      for (const t of active) {
        const bc = compMap[t.trafico] ?? 0
        const isRojo = t.semaforo === 'rojo'
        if (bc > 0 || isRojo) {
          const detail = isRojo
            ? 'Semáforo rojo — requiere acción inmediata'
            : `${bc} doc${bc !== 1 ? 's' : ''} faltante${bc !== 1 ? 's' : ''}`
          queue.push({
            id: `u-${t.trafico}`,
            type: 'urgent',
            icon: '\uD83D\uDD34',
            label: `${fmtId(t.trafico)} ${t.company_id ? `${t.company_id.toUpperCase()}` : ''}`,
            detail,
            href: `/traficos/${encodeURIComponent(t.trafico)}`,
          })
        }
      }

      // New entradas (last 24h) → NEW items
      const yesterday = new Date(Date.now() - 86400000).toISOString()
      const recentEntradas = (entData.data ?? []) as { cve_entrada: string; fecha_llegada_mercancia: string | null; cantidad_bultos: number | null; proveedor: string | null }[]
      const newEntradas = recentEntradas.filter(e => e.fecha_llegada_mercancia && e.fecha_llegada_mercancia >= yesterday)
      if (newEntradas.length > 0) {
        const suppliers = [...new Set(newEntradas.map(e => e.proveedor).filter(Boolean))]
        queue.push({
          id: 'new-entradas',
          type: 'new',
          icon: '\uD83D\uDCE5',
          label: `${newEntradas.length} entrada${newEntradas.length !== 1 ? 's' : ''} nueva${newEntradas.length !== 1 ? 's' : ''}`,
          detail: suppliers.length > 0 ? suppliers.slice(0, 2).join(', ') : 'Registradas hoy',
          href: '/bodega',
        })
      }

      // Bridge times > 30 min → BRIDGE items
      const bridges: BridgeTime[] = bridgeData?.bridges ?? []
      const slowBridges = bridges.filter(b => b.commercial !== null && b.commercial! > 30)
      if (slowBridges.length > 0) {
        const worst = slowBridges.reduce((a, b) => (a.commercial! > b.commercial! ? a : b))
        queue.push({
          id: 'bridge-alert',
          type: 'bridge',
          icon: '\uD83C\uDF09',
          label: `${worst.nameEs}: ${worst.commercial} min`,
          detail: slowBridges.length > 1 ? `${slowBridges.length} puentes con espera alta` : 'Espera por encima de 30 min',
          href: '/soia',
        })
      }

      // Sort: urgent → today → new → bridge, max 8
      const typeOrder = { urgent: 0, today: 1, new: 2, bridge: 3 }
      queue.sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
      setItems(queue.slice(0, 8))
    }).catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) }).finally(() => setLoading(false))
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  if (loading) {
    return (
      <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
        <div style={{ height: 28, width: 280, borderRadius: 4, background: '#F0EDE8', marginBottom: 32 }} className="skeleton" />
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 72, borderRadius: 8, background: '#F0EDE8', marginBottom: 12 }} className="skeleton" />
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--body-text)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          {greeting}{companyName ? `, ${companyName.split(' ')[0]}` : ''}
        </div>
        <div style={{ fontSize: 14, color: T.textSec, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)' }}>
          {fmtDate(new Date())}
        </div>
      </div>

      {/* Action queue */}
      {items.length === 0 ? (
        activeCount === 0 ? (
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: T.r, padding: '32px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <CheckCircle size={24} style={{ color: T.green }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: T.green }}>
              Sin pendientes · Buen día
            </span>
          </div>
        ) : (
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.r, padding: '32px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <CheckCircle size={24} style={{ color: T.green }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: T.green }}>
              Todo en orden · {activeCount} tráficos en curso
            </span>
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => {
            const borderLeft = item.type === 'urgent' ? T.red : item.type === 'today' ? T.amber : item.type === 'new' ? T.gold : T.textSec
            return (
              <Link
                key={item.id}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px',
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderLeft: `4px solid ${borderLeft}`,
                  borderRadius: T.r,
                  textDecoration: 'none', color: 'inherit',
                  minHeight: 60,
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>{item.detail}</div>
                </div>
                <span style={{ fontSize: 14, color: T.gold, fontWeight: 600, flexShrink: 0 }}>→</span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Stat cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        marginTop: 32,
      }}>
        <Link href="/traficos?estatus=En Proceso" style={{
          textDecoration: 'none', color: 'inherit',
          background: 'var(--card-bg)', border: '1px solid #E3E7EE',
          borderTop: '3px solid var(--info-500)',
          borderRadius: T.r, padding: '20px 16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)', color: T.text }}>{activeCount}</span>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7A8599', marginTop: 4, fontFamily: "'DM Sans', system-ui, sans-serif" }}>En proceso</span>
        </Link>
        <Link href="/traficos?estatus=Cruzado" style={{
          textDecoration: 'none', color: 'inherit',
          background: 'var(--card-bg)', border: '1px solid #E3E7EE',
          borderTop: '3px solid var(--success-500)',
          borderRadius: T.r, padding: '20px 16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)', color: cruzadosHoy > 0 ? T.text : T.gray }}>{cruzadosHoy}</span>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7A8599', marginTop: 4, fontFamily: "'DM Sans', system-ui, sans-serif" }}>Cruzados hoy</span>
        </Link>
        <Link href="/traficos?pipeline_status=ready_to_file" style={{
          textDecoration: 'none', color: 'inherit',
          background: 'var(--card-bg)', border: '1px solid #E3E7EE',
          borderTop: '3px solid var(--purple-500)',
          borderRadius: T.r, padding: '20px 16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)', color: T.text }}>{readyToFile}</span>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7A8599', marginTop: 4, fontFamily: "'DM Sans', system-ui, sans-serif" }}>Listos despacho</span>
        </Link>
      </div>
    </div>
  )
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
