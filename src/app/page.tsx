'use client'

import { useEffect, useState, useMemo } from 'react'
import { CheckCircle, X } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import ClientInicioView from '@/components/views/client-inicio-view'
import { Celebrate } from '@/components/celebrate'
import { fmtId } from '@/lib/format-utils'
import { getSmartGreeting } from '@/lib/greeting'
import { dashboardStory } from '@/lib/data-stories'
import { anticipate, isDismissed, dismissSuggestion } from '@/lib/anticipate'
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
   VIEW 2 — BROKER (Renato Jr): Self-writing action queue
   ═══════════════════════════════════════════════════════════ */
interface ActionItem {
  id: string
  type: 'urgent' | 'draft' | 'today' | 'new' | 'bridge'
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
    const draftParams = new URLSearchParams({
      table: 'drafts', limit: '50',
    })
    Promise.all([
      fetch(`/api/data?${trafParams}`).then(r => r.json()),
      fetch('/api/data?table=trafico_completeness&limit=5000').then(r => r.json()),
      fetch(`/api/data?${entParams}`).then(r => r.json()),
      fetch('/api/bridge-times').then(r => r.json()),
      fetch(`/api/data?${pipeParams}`).then(r => r.json()),
      fetch(`/api/data?${draftParams}`).then(r => r.json()),
    ]).then(([trafData, compData, entData, bridgeData, pipeData, draftData]) => {
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
      const pipeRows = (pipeData.data ?? []) as { pipeline_stage: string }[]
      setReadyToFile(pipeRows.filter(r =>
        (r.pipeline_stage || '').toLowerCase().replace(/\s+/g, '_') === 'ready_to_file'
      ).length)

      // Blocking tráficos → URGENT items
      const compMap: Record<string, number> = {}
      for (const row of (compData.data ?? []) as { trafico_id: string; blocking_count: number }[]) {
        if (row.blocking_count > 0) compMap[row.trafico_id] = row.blocking_count
      }

      const queue: ActionItem[] = []

      for (const t of active) {
        const bc = compMap[t.trafico] ?? 0
        const isRojo = t.semaforo === 1
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

      // Drafts pending review → DRAFT items
      const drafts = (draftData.data ?? []) as { id: string; status: string; trafico_id: string | null }[]
      const pendingDrafts = drafts.filter(d => d.status === 'ready_for_review' || d.status === 'ready')
      if (pendingDrafts.length > 0) {
        queue.push({
          id: 'pending-drafts',
          type: 'draft',
          icon: '\u270F\uFE0F',
          label: `${pendingDrafts.length} borrador${pendingDrafts.length !== 1 ? 'es' : ''} listo${pendingDrafts.length !== 1 ? 's' : ''}`,
          detail: 'Pendientes de revisión',
          href: '/drafts',
        })
      }

      // Ready to file → action item (not just KPI)
      const rtfCount = pipeRows.filter(r =>
        (r.pipeline_stage || '').toLowerCase().replace(/\s+/g, '_') === 'ready_to_file'
      ).length
      if (rtfCount > 0) {
        queue.push({
          id: 'ready-to-file',
          type: 'today',
          icon: '\uD83D\uDE80',
          label: `${rtfCount} listo${rtfCount !== 1 ? 's' : ''} para despacho`,
          detail: 'Tráficos completos — listos para cruzar',
          href: '/traficos?pipeline_stage=ready_to_file',
        })
      }

      // Unassigned entradas → TODAY items
      const unassigned = recentEntradas.filter(e => !(e as Record<string, unknown>).trafico)
      if (unassigned.length > 0) {
        queue.push({
          id: 'unassigned-entradas',
          type: 'today',
          icon: '\uD83D\uDCE8',
          label: `${unassigned.length} entrada${unassigned.length !== 1 ? 's' : ''} sin asignar`,
          detail: 'Sin tráfico vinculado',
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

      // Sort: urgent → draft → today → new → bridge, max 10
      const typeOrder: Record<string, number> = { urgent: 0, draft: 1, today: 2, new: 3, bridge: 4 }
      queue.sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
      setItems(queue.slice(0, 10))
    }).catch((err: unknown) => console.error('[inicio] attention feed:', (err as Error).message)).finally(() => setLoading(false))
  }, [])

  // ── Narrative story ──
  const narrative = useMemo(() => {
    if (loading) return ''
    return dashboardStory({
      enProceso: activeCount,
      cruzado: cruzadosHoy,
      tiempoDespacho: 0,
      tmecSavings: 0,
      tmecOps: 0,
      totalOps: activeCount + cruzadosHoy,
      provActivos: 0,
      valorYTD: 0,
      sinIncidencia: 0,
    })
  }, [loading, activeCount, cruzadosHoy])

  // ── Anticipation engine ──
  const [suggestion, setSuggestion] = useState<{ id: string; icon: string; text: string; action?: { label: string; href: string } } | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  useEffect(() => {
    if (loading) return
    const now = new Date()
    const hour = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }), 10)
    const dayStr = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Chicago', weekday: 'short' }).format(now)
    const dayMap: Record<string, number> = { dom: 0, lun: 1, mar: 2, mié: 3, jue: 4, vie: 5, sáb: 6 }
    const lastVisit = typeof window !== 'undefined' ? localStorage.getItem('cruz-last-visit') : null

    // Build traficos array from items for anticipation — broker doesn't have full traficos here
    // so we pass a minimal representation
    const s = anticipate({
      traficos: [],
      tmecSavings: 0,
      dayOfWeek: dayMap[dayStr] ?? now.getDay(),
      hour,
      lastVisit,
    })

    if (s && !isDismissed(s.id)) {
      setSuggestion(s)
    }
  }, [loading])

  if (loading) {
    return (
      <div className="page-shell" style={{ maxWidth: 720 }}>
        <div className="skeleton-shimmer" style={{ height: 28, width: 280, marginBottom: 32 }} />
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 72, marginBottom: 12 }} />
        ))}
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ maxWidth: 720 }}>

      {/* Narrative insight */}
      {narrative && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6,
          marginBottom: 16,
        }}>
          {narrative}
        </div>
      )}

      {/* Anticipation suggestion */}
      {suggestion && !suggestionDismissed && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderLeft: '3px solid var(--gold)',
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{suggestion.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{suggestion.text}</div>
            {suggestion.action && (
              <Link href={suggestion.action.href} style={{ fontSize: 13, color: 'var(--gold-dark, #8B6914)', fontWeight: 600, textDecoration: 'none' }}>
                {suggestion.action.label} &rarr;
              </Link>
            )}
          </div>
          <button
            onClick={() => { dismissSuggestion(suggestion.id); setSuggestionDismissed(true) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, minHeight: 60, color: 'var(--text-muted)' }}
            aria-label="Descartar"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Action queue */}
      <Celebrate trigger={items.length === 0 && !loading} id="broker-allgreen" />
      {items.length === 0 ? (
        <div className="status-banner allgreen">
          <div className="status-banner-icon">
            <CheckCircle size={32} />
          </div>
          <div>
            <div className="status-banner-text">
              {activeCount === 0 ? 'Día despejado' : 'Todo al corriente'}
            </div>
            <div className="status-banner-sub">
              {cruzadosHoy > 0
                ? `${cruzadosHoy} tráfico${cruzadosHoy !== 1 ? 's' : ''} cruzado${cruzadosHoy !== 1 ? 's' : ''} hoy`
                : activeCount > 0
                  ? `${activeCount} tráficos en curso — sin acciones pendientes`
                  : 'Sin pendientes · Buen día'
              }
            </div>
            {activeCount === 0 && (
              <Link href="/traficos" style={{ display: 'inline-flex', alignItems: 'center', marginTop: 8, fontSize: 13, fontWeight: 600, color: 'var(--gold-dark, #8B6914)', textDecoration: 'none', minHeight: 60, padding: '8px 0' }}>
                Ver todos los tráficos →
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="broker-queue">
          {items.map(item => {
            const borderColor = item.type === 'urgent' ? 'var(--danger-500)' : item.type === 'draft' ? 'var(--warning)' : item.type === 'today' ? 'var(--gold)' : item.type === 'new' ? 'var(--gold)' : 'var(--slate-400)'
            return (
              <Link key={item.id} href={item.href} className="broker-action-item" style={{ borderLeftColor: borderColor }}>
                <span className="broker-action-icon">{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="broker-action-label">{item.label}</div>
                  <div className="broker-action-detail">{item.detail}</div>
                </div>
                <span className="broker-action-arrow">→</span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Stat cards */}
      <div className="kpi-grid" style={{ marginTop: 32 }}>
        {[
          { href: '/traficos?estatus=En Proceso', value: activeCount, label: 'En proceso', color: 'var(--info-500)', dim: false },
          { href: '/traficos?estatus=Cruzado', value: cruzadosHoy, label: 'Cruzados hoy', color: 'var(--success-500)', dim: cruzadosHoy === 0 && items.length > 0 },
          { href: '/traficos?pipeline_stage=ready_to_file', value: readyToFile, label: 'Listos despacho', color: 'var(--purple-500)', dim: false },
        ].map(kpi => (
          <Link key={kpi.label} href={kpi.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className={`kpi-card${items.length === 0 ? ' allgreen' : ''}`} style={{ borderTop: `3px solid ${kpi.color}`, textAlign: 'center' }}>
              <div className="kpi-card-value" style={{ color: kpi.dim ? 'var(--slate-300)' : undefined }}>{kpi.value}</div>
              <div className="kpi-card-label">{kpi.label}</div>
            </div>
          </Link>
        ))}
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
