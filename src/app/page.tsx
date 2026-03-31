'use client'

import { useEffect, useState, useMemo } from 'react'
import { CheckCircle } from 'lucide-react'
import { CLIENT_CLAVE, COMPANY_ID } from '@/lib/client-config'
import { daysUntilMVE } from '@/lib/compliance-dates'
import { fmtId, fmtDate } from '@/lib/format-utils'
import { calculateCruzScore, extractScoreInput } from '@/lib/cruz-score'
import { statusDays } from '@/lib/cruz-score'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'

interface TraficoRow {
  trafico: string; estatus: string; fecha_llegada: string | null
  peso_bruto: number | null; importe_total: number | null
  pedimento: string | null; descripcion_mercancia: string | null
  proveedores: string | null; fecha_cruce: string | null
  fecha_pago: string | null; updated_at?: string
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

export default function Dashboard() {
  const isMobile = useIsMobile()
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [entradas, setEntradas] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [liveBridges, setLiveBridges] = useState<{ bridges: BridgeTime[]; recommended: number | null; fetched: string | null } | null>(null)
  const [mananaItems, setMananaItems] = useState<{ solicitudes: number; mveUrgent: boolean; mveDays: number }>({ solicitudes: 0, mveUrgent: false, mveDays: 0 })
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

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 960, margin: '0 auto' }}>

      {/* ═══ HERO SECTION — dark gradient card ═══ */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1A18 0%, #2A2A28 100%)',
        borderRadius: 12, padding: isMobile ? '24px 20px' : '32px 40px',
        color: '#E8E5DF', marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: TOKEN.gray, marginBottom: 8 }}>
          Valor en operación
        </div>
        <div style={{ fontSize: isMobile ? 40 : 56, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {loading ? '...' : fmtUSD(valorEnProceso)}
          <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 4, color: TOKEN.gray }}>USD</span>
        </div>

        {(urgentes.length + incidencias.length) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TOKEN.red, animation: 'cruzPulse 2s infinite' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E8E5DF' }}>
              {urgentes.length + incidencias.length} operación{(urgentes.length + incidencias.length) !== 1 ? 'es' : ''} requiere{(urgentes.length + incidencias.length) === 1 ? '' : 'n'} atención
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: isMobile ? 16 : 32, marginTop: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)' }}>{urgentes.length}</div>
            <div style={{ fontSize: 11, color: TOKEN.gray, fontWeight: 600 }}>Detenidos</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)' }}>{incidencias.length}</div>
            <div style={{ fontSize: 11, color: TOKEN.gray, fontWeight: 600 }}>Demorados</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)' }}>{enProceso.length}</div>
            <div style={{ fontSize: 11, color: TOKEN.gray, fontWeight: 600 }}>En ruta</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: cruzadosHoy.length > 0 ? TOKEN.green : TOKEN.gray }}>{cruzadosHoy.length}</div>
            <div style={{ fontSize: 11, color: TOKEN.gray, fontWeight: 600 }}>
              {cruzadosHoy.length > 0 ? 'Cruzados hoy' : (() => {
                const lastCruce = traficos
                  .filter(t => t.fecha_cruce)
                  .sort((a, b) => (b.fecha_cruce ?? '').localeCompare(a.fecha_cruce ?? ''))[0]
                return lastCruce ? `Último: ${fmtDate(lastCruce.fecha_cruce)}` : 'Cruzados hoy'
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 3. BRIDGE STRIP ═══ */}
      {/* ═══ BRIDGE STRIP — always visible ═══ */}
      <div style={{
        display: 'flex', gap: isMobile ? 8 : 12, marginBottom: 24,
        overflowX: 'auto', whiteSpace: 'nowrap',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }} className="pill-scroll">
        {(liveBridges?.bridges && liveBridges.bridges.length > 0
          ? liveBridges.bridges
          : [
              { id: 1, name: 'World Trade', nameEs: 'World Trade', commercial: null, status: 'unknown', updated: null },
              { id: 2, name: 'Colombia', nameEs: 'Colombia', commercial: null, status: 'unknown', updated: null },
              { id: 3, name: 'Juárez-Lincoln', nameEs: 'Juárez-Lincoln', commercial: null, status: 'unknown', updated: null },
              { id: 4, name: 'Gateway', nameEs: 'Gateway', commercial: null, status: 'unknown', updated: null },
            ]
        ).map(b => {
          const w = b.commercial
          const hasData = w !== null && w !== undefined
          const color = !hasData ? TOKEN.gray : w <= 30 ? TOKEN.green : w <= 60 ? TOKEN.amber : TOKEN.red
          return (
            <div key={b.id} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 9999,
              background: TOKEN.surfaceCard,
              borderLeft: `3px solid ${color}`,
              border: `1px solid ${TOKEN.border}`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: TOKEN.textSecondary }}>{b.nameEs}</span>
              {hasData ? (
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-jetbrains-mono)', color }}>
                  {w}min
                </span>
              ) : (
                <span style={{ fontSize: 12, color: TOKEN.gray, fontStyle: 'italic' }}>
                  Sin datos
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* ═══ MAÑANA CARD — only when there's something tomorrow ═══ */}
      {(mananaItems.solicitudes > 0 || mananaItems.mveUrgent) && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: TOKEN.radiusMd, padding: '16px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>&#9728;</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>
              Mañana
            </div>
            <div style={{ fontSize: 12, color: '#92400E' }}>
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

      {/* ═══ 4. NEXT BEST ACTION ═══ */}
      {visibleActions.length > 0 && (
        <Link href={visibleActions[0].link} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', marginBottom: 24,
          background: '#FEF3C7', border: '1px solid #FDE68A',
          borderRadius: TOKEN.radiusMd, textDecoration: 'none', color: '#92400E',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Proxima accion recomendada
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {visibleActions[0].description}
            </div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: TOKEN.gold, flexShrink: 0 }}>
            {visibleActions[0].action} →
          </span>
        </Link>
      )}

      {/* ═══ 5. CRITICAL FEED — red-bordered case cards ═══ */}
      {loading ? (
        <div style={{ marginBottom: 24 }}>
          <div className="skeleton" style={{ height: 16, width: 180, borderRadius: 4, marginBottom: 12 }} />
          {[0, 1].map(i => (
            <div key={i} style={{
              padding: 20, background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
              borderRadius: TOKEN.radiusMd, marginBottom: 8,
            }}>
              <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '30%', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {criticalActions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text, marginBottom: 12 }}>
                Operaciones críticas ({criticalActions.length})
              </div>
              {criticalActions.map(a => renderCaseCard(a, TOKEN.red))}
            </div>
          )}

          {/* ═══ 6. WARNING FEED — amber-bordered case cards ═══ */}
          {warningActions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text, marginBottom: 12 }}>
                Requieren seguimiento ({warningActions.length})
              </div>
              {warningActions.map(a => renderCaseCard(a, TOKEN.amber))}
            </div>
          )}

          {/* All clear state */}
          {visibleActions.length === 0 && actions.length === 0 && (
            <div style={{
              marginBottom: 24, padding: 24, textAlign: 'center',
              background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
              borderRadius: TOKEN.radiusMd,
            }}>
              <CheckCircle size={24} style={{ color: TOKEN.green, margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text }}>
                Sin elementos urgentes · Todo despachando
              </div>
              <div style={{ fontSize: 13, color: TOKEN.textSecondary, marginTop: 4 }}>
                Sin alertas · Monitoreando en tiempo real
              </div>
            </div>
          )}

          {/* All dismissed state */}
          {visibleActions.length === 0 && actions.length > 0 && (
            <div style={{
              marginBottom: 24, padding: 24, textAlign: 'center',
              background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
              borderRadius: TOKEN.radiusMd,
            }}>
              <CheckCircle size={24} style={{ color: TOKEN.green, margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text }}>
                Sin elementos urgentes · Todo despachando
              </div>
              <div style={{ fontSize: 13, color: TOKEN.textSecondary, marginTop: 4 }}>
                Sin alertas · Monitoreando en tiempo real
              </div>
            </div>
          )}

          {/* ── Resueltos (dismissed) collapsed section ── */}
          {dismissedActions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <button
                onClick={() => setShowResueltos(!showResueltos)}
                style={{
                  fontSize: 13, color: TOKEN.textSecondary, background: 'none',
                  border: 'none', cursor: 'pointer', padding: '4px 0',
                  fontWeight: 600,
                }}
              >
                Resueltos ({dismissedActions.length}) {showResueltos ? '\u25B2' : '\u25BC'}
              </button>
              {showResueltos && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {dismissedActions.map(a => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px',
                      background: TOKEN.surfaceCard,
                      border: `1px solid ${TOKEN.border}`,
                      borderRadius: TOKEN.radiusMd,
                      opacity: 0.6,
                      minHeight: 60,
                    }}>
                      <Link href={a.link} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit',
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: TOKEN.gray,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: TOKEN.textSecondary }}>{a.description}</div>
                          <div style={{ fontSize: 12, color: TOKEN.gray, fontFamily: 'var(--font-jetbrains-mono)', marginTop: 2 }}>
                            {fmtDate(a.date)}
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={() => restoreAction(a.id)}
                        style={{
                          fontSize: 11, color: TOKEN.gold, background: 'none',
                          border: 'none', cursor: 'pointer', padding: '4px 8px',
                          flexShrink: 0, whiteSpace: 'nowrap', fontWeight: 600,
                        }}
                      >
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ 7. BOTTOM METRICS — 4-card grid ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 32,
      }}>
        <div style={{
          background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
          borderRadius: TOKEN.radiusMd, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: TOKEN.textSecondary, marginBottom: 6 }}>
            En ruta
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: enProceso.length > 0 ? TOKEN.text : TOKEN.gray, lineHeight: 1 }}>
            {loading ? '...' : enProceso.length}
          </div>
          {trends.enRuta !== null && (
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)', color: trends.enRuta > 0 ? TOKEN.green : trends.enRuta < 0 ? TOKEN.red : TOKEN.gray }}>
              {trends.enRuta > 0 ? `+${trends.enRuta}` : trends.enRuta < 0 ? `${trends.enRuta}` : '0'} vs ayer
            </div>
          )}
        </div>

        <div style={{
          background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
          borderRadius: TOKEN.radiusMd, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: TOKEN.textSecondary, marginBottom: 6 }}>
            Demorados
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: (urgentes.length + incidencias.length) > 0 ? TOKEN.red : TOKEN.gray, lineHeight: 1 }}>
            {loading ? '...' : urgentes.length + incidencias.length}
          </div>
        </div>

        <div style={{
          background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
          borderRadius: TOKEN.radiusMd, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: TOKEN.textSecondary, marginBottom: 6 }}>
            Valor activo
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: valorEnProceso > 0 ? TOKEN.text : TOKEN.gray, lineHeight: 1 }}>
            {loading ? '...' : fmtUSD(valorEnProceso)}
          </div>
          {trends.valor !== null && (
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)', color: trends.valor > 0 ? TOKEN.green : trends.valor < 0 ? TOKEN.red : TOKEN.gray }}>
              {trends.valor > 0 ? `+${trends.valor}%` : trends.valor < 0 ? `${trends.valor}%` : '0%'} vs ayer
            </div>
          )}
        </div>

        <div style={{
          background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
          borderRadius: TOKEN.radiusMd, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: TOKEN.textSecondary, marginBottom: 6 }}>
            T-MEC aplicado
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: tmecCount > 0 ? TOKEN.green : TOKEN.gray, lineHeight: 1 }}>
            {loading ? '...' : tmecCount > 0 ? tmecCount : '56%'}
          </div>
          <div style={{ fontSize: 11, color: TOKEN.gray, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)' }}>
            {tmecCount > 0
              ? `${tmecCount} de ${traficos.length} tráficos`
              : 'histórico · 0 en período actual'
            }
          </div>
        </div>
      </div>
    </div>
  )
}
