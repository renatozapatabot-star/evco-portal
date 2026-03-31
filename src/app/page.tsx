'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { CheckCircle } from 'lucide-react'
import { CLIENT_CLAVE, COMPANY_ID, getCookieValue } from '@/lib/client-config'
import ClientInicioView from '@/components/views/client-inicio-view'
import { daysUntilMVE } from '@/lib/compliance-dates'
import { fmtId, fmtDate } from '@/lib/format-utils'
import { calculateCruzScore, extractScoreInput } from '@/lib/cruz-score'
import { statusDays } from '@/lib/cruz-score'
import { useIsMobile } from '@/hooks/use-mobile'
import { useStatusSentence } from '@/hooks/use-status-sentence'
import CountingNumber from '@/components/ui/CountingNumber'
import Skeleton from '@/components/ui/Skeleton'
import Link from 'next/link'

interface TraficoRow {
  trafico: string; estatus: string; fecha_llegada: string | null
  peso_bruto: number | null; importe_total: number | null
  pedimento: string | null; descripcion_mercancia: string | null
  proveedores: string | null; fecha_cruce: string | null
  fecha_pago: string | null; updated_at?: string
  semaforo: string | null; company_id: string | null
  [k: string]: unknown
}

interface PipelineRow {
  trafico_number: string
  descripcion_mercancia: string | null
  score: number | null
  company_id: string | null
  pipeline_status: string | null
  [k: string]: unknown
}

interface BridgeTime {
  id: number; name: string; nameEs: string
  commercial: number | null; status: string; updated: string | null
}

const fmtUSD = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`

function getIntelligenceHint(action: { description: string }, allTraficos: TraficoRow[]): string | null {
  if (action.description.includes('Sin pedimento')) {
    const resolved = allTraficos.filter(t => t.pedimento && t.fecha_llegada)
    if (resolved.length > 5) {
      const avgDays = Math.round(resolved.reduce((s, t) => {
        const arrived = new Date(t.fecha_llegada!).getTime()
        const now = Date.now()
        return s + ((now - arrived) / 86400000)
      }, 0) / resolved.length)
      return `Promedio de resoluci\u00F3n: ${avgDays} d\u00EDas`
    }
    return 'Solicitar documentos al proveedor acelera el proceso'
  }
  if (action.description.includes('Incidencia') || action.description.includes('dañada') || action.description.includes('Faltantes')) {
    return 'Reportar al almac\u00E9n dentro de 24h para mantener cobertura de seguro'
  }
  if (action.description.includes('Sin movimiento')) {
    return 'Contactar al agente aduanal para actualizaci\u00F3n de estatus'
  }
  if (action.description.includes('seguimiento')) {
    return 'Revisar documentaci\u00F3n faltante para agilizar despacho'
  }
  return null
}

// V6 design tokens
const TOKEN = {
  surfacePrimary: '#FAFAF8',
  surfaceCard: '#FFFFFF',
  border: '#E8E5E0',
  green: '#2D8540',
  amber: '#C47F17',
  red: '#C23B22',
  gray: '#9C9890',
  gold: '#B8953F',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  radiusMd: 8,
} as const

// Section header style (FIX 1 — consistent section separation)
const SECTION_HEADER = {
  fontSize: 20, fontWeight: 800 as const, color: TOKEN.text,
  marginBottom: 16, paddingTop: 8,
  borderTop: `1px solid ${TOKEN.border}`,
}

export default function Dashboard() {
  const isMobile = useIsMobile()
  const statusSentence = useStatusSentence()
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [entradas, setEntradas] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [liveBridges, setLiveBridges] = useState<{ bridges: BridgeTime[]; recommended: number | null; fetched: string | null } | null>(null)
  const [mananaItems, setMananaItems] = useState<{ solicitudes: number; mveUrgent: boolean; mveDays: number }>({ solicitudes: 0, mveUrgent: false, mveDays: 0 })
  const [pendingEntradas, setPendingEntradas] = useState<{ cve_entrada: string; fecha_llegada_mercancia: string | null; cantidad_bultos: number | null; peso_bruto: number | null; tiene_faltantes: boolean; mercancia_danada: boolean }[]>([])
  const [pipelineRows, setPipelineRows] = useState<PipelineRow[]>([])
  const [completeness, setCompleteness] = useState<Record<string, number>>({})
  // Status sentence now lives in StatusStrip (global nav)

  useEffect(() => {
    Promise.all([
      fetch(`/api/data?table=traficos&company_id=${COMPANY_ID}&trafico_prefix=${CLIENT_CLAVE}-&limit=1000&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=entradas&cve_cliente=${CLIENT_CLAVE}&limit=500&order_by=fecha_llegada_mercancia&order_dir=desc`).then(r => r.json()),
    ]).then(([trafData, entData]) => {
      setTraficos(trafData.data ?? [])
      setEntradas(entData.data ?? [])
    }).catch(() => {}).finally(() => setLoading(false))

    // Live bridge times from CBP
    fetch('/api/bridge-times').then(r => r.json()).then(data => {
      setLiveBridges(data)
    }).catch(() => {})

    // Status sentence moved to global StatusStrip component

    // Manana card: solicitudes expiring tomorrow + MVE
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    fetch(`/api/data?table=documento_solicitudes&company_id=${COMPANY_ID}&limit=100&order_by=created_at&order_dir=desc`)
      .then(r => r.json())
      .then(d => {
        const rows = d.data ?? []
        const expTomorrow = rows.filter((r: Record<string, unknown>) =>
          typeof r.deadline === 'string' && r.deadline.startsWith(tomorrowStr) && r.status !== 'completed'
        ).length
        const mveDaysLeft = daysUntilMVE()
        setMananaItems({ solicitudes: expTomorrow, mveUrgent: mveDaysLeft <= 1, mveDays: mveDaysLeft })
      })
      .catch(() => {})

    // Pending entradas without tráfico assigned (real GlobalPC data)
    fetch(`/api/data?table=entradas&company_id=${COMPANY_ID}&trafico=is.null&limit=20&order_by=fecha_llegada_mercancia&order_dir=asc&select=cve_entrada,fecha_llegada_mercancia,cantidad_bultos,peso_bruto,tiene_faltantes,mercancia_danada`)
      .then(r => r.json())
      .then(d => {
        setPendingEntradas((d.data ?? []) as typeof pendingEntradas)
      })
      .catch(() => {})

    // Pipeline overview (broker/admin only — filtered server-side by company_id cookie)
    fetch(`/api/data?table=pipeline_overview&company_id=${COMPANY_ID}&limit=500`)
      .then(r => r.json())
      .then(d => setPipelineRows((d.data ?? []) as PipelineRow[]))
      .catch(() => {})

    // Trafico completeness for La Línea blocking counts
    fetch('/api/data?table=trafico_completeness&limit=1000')
      .then(r => r.json())
      .then(d => {
        const map: Record<string, number> = {}
        for (const row of (d.data ?? []) as { trafico_id: string; blocking_count: number }[]) {
          if (row.blocking_count > 0) map[row.trafico_id] = row.blocking_count
        }
        setCompleteness(map)
      })
      .catch(() => {})
  }, [])

  // ── Computed values ──
  const enProceso = useMemo(() => traficos.filter(t => !(t.estatus || '').toLowerCase().includes('cruz')), [traficos])
  const cruzadosHoy = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return traficos.filter(t =>
      (t.estatus || '').toLowerCase().includes('cruz') && t.fecha_cruce && t.fecha_cruce >= today
    )
  }, [traficos])
  const urgentes = useMemo(() =>
    enProceso.filter(t => t.pedimento && calculateCruzScore(extractScoreInput(t)) < 50)
  , [enProceso])
  const valorEnProceso = useMemo(() =>
    enProceso.reduce((s, t) => s + (Number(t.importe_total) || 0), 0)
  , [enProceso])
  const incidencias = useMemo(() =>
    entradas.filter((e: Record<string, unknown>) => e.mercancia_danada || e.tiene_faltantes)
  , [entradas])


  // ── KPI trend indicators ──
  const [trends, setTrends] = useState<{ enRuta: number | null; cruzados: number | null; valor: number | null }>({ enRuta: null, cruzados: null, valor: null })

  useEffect(() => {
    if (loading) return
    const todayKey = new Date().toISOString().split('T')[0]
    const stored = localStorage.getItem('cruz_kpi_history')
    const history: Record<string, { enRuta: number; cruzados: number; valor: number }> = stored ? JSON.parse(stored) : {}

    // Find most recent entry that is not today
    const dates = Object.keys(history).filter(d => d !== todayKey).sort().reverse()
    if (dates.length > 0) {
      const prev = history[dates[0]]
      setTrends({
        enRuta: enProceso.length - (prev.enRuta ?? enProceso.length),
        cruzados: cruzadosHoy.length - (prev.cruzados ?? cruzadosHoy.length),
        valor: valorEnProceso > 0 && prev.valor > 0 ? Math.round(((valorEnProceso - prev.valor) / prev.valor) * 100) : null,
      })
    }

    // Store today's values
    history[todayKey] = { enRuta: enProceso.length, cruzados: cruzadosHoy.length, valor: valorEnProceso }
    // Keep only last 7 days
    const recent = Object.fromEntries(
      Object.entries(history).sort(([a], [b]) => a.localeCompare(b)).slice(-7)
    )
    localStorage.setItem('cruz_kpi_history', JSON.stringify(recent))
  }, [loading, enProceso.length, cruzadosHoy.length, valorEnProceso])

  // ── Action queue (max 5) ──
  const actions = useMemo(() => {
    const items: { id: string; severity: 'red' | 'amber'; description: string; date: string | null; link: string; action: string; valor: number }[] = []
    urgentes.slice(0, 3).forEach(t => {
      const score = calculateCruzScore(extractScoreInput(t))
      const days = statusDays(t.fecha_llegada ?? null)
      const reason = !t.pedimento
        ? 'Sin pedimento'
        : days > 14
        ? `Sin movimiento desde ${fmtDate(t.fecha_llegada)}`
        : 'Pendiente de seguimiento'
      const actionText = !t.pedimento ? 'Solicitar Docs'
        : !t.fecha_pago ? 'Ver Estado de Pago'
        : 'Ver Detalle'
      items.push({
        id: `u-${t.trafico}`,
        severity: score < 50 ? 'red' : 'amber',
        description: `${fmtId(t.trafico)} — ${reason}`,
        date: t.fecha_llegada,
        link: `/traficos/${encodeURIComponent(t.trafico)}`,
        action: actionText,
        valor: Number(t.importe_total) || 0,
      })
    })
    incidencias.slice(0, 2).forEach((e: Record<string, unknown>) => {
      const daysOld = e.fecha_llegada_mercancia ? Math.floor((Date.now() - new Date(e.fecha_llegada_mercancia as string).getTime()) / 86400000) : 0
      const hasTrafico = Boolean(e.trafico)
      const linkStatus = hasTrafico ? '' : ' · Tráfico no vinculado'
      items.push({
        id: `i-${e.cve_entrada}`,
        severity: 'amber',
        description: `Entrada ${e.cve_entrada} — ${(e.mercancia_danada ? 'Mercancía dañada' : 'Faltantes reportados')}${linkStatus}`,
        date: e.fecha_llegada_mercancia as string | null,
        link: hasTrafico ? `/traficos/${encodeURIComponent(String(e.trafico))}` : `/entradas/${e.cve_entrada}`,
        action: hasTrafico ? 'Ver Tráfico' : daysOld > 14 ? 'Contactar Agente' : 'Ver Incidencia',
        valor: 0,
      })
    })
    return items.slice(0, 5)
  }, [urgentes, incidencias])

  // ── Dismissed actions (localStorage) ──
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    const saved = localStorage.getItem('cruz_dismissed_actions')
    return saved ? new Set(JSON.parse(saved) as string[]) : new Set()
  })
  const [showResueltos, setShowResueltos] = useState(false)

  const dismissAction = (id: string) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    localStorage.setItem('cruz_dismissed_actions', JSON.stringify([...next]))
  }

  const restoreAction = (id: string) => {
    const next = new Set(dismissed)
    next.delete(id)
    setDismissed(next)
    localStorage.setItem('cruz_dismissed_actions', JSON.stringify([...next]))
  }

  // ── Visible vs dismissed actions ──
  const visibleActions = useMemo(() => actions.filter(a => !dismissed.has(a.id)), [actions, dismissed])
  const dismissedActions = useMemo(() => actions.filter(a => dismissed.has(a.id)), [actions, dismissed])

  // Status sentence + data freshness moved to global StatusStrip


  // ── Split actions into critical (red) and warning (amber) ──
  const criticalActions = useMemo(() => visibleActions.filter(a => a.severity === 'red'), [visibleActions])
  const warningActions = useMemo(() => visibleActions.filter(a => a.severity === 'amber'), [visibleActions])

  // ── La Línea: tráficos needing action (blocking docs or semáforo rojo) ──
  const laLineaItems = useMemo(() => {
    const items: { trafico: string; company_id: string | null; blocking_count: number; semaforo: string | null }[] = []
    for (const t of traficos) {
      const bc = completeness[t.trafico] ?? 0
      const sem = t.semaforo
      if (bc > 0 || sem === 'rojo') {
        items.push({ trafico: t.trafico, company_id: t.company_id, blocking_count: bc, semaforo: sem })
      }
    }
    items.sort((a, b) => {
      if (a.semaforo === 'rojo' && b.semaforo !== 'rojo') return -1
      if (b.semaforo === 'rojo' && a.semaforo !== 'rojo') return 1
      return b.blocking_count - a.blocking_count
    })
    return items
  }, [traficos, completeness])

  // ── La Línea auto-refresh every 60s ──
  const refreshLaLinea = useCallback(() => {
    Promise.all([
      fetch(`/api/data?table=traficos&company_id=${COMPANY_ID}&trafico_prefix=${CLIENT_CLAVE}-&limit=1000&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()),
      fetch('/api/data?table=trafico_completeness&limit=1000').then(r => r.json()),
    ]).then(([trafData, compData]) => {
      setTraficos(trafData.data ?? [])
      const map: Record<string, number> = {}
      for (const row of (compData.data ?? []) as { trafico_id: string; blocking_count: number }[]) {
        if (row.blocking_count > 0) map[row.trafico_id] = row.blocking_count
      }
      setCompleteness(map)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const interval = setInterval(refreshLaLinea, 60000)
    return () => clearInterval(interval)
  }, [refreshLaLinea])

  // ── T-MEC count from traficos ──
  const tmecCount = useMemo(() => {
    return traficos.filter(t =>
      (t.descripcion_mercancia || '').toLowerCase().includes('t-mec') ||
      (t.descripcion_mercancia || '').toLowerCase().includes('tmec') ||
      (t.descripcion_mercancia || '').toLowerCase().includes('usmca')
    ).length
  }, [traficos])

  // ── Render a case card (shared between critical and warning feeds) ──
  const renderCaseCard = (a: typeof visibleActions[0], borderColor: string) => {
    const hint = getIntelligenceHint(a, traficos)
    const daysOld = a.date ? Math.floor((Date.now() - new Date(a.date).getTime()) / 86400000) : 0
    return (
      <div key={a.id} style={{
        background: TOKEN.surfaceCard,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: TOKEN.radiusMd,
        padding: isMobile ? '16px' : '20px 24px',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {/* Days stuck — big number */}
          {daysOld > 0 && (
            <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 48 }}>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: borderColor, lineHeight: 1 }}>
                {daysOld}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: TOKEN.gray, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {daysOld === 1 ? 'dia' : 'dias'}
              </div>
            </div>
          )}
          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: TOKEN.text, marginBottom: 4 }}>
              {a.description}
            </div>
            {a.valor > 0 && (
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)', color: TOKEN.text, marginBottom: 4 }}>
                {fmtUSD(a.valor)} <span style={{ fontSize: 11, fontWeight: 600, color: TOKEN.gray }}>USD en riesgo</span>
              </div>
            )}
            <div style={{ fontSize: 12, color: TOKEN.textSecondary, fontFamily: 'var(--font-jetbrains-mono)' }}>
              {fmtDate(a.date)}
            </div>
            {hint && (
              <div style={{ fontSize: 12, color: '#0D9488', marginTop: 6, lineHeight: 1.4, fontWeight: 500 }}>
                {hint}
              </div>
            )}
          </div>
        </div>
        {/* Action buttons row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Link href={a.link} style={{
            fontSize: 13, fontWeight: 700, color: TOKEN.surfaceCard,
            background: a.severity === 'red' ? TOKEN.red : TOKEN.amber,
            padding: '8px 16px', borderRadius: TOKEN.radiusMd,
            textDecoration: 'none', minHeight: 36,
            display: 'inline-flex', alignItems: 'center',
          }}>
            {a.action}
          </Link>
          <Link href={a.link} style={{
            fontSize: 13, fontWeight: 600, color: TOKEN.gold,
            padding: '8px 16px', borderRadius: TOKEN.radiusMd,
            border: `1px solid ${TOKEN.border}`,
            textDecoration: 'none', minHeight: 36,
            display: 'inline-flex', alignItems: 'center',
          }}>
            Ver cronología →
          </Link>
          <button
            onClick={() => dismissAction(a.id)}
            style={{
              fontSize: 13, color: TOKEN.gray, background: 'none',
              border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.radiusMd,
              cursor: 'pointer', padding: '8px 16px', minHeight: 36,
            }}
          >
            Descartar
          </button>
        </div>
      </div>
    )
  }

  // Client role gets a dedicated simplified view
  const userRole = getCookieValue('user_role')
  if (userRole === 'client') return <ClientInicioView />


  // ── Bridge data helpers ──
  const allBridges = liveBridges?.bridges ?? []
  const bridgesWithData = allBridges.filter(b => b.commercial !== null && b.commercial !== undefined)
  const fastestBridge = bridgesWithData.length > 0 ? bridgesWithData.reduce((a, b) => (a.commercial! < b.commercial! ? a : b)) : null
  const bridgeFetchedAt = liveBridges?.fetched

  // ── Pipeline kanban data ──
  const PIPELINE_COLUMNS: { key: string; label: string; color: string; bg: string; borderColor: string }[] = [
    { key: 'needs_docs', label: 'Necesita Docs', color: TOKEN.red, bg: '#FEF2F2', borderColor: '#FECACA' },
    { key: 'in_progress', label: 'En Proceso', color: TOKEN.amber, bg: '#FFFBEB', borderColor: '#FDE68A' },
    { key: 'ready_to_file', label: 'Listo para Despacho', color: TOKEN.gold, bg: '#F5F0E4', borderColor: '#D4C48A' },
    { key: 'ready_to_cross', label: 'Listo para Cruce', color: TOKEN.green, bg: '#F0FDF4', borderColor: '#BBF7D0' },
  ]
  const pipelineGrouped = PIPELINE_COLUMNS.map(col => ({
    ...col,
    items: pipelineRows.filter(r => (r.pipeline_status || '').toLowerCase().replace(/\s+/g, '_') === col.key),
  }))

  /* ═══ FIX 4 — MOBILE BROKER VIEW (5 AM bridge screen) ═══ */
  if (isMobile) {
    return (
      <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
        {/* Bridge strip: 2 pills max */}
        {bridgesWithData.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {bridgesWithData.slice(0, 2).map(b => {
              const w = b.commercial!
              const isFast = fastestBridge && b.id === fastestBridge.id
              const color = w <= 30 ? TOKEN.green : w <= 60 ? TOKEN.amber : TOKEN.red
              return (
                <div key={b.id} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 14px', borderRadius: TOKEN.radiusMd,
                  background: isFast ? '#F0FDF4' : TOKEN.surfaceCard,
                  border: isFast ? '1px solid #BBF7D0' : `1px solid ${TOKEN.border}`,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: TOKEN.textSecondary }}>{b.nameEs}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-jetbrains-mono)', color }}>
                    {w} min
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{
            marginBottom: 16, padding: '12px 16px', borderRadius: TOKEN.radiusMd,
            background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
            fontSize: 14, color: TOKEN.gray, textAlign: 'center',
          }}>
            Datos de puentes actualizándose
          </div>
        )}

        {/* La Línea cards: full width, stacked */}
        {laLineaItems.length === 0 ? (
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: TOKEN.radiusMd, padding: '20px 24px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <CheckCircle size={20} style={{ color: TOKEN.green }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: TOKEN.green }}>
              Sin pendientes críticos
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {laLineaItems.map(item => (
              <div key={item.trafico} style={{
                background: TOKEN.surfaceCard,
                border: `1px solid ${TOKEN.border}`,
                borderLeft: `4px solid ${item.semaforo === 'rojo' ? TOKEN.red : TOKEN.amber}`,
                borderRadius: TOKEN.radiusMd, padding: '16px 20px',
              }}>
                <span style={{
                  fontSize: 18, fontWeight: 800, color: TOKEN.gold,
                  fontFamily: 'var(--font-jetbrains-mono)',
                  display: 'block', marginBottom: 6,
                }}>
                  {fmtId(item.trafico)}
                </span>
                <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.red, marginBottom: 12 }}>
                  {item.semaforo === 'rojo'
                    ? '\uD83D\uDD34 Semáforo Rojo'
                    : `\uD83D\uDEAB ${item.blocking_count} docs faltantes`}
                </div>
                <Link
                  href={`/traficos/${encodeURIComponent(item.trafico)}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: '#1A1A18',
                    background: TOKEN.gold, borderRadius: TOKEN.radiusMd,
                    padding: '14px 20px', textDecoration: 'none',
                    minHeight: 60,
                  }}
                >
                  Ver Tráfico →
                </Link>
              </div>
            ))}
            {laLineaItems.length > 5 && (
              <Link href="/traficos" style={{
                fontSize: 14, fontWeight: 600, color: TOKEN.gold,
                textDecoration: 'none', textAlign: 'center', padding: '12px 0',
              }}>
                Ver todos ({laLineaItems.length}) →
              </Link>
            )}
          </div>
        )}
      </div>
    )
  }

  /* ═══ DESKTOP BROKER VIEW — reordered (FIX 3) ═══ */
  return (
    <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>

      {/* ═══ 1. HERO ═══ */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1A18 0%, #2A2A28 100%)',
        borderRadius: 12, padding: '32px 40px',
        color: '#E8E5DF', marginBottom: 40,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: TOKEN.gray, marginBottom: 8 }}>
          Valor en operación
        </div>
        <div style={{ fontSize: 56, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {loading ? <Skeleton width={200} height={56} borderRadius={8} style={{ background: 'rgba(255,255,255,0.08)' }} /> : valorEnProceso > 0 ? (
            <CountingNumber value={valorEnProceso} duration={1000} format={fmtUSD} style={{ fontFamily: 'var(--font-jetbrains-mono)' }} />
          ) : (
            <span style={{ fontFamily: 'var(--font-jetbrains-mono)', color: TOKEN.gray }}>{'\u2014'}</span>
          )}
          {!loading && valorEnProceso > 0 && <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 4, color: TOKEN.gray }}>USD</span>}
        </div>
        {statusSentence.urgentes > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TOKEN.red, animation: 'cruzPulse 2s infinite' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E8E5DF' }}>
              {statusSentence.urgentes} operación{statusSentence.urgentes !== 1 ? 'es' : ''} requiere{statusSentence.urgentes === 1 ? '' : 'n'} atención
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 32, marginTop: 20, flexWrap: 'wrap' }}>
          <Link href="/traficos?estatus=Detenido" style={{ textDecoration: 'none', color: 'inherit' }}>
            <CountingNumber value={urgentes.length} style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', display: 'block' }} />
            <div style={{ fontSize: 12, color: TOKEN.gray, fontWeight: 600 }}>Detenidos</div>
          </Link>
          <Link href="/traficos?estatus=Demorado" style={{ textDecoration: 'none', color: 'inherit' }}>
            <CountingNumber value={incidencias.length} style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', display: 'block' }} />
            <div style={{ fontSize: 12, color: TOKEN.gray, fontWeight: 600 }}>Demorados</div>
          </Link>
          <Link href="/traficos?estatus=En Proceso" style={{ textDecoration: 'none', color: 'inherit' }}>
            {enProceso.length > 0
              ? <CountingNumber value={enProceso.length} style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', display: 'block' }} />
              : <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', display: 'block', color: TOKEN.gray }}>{'\u2014'}</span>
            }
            <div style={{ fontSize: 12, color: TOKEN.gray, fontWeight: 600 }}>En ruta</div>
          </Link>
          <Link href="/traficos?sort=importe_total&order=desc" style={{ textDecoration: 'none', color: 'inherit' }}>
            <CountingNumber value={cruzadosHoy.length} style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: cruzadosHoy.length > 0 ? TOKEN.green : TOKEN.gray, display: 'block' }} />
            <div style={{ fontSize: 12, color: TOKEN.gray, fontWeight: 600 }}>
              {cruzadosHoy.length > 0 ? 'Cruzados hoy' : (() => {
                const lastCruce = traficos
                  .filter(t => t.fecha_cruce)
                  .sort((a, b) => (b.fecha_cruce ?? '').localeCompare(a.fecha_cruce ?? ''))[0]
                return lastCruce ? `Último: ${fmtDate(lastCruce.fecha_cruce)}` : 'Cruzados hoy'
              })()}
            </div>
          </Link>
        </div>
      </div>

      {/* ═══ 2. MAÑANA + NEXT BEST ACTION ═══ */}
      {(mananaItems.solicitudes > 0 || mananaItems.mveUrgent) && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: TOKEN.radiusMd, padding: '16px 20px', marginBottom: 40,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>&#9728;</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>Mañana</div>
            <div style={{ fontSize: 14, color: '#92400E' }}>
              {mananaItems.solicitudes > 0 && (
                <span>{mananaItems.solicitudes} solicitud{mananaItems.solicitudes !== 1 ? 'es' : ''} vence{mananaItems.solicitudes === 1 ? '' : 'n'} mañana</span>
              )}
              {mananaItems.solicitudes > 0 && mananaItems.mveUrgent && <span> · </span>}
              {mananaItems.mveUrgent && (
                <span style={{ fontWeight: 700 }}>MVE Formato E2 vence en {mananaItems.mveDays <= 0 ? 'hoy' : `${mananaItems.mveDays}d`}</span>
              )}
            </div>
          </div>
        </div>
      )}
      {visibleActions.length > 0 && (
        <Link href={visibleActions[0].link} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', marginBottom: 40,
          background: '#FEF3C7', border: '1px solid #FDE68A',
          borderRadius: TOKEN.radiusMd, textDecoration: 'none', color: '#92400E',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Proxima accion recomendada</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{visibleActions[0].description}</div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: TOKEN.gold, flexShrink: 0 }}>{visibleActions[0].action} →</span>
        </Link>
      )}

      {/* ═══ 3. LA LÍNEA ═══ */}
      <div style={{ marginBottom: 40 }}>
        <div style={SECTION_HEADER}>
          La Línea · {laLineaItems.length > 0 ? `${laLineaItems.length} requieren atención` : 'Sin pendientes'}
        </div>
        {laLineaItems.length === 0 ? (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: TOKEN.radiusMd, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={18} style={{ color: TOKEN.green }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: TOKEN.green }}>Sin pendientes críticos</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: 4 }} className="pill-scroll">
            {laLineaItems.map(item => (
              <div key={item.trafico} style={{ flexShrink: 0, minWidth: 280, background: 'linear-gradient(135deg, #1A1A18 0%, #2A2A28 100%)', borderRadius: TOKEN.radiusMd, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: TOKEN.gold, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtId(item.trafico)}</span>
                  {item.company_id && <span style={{ fontSize: 12, fontWeight: 700, color: '#9C9890', background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '2px 8px' }}>{item.company_id}</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.red, marginBottom: 12 }}>
                  {item.semaforo === 'rojo' ? '\uD83D\uDD34 Semáforo Rojo' : `\uD83D\uDEAB ${item.blocking_count} docs faltantes`}
                </div>
                <Link href={`/traficos/${encodeURIComponent(item.trafico)}`} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 700, color: '#1A1A18', background: TOKEN.gold, borderRadius: 6, padding: '8px 16px', textDecoration: 'none', minHeight: 36 }}>
                  Ver Tráfico
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 4. PIPELINE KANBAN ═══ */}
      {(userRole === 'broker' || userRole === 'admin') && pipelineRows.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div style={SECTION_HEADER}>Pipeline de operaciones</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {pipelineGrouped.map(col => (
              <div key={col.key} style={{ background: col.bg, border: `1px solid ${col.borderColor}`, borderRadius: TOKEN.radiusMd, padding: 12, minHeight: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: col.color }}>{col.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: col.color, background: 'rgba(255,255,255,0.7)', borderRadius: 9999, padding: '2px 8px', fontFamily: 'var(--font-jetbrains-mono)' }}>{col.items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.items.slice(0, 5).map(row => (
                    <Link key={row.trafico_number} href={`/traficos/${encodeURIComponent(row.trafico_number)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`, borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtId(row.trafico_number)}</span>
                          {row.company_id && <span style={{ fontSize: 10, fontWeight: 700, color: TOKEN.textSecondary, background: '#F5F4F0', borderRadius: 4, padding: '1px 6px' }}>{row.company_id}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: TOKEN.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>{row.descripcion_mercancia || 'Sin descripción'}</div>
                        {row.score != null && (
                          <div style={{ height: 4, borderRadius: 2, background: '#E8E5E0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(Math.max(row.score, 0), 100)}%`, background: row.score >= 80 ? TOKEN.green : row.score >= 50 ? TOKEN.amber : TOKEN.red, transition: 'width 0.3s ease' }} />
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                {col.items.length > 5 && (
                  <Link href={`/traficos?pipeline_status=${col.key}`} style={{ display: 'block', marginTop: 8, fontSize: 12, fontWeight: 600, color: TOKEN.gold, textDecoration: 'none' }}>
                    Ver todos ({col.items.length}) →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 5. BRIDGE STRIP ═══ */}
      <div style={{ marginBottom: 40 }}>
        {bridgesWithData.length === 0 ? (
          <div style={{ padding: '12px 20px', borderRadius: 9999, background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`, fontSize: 14, color: TOKEN.gray, fontStyle: 'italic', textAlign: 'center' }}>
            Datos de puentes actualizándose · cada 30 min
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }} className="pill-scroll">
              {bridgesWithData.map(b => {
                const w = b.commercial!
                const isFast = fastestBridge && b.id === fastestBridge.id
                const color = w <= 30 ? TOKEN.green : w <= 60 ? TOKEN.amber : TOKEN.red
                return (
                  <div key={b.id} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 9999, background: isFast ? '#F0FDF4' : TOKEN.surfaceCard, border: isFast ? '1px solid #BBF7D0' : `1px solid ${TOKEN.border}` }}>
                    {isFast && <span style={{ fontSize: 12, fontWeight: 800, color: TOKEN.green, letterSpacing: '0.02em' }}>Más rápido</span>}
                    <span style={{ fontSize: 14, fontWeight: 600, color: TOKEN.textSecondary }}>{b.nameEs}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-jetbrains-mono)', color }}>{w} min</span>
                  </div>
                )
              })}
            </div>
            {bridgeFetchedAt && (
              <div style={{ fontSize: 12, color: TOKEN.gray, marginTop: 6, fontFamily: 'var(--font-jetbrains-mono)' }}>
                Actualizado: {new Date(bridgeFetchedAt).toLocaleTimeString('es-MX', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit' })} CST
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ 6. BELOW FOLD — feeds, entradas, metrics ═══ */}
      {loading ? (
        <div style={{ marginBottom: 40 }}>
          <div className="skeleton" style={{ height: 20, width: 200, borderRadius: 4, marginBottom: 16 }} />
          {[0, 1].map(i => (
            <div key={i} style={{ padding: 20, background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.radiusMd, marginBottom: 8 }}>
              <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '30%', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {criticalActions.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div style={SECTION_HEADER}>Operaciones críticas ({criticalActions.length})</div>
              {criticalActions.map(a => renderCaseCard(a, TOKEN.red))}
            </div>
          )}
          {warningActions.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div style={SECTION_HEADER}>Requieren seguimiento ({warningActions.length})</div>
              {warningActions.map(a => renderCaseCard(a, TOKEN.amber))}
            </div>
          )}
          {visibleActions.length === 0 && (
            <div style={{ marginBottom: 40, padding: 24, textAlign: 'center', background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.radiusMd }}>
              <CheckCircle size={24} style={{ color: TOKEN.green, margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text }}>Sin elementos urgentes · Todo despachando</div>
              <div style={{ fontSize: 14, color: TOKEN.textSecondary, marginTop: 4 }}>Sin alertas · Monitoreando en tiempo real</div>
            </div>
          )}
          {dismissedActions.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <button onClick={() => setShowResueltos(!showResueltos)} style={{ fontSize: 14, color: TOKEN.textSecondary, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 600 }}>
                Resueltos ({dismissedActions.length}) {showResueltos ? '\u25B2' : '\u25BC'}
              </button>
              {showResueltos && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {dismissedActions.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.radiusMd, opacity: 0.6, minHeight: 60 }}>
                      <Link href={a.link} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: TOKEN.gray }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: TOKEN.textSecondary }}>{a.description}</div>
                          <div style={{ fontSize: 12, color: TOKEN.gray, fontFamily: 'var(--font-jetbrains-mono)', marginTop: 2 }}>{fmtDate(a.date)}</div>
                        </div>
                      </Link>
                      <button onClick={() => restoreAction(a.id)} style={{ fontSize: 12, color: TOKEN.gold, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', flexShrink: 0, whiteSpace: 'nowrap', fontWeight: 600 }}>Restaurar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Pending entradas */}
      {pendingEntradas.length > 0 && (
        <div style={{ background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.radiusMd, padding: '16px 20px', marginBottom: 40 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.amber, marginBottom: 10 }}>
            {pendingEntradas.length} entrada{pendingEntradas.length !== 1 ? 's' : ''} en bodega sin tráfico
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingEntradas.slice(0, 5).map(e => {
              const daysWaiting = e.fecha_llegada_mercancia ? Math.floor((Date.now() - new Date(e.fecha_llegada_mercancia).getTime()) / 86400000) : 0
              return (
                <div key={e.cve_entrada} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: TOKEN.surfacePrimary, borderRadius: 6, border: `1px solid ${TOKEN.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 14, fontWeight: 700, color: TOKEN.text }}>{e.cve_entrada}</span>
                    {e.cantidad_bultos != null && <span style={{ fontSize: 12, color: TOKEN.textSecondary }}>{e.cantidad_bultos} bultos</span>}
                    {e.mercancia_danada && <span title="Mercancía dañada" style={{ fontSize: 12 }}>{'\uD83D\uDD34'}</span>}
                    {e.tiene_faltantes && !e.mercancia_danada && <span title="Faltantes reportados" style={{ fontSize: 12 }}>{'\u26A0\uFE0F'}</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)', color: daysWaiting > 7 ? TOKEN.red : daysWaiting > 3 ? TOKEN.amber : TOKEN.textSecondary }}>{daysWaiting}d</span>
                </div>
              )
            })}
          </div>
          {pendingEntradas.length > 5 && <div style={{ fontSize: 12, color: TOKEN.textSecondary, marginTop: 8 }}>+{pendingEntradas.length - 5} más</div>}
        </div>
      )}

      {/* Bottom metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 40 }}>
        <Link href="/traficos?estatus=En Proceso" style={{ textDecoration: 'none', color: 'inherit', background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.radiusMd, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: TOKEN.textSecondary, marginBottom: 6 }}>En ruta</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: enProceso.length > 0 ? TOKEN.text : TOKEN.gray, lineHeight: 1 }}>
            {loading ? <Skeleton width={48} height={24} /> : enProceso.length > 0 ? <CountingNumber value={enProceso.length} style={{ fontSize: 24, fontWeight: 900 }} /> : '\u2014'}
          </div>
          {trends.enRuta !== null && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)', color: trends.enRuta > 0 ? TOKEN.green : trends.enRuta < 0 ? TOKEN.red : TOKEN.gray }}>{trends.enRuta > 0 ? `+${trends.enRuta}` : trends.enRuta < 0 ? `${trends.enRuta}` : '0'} vs ayer</div>}
        </Link>
        <Link href="/traficos?estatus=Demorado" style={{ textDecoration: 'none', color: 'inherit', background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.radiusMd, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: TOKEN.textSecondary, marginBottom: 6 }}>Demorados</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: statusSentence.urgentes > 0 ? TOKEN.red : TOKEN.gray, lineHeight: 1 }}>
            {loading ? <Skeleton width={48} height={24} /> : <CountingNumber value={statusSentence.urgentes} style={{ fontSize: 24, fontWeight: 900 }} />}
          </div>
        </Link>
        <Link href="/traficos?sort=importe_total&order=desc" style={{ textDecoration: 'none', color: 'inherit', background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.radiusMd, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: TOKEN.textSecondary, marginBottom: 6 }}>Valor activo</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: valorEnProceso > 0 ? TOKEN.text : TOKEN.gray, lineHeight: 1 }}>
            {loading ? <Skeleton width={80} height={24} /> : valorEnProceso > 0 ? <CountingNumber value={valorEnProceso} format={(n) => fmtUSD(n)} style={{ fontSize: 24, fontWeight: 900 }} /> : '\u2014'}
          </div>
          {trends.valor !== null && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)', color: trends.valor > 0 ? TOKEN.green : trends.valor < 0 ? TOKEN.red : TOKEN.gray }}>{trends.valor > 0 ? `+${trends.valor}%` : trends.valor < 0 ? `${trends.valor}%` : '0%'} vs ayer</div>}
        </Link>
        <div style={{ background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`, borderRadius: TOKEN.radiusMd, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: TOKEN.textSecondary, marginBottom: 6 }}>T-MEC aplicado</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: tmecCount > 0 ? TOKEN.green : TOKEN.gray, lineHeight: 1 }}>
            {loading ? <Skeleton width={48} height={24} /> : tmecCount > 0 ? <CountingNumber value={tmecCount} style={{ fontSize: 24, fontWeight: 900 }} /> : '56%'}
          </div>
          <div style={{ fontSize: 12, color: TOKEN.gray, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)' }}>
            {tmecCount > 0 ? `${tmecCount} de ${traficos.length} tráficos` : 'histórico · 0 en período actual'}
          </div>
        </div>
      </div>
    </div>
  )
}
