'use client'

import { useEffect, useState, useMemo } from 'react'
import { CheckCircle } from 'lucide-react'
import { CLIENT_CLAVE, COMPANY_ID } from '@/lib/client-config'
import { fmtId, fmtDate, fmtDateTime, fmtDateTimeLocal } from '@/lib/format-utils'
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
  if (action.description.includes('Incidencia') || action.description.includes('danada') || action.description.includes('Faltantes')) {
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
  const [statusSentence, setStatusSentence] = useState<{ level: string; sentence: string; count: number } | null>(() => {
    if (typeof window === 'undefined') return null
    const cached = localStorage.getItem(`cruz_status_${CLIENT_CLAVE}`)
    return cached ? JSON.parse(cached) : null
  })

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

    // Status sentence with localStorage cache
    fetch('/api/status-sentence').then(r => r.json()).then(fresh => {
      setStatusSentence(fresh)
      localStorage.setItem(`cruz_status_${CLIENT_CLAVE}`, JSON.stringify({
        ...fresh,
        cached_at: Date.now()
      }))
    }).catch(() => {})
  }, [])

  // ── Computed values ──
  const enProceso = useMemo(() => traficos.filter(t => !(t.estatus || '').toLowerCase().includes('cruz')), [traficos])
  const cruzadosHoy = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return traficos.filter(t =>
      (t.estatus || '').toLowerCase().includes('cruz') && (t.fecha_cruce?.startsWith(today) || t.updated_at?.startsWith(today))
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

  // ── Last crossing date (for empty state) ──
  const lastCrossingDate = useMemo(() => {
    const crossed = traficos.filter(t => (t.estatus || '').toLowerCase().includes('cruz'))
    if (crossed.length === 0) return null
    const dates = crossed.map(t => t.fecha_cruce || t.updated_at).filter(Boolean).sort().reverse()
    return dates[0] ?? null
  }, [traficos])

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
    const items: { id: string; severity: 'red' | 'amber'; description: string; date: string | null; link: string; action: string }[] = []
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
      })
    })
    incidencias.slice(0, 2).forEach((e: Record<string, unknown>) => {
      const daysOld = e.fecha_llegada_mercancia ? Math.floor((Date.now() - new Date(e.fecha_llegada_mercancia as string).getTime()) / 86400000) : 0
      items.push({
        id: `i-${e.cve_entrada}`,
        severity: 'amber',
        description: `Entrada ${e.cve_entrada} — ${(e.mercancia_danada ? 'Mercancia danada' : 'Faltantes reportados')}`,
        date: e.fecha_llegada_mercancia as string | null,
        link: `/entradas/${e.cve_entrada}`,
        action: daysOld > 14 ? 'Contactar Agente' : 'Ver Incidencia',
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

  // ── Status sentence color ──
  const statusDotColor = statusSentence?.level === 'red' ? TOKEN.red : statusSentence?.level === 'amber' ? TOKEN.amber : TOKEN.green

  // ── Today formatted ──
  const todayFormatted = fmtDate(new Date().toISOString())

  // ── Data freshness indicator ──
  const dataFreshness = useMemo(() => {
    if (traficos.length === 0) return null
    const updatedDates = traficos.map(t => t.updated_at).filter(Boolean) as string[]
    if (updatedDates.length === 0) return null
    const mostRecent = updatedDates.sort().reverse()[0]
    const ageMs = Date.now() - new Date(mostRecent).getTime()
    const ageHours = ageMs / (1000 * 60 * 60)
    return { date: mostRecent, stale: ageHours > 2 }
  }, [traficos])

  // ── Bridges section (reused for mobile-first and desktop ordering) ──
  const BridgesSection = () => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text, marginBottom: 12 }}>
        Puentes ahora
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 12,
      }}>
        {liveBridges ? liveBridges.bridges.map(b => {
          const waitMin = b.commercial
          const hasData = waitMin !== null && waitMin !== undefined
          const displayMin = hasData && waitMin > 480 ? null : waitMin
          const isRecommended = hasData && displayMin !== null && displayMin < 120
          const waitColor = !hasData || displayMin === null
            ? TOKEN.gray
            : displayMin <= 30 ? TOKEN.green
            : displayMin <= 60 ? TOKEN.amber
            : TOKEN.red
          const sourceLabel = b.updated
            ? `(CBP ${fmtDateTimeLocal(b.updated).split(' · ')[1] || fmtDateTimeLocal(b.updated)})`
            : '(estimado)'
          return (
            <div key={b.id} style={{
              padding: '16px', borderRadius: TOKEN.radiusMd,
              background: TOKEN.surfaceCard,
              border: isRecommended ? `2px solid ${TOKEN.green}` : `1px solid ${TOKEN.border}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                {b.nameEs}
              </div>
              {hasData && displayMin !== null ? (
                <>
                  <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: waitColor, lineHeight: 1 }}>
                    {displayMin}
                    <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 2 }}>min</span>
                  </div>
                  <div style={{ fontSize: 11, color: TOKEN.textSecondary, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)' }}>{sourceLabel}</div>
                  {isRecommended && (
                    <div style={{ fontSize: 11, fontWeight: 800, color: TOKEN.green, marginTop: 4 }}>Recomendado</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 14, color: TOKEN.gray, fontWeight: 600 }}>Sin datos de puentes — verificando conexión CBP</div>
              )}
            </div>
          )
        }) : (
          [0, 1, 2, 3].map(i => (
            <div key={i} style={{ padding: 16, borderRadius: TOKEN.radiusMd, background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}` }}>
              <div className="skeleton" style={{ height: 14, width: 100, marginBottom: 8, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 36, width: 60, borderRadius: 4 }} />
            </div>
          ))
        )}
      </div>
      {liveBridges?.fetched && (
        <div style={{ fontSize: 12, color: TOKEN.textSecondary, marginTop: 8, fontFamily: 'var(--font-jetbrains-mono)' }}>
          Actualizado: {fmtDateTime(liveBridges.fetched)}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 960, margin: '0 auto' }}>

      {/* ═══ SECTION A — STATUS SENTENCE ═══ */}
      <div style={{ marginBottom: 24 }}>
        {statusSentence ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: statusDotColor, flexShrink: 0,
            }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: TOKEN.text, lineHeight: 1.4 }}>
              {statusSentence.sentence}
            </span>
          </div>
        ) : (
          <div className="skeleton" style={{ height: 28, width: 350, borderRadius: TOKEN.radiusMd }} />
        )}
        {/* FIX 8 — Data freshness indicator */}
        {!loading && dataFreshness && (
          <div style={{
            fontSize: 12, marginTop: 6,
            color: dataFreshness.stale ? TOKEN.amber : TOKEN.gray,
            fontFamily: 'var(--font-jetbrains-mono)',
          }}>
            Datos actualizados: {fmtDateTime(dataFreshness.date)} {dataFreshness.stale ? '⚠ hace +2h' : ''}
          </div>
        )}
      </div>

      {/* ═══ On mobile: bridges BEFORE KPI cards (3 AM driver needs this first) ═══ */}
      {isMobile && <BridgesSection />}

      {/* ═══ SECTION B — THREE CARDS ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 32,
      }}>
        {/* EN RUTA */}
        <div style={{
          background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
          borderRadius: TOKEN.radiusMd, padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: TOKEN.textSecondary, marginBottom: 8 }}>
            En Ruta
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 36, width: 60, borderRadius: 4 }} />
          ) : enProceso.length > 0 ? (
            <>
              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: TOKEN.text, lineHeight: 1 }}>
                {enProceso.length}
              </div>
              <div style={{ fontSize: 13, color: TOKEN.textSecondary, marginTop: 4 }}>tráficos</div>
              {trends.enRuta !== null && (
                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)', color: trends.enRuta > 0 ? TOKEN.green : trends.enRuta < 0 ? TOKEN.red : TOKEN.gray }}>
                  {trends.enRuta > 0 ? `↑ ${trends.enRuta} más que ayer` : trends.enRuta < 0 ? `↓ ${Math.abs(trends.enRuta)} menos` : '↔ sin cambio'}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 14, color: TOKEN.gray, fontWeight: 600 }}>Sin embarques activos — Todos los tráficos recientes han cruzado</div>
          )}
        </div>

        {/* CRUZADOS HOY */}
        <div style={{
          background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
          borderRadius: TOKEN.radiusMd, padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: TOKEN.textSecondary, marginBottom: 8 }}>
            Cruzados Hoy
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 36, width: 60, borderRadius: 4 }} />
          ) : cruzadosHoy.length > 0 ? (
            <>
              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: TOKEN.green, lineHeight: 1 }}>
                {cruzadosHoy.length}
              </div>
              <div style={{ fontSize: 13, color: TOKEN.textSecondary, marginTop: 4 }}>{todayFormatted}</div>
              {trends.cruzados !== null && (
                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)', color: trends.cruzados > 0 ? TOKEN.green : trends.cruzados < 0 ? TOKEN.red : TOKEN.gray }}>
                  {trends.cruzados > 0 ? `↑ ${trends.cruzados} más que ayer` : trends.cruzados < 0 ? `↓ ${Math.abs(trends.cruzados)} menos` : '↔ sin cambio'}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: TOKEN.gray, lineHeight: 1 }}>
                0
              </div>
              <div style={{ fontSize: 13, color: TOKEN.gray, marginTop: 4 }}>
                {lastCrossingDate ? `Último cruce: ${fmtDate(lastCrossingDate)}` : `Sin cruces — ${todayFormatted}`}
              </div>
            </>
          )}
        </div>

        {/* VALOR ACTIVO */}
        <div style={{
          background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
          borderRadius: TOKEN.radiusMd, padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: TOKEN.textSecondary, marginBottom: 8 }}>
            Valor Activo
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 36, width: 100, borderRadius: 4 }} />
          ) : valorEnProceso > 0 ? (
            <>
              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: TOKEN.text, lineHeight: 1 }}>
                {fmtUSD(valorEnProceso)}
              </div>
              <div style={{ fontSize: 13, color: TOKEN.textSecondary, marginTop: 4 }}>USD</div>
              {trends.valor !== null && (
                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)', color: trends.valor > 0 ? TOKEN.green : trends.valor < 0 ? TOKEN.red : TOKEN.gray }}>
                  {trends.valor > 0 ? `↑ ${trends.valor}% vs ayer` : trends.valor < 0 ? `↓ ${Math.abs(trends.valor)}% vs ayer` : '↔ sin cambio'}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 15, color: TOKEN.gray, fontWeight: 600 }}>Sin datos</div>
          )}
        </div>
      </div>

      {/* ═══ SECTION C — NECESITAN TU ATENCIÓN ═══ */}
      {loading ? (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text, marginBottom: 12 }}>
            Necesitan tu atención
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                background: TOKEN.surfaceCard,
                border: `1px solid ${TOKEN.border}`,
                borderRadius: TOKEN.radiusMd,
                minHeight: 72,
              }}>
                <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 12, width: '30%', borderRadius: 4 }} />
                </div>
                <div className="skeleton" style={{ height: 32, width: 100, borderRadius: TOKEN.radiusMd, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      ) : actions.length > 0 ? (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text }}>
              Necesitan tu atención{visibleActions.length > 0 ? ` (${visibleActions.length})` : ''}
            </span>
            {(urgentes.length + incidencias.length) > 5 && (
              <Link href="/traficos" style={{ fontSize: 13, fontWeight: 700, color: TOKEN.gold, textDecoration: 'none' }}>
                Ver todas →
              </Link>
            )}
          </div>
          {visibleActions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleActions.map(a => {
                const hint = getIntelligenceHint(a, traficos)
                const daysOld = a.date ? Math.floor((Date.now() - new Date(a.date).getTime()) / 86400000) : 0
                const borderColor = daysOld > 30
                  ? '#E8E5E0'
                  : daysOld > 14
                  ? '#D1CEC7'
                  : a.severity === 'red' ? TOKEN.red : TOKEN.amber
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px',
                    background: TOKEN.surfaceCard,
                    border: `1px solid ${borderColor}`,
                    borderRadius: TOKEN.radiusMd,
                    minHeight: 60,
                  }}>
                    <Link href={a.link} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit',
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: a.severity === 'red' ? TOKEN.red : TOKEN.amber,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: TOKEN.text }}>
                          {a.description}
                          {daysOld > 14 && (
                            <span style={{ fontSize: 11, color: '#9C9890', marginLeft: 8, fontWeight: 400 }}>
                              sin movimiento {daysOld} días
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: TOKEN.textSecondary, fontFamily: 'var(--font-jetbrains-mono)', marginTop: 2 }}>
                          {fmtDate(a.date)}
                        </div>
                        {hint && (
                          <div style={{ fontSize: 11, color: '#0D9488', marginTop: 4, lineHeight: 1.3 }}>
                            {hint}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: TOKEN.gold,
                        flexShrink: 0, padding: '6px 12px',
                        border: `1px solid ${TOKEN.gold}`, borderRadius: TOKEN.radiusMd,
                      }}>
                        {a.action}
                      </span>
                    </Link>
                    <button
                      onClick={() => dismissAction(a.id)}
                      style={{
                        fontSize: 11, color: TOKEN.gray, background: 'none',
                        border: 'none', cursor: 'pointer', padding: '4px 8px',
                        flexShrink: 0, whiteSpace: 'nowrap',
                      }}
                      title="Descartar"
                    >
                      Descartar
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{
              padding: 24, textAlign: 'center',
              background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
              borderRadius: TOKEN.radiusMd,
            }}>
              <CheckCircle size={24} style={{ color: TOKEN.green, margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text }}>
                Todo despachado
              </div>
              <div style={{ fontSize: 13, color: TOKEN.textSecondary, marginTop: 4 }}>
                No hay operaciones pendientes hoy. Buen trabajo.
              </div>
            </div>
          )}
          {/* ── Resueltos (dismissed) collapsed section ── */}
          {dismissedActions.length > 0 && (
            <div style={{ marginTop: 12 }}>
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
        </div>
      ) : (
        <div style={{
          marginBottom: 32, padding: 24, textAlign: 'center',
          background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
          borderRadius: TOKEN.radiusMd,
        }}>
          <CheckCircle size={24} style={{ color: TOKEN.green, margin: '0 auto 8px', display: 'block' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text }}>
            Todo despachado
          </div>
          <div style={{ fontSize: 13, color: TOKEN.textSecondary, marginTop: 4 }}>
            No hay operaciones pendientes hoy. Buen trabajo.
          </div>
        </div>
      )}

      {!isMobile && <BridgesSection />}
    </div>
  )
}
