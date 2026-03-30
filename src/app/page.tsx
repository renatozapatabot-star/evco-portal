'use client'

import { useEffect, useState, useMemo } from 'react'
import { CheckCircle } from 'lucide-react'
import { CLIENT_CLAVE } from '@/lib/client-config'
import { fmtId, fmtDate, fmtDateTime } from '@/lib/format-utils'
import { calculateCruzScore, extractScoreInput } from '@/lib/cruz-score'
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
      fetch(`/api/data?table=traficos&trafico_prefix=${CLIENT_CLAVE}-&limit=1000&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()),
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

  // ── Action queue (max 5) ──
  const actions = useMemo(() => {
    const items: { id: string; severity: 'red' | 'amber'; description: string; date: string | null; link: string; action: string }[] = []
    urgentes.slice(0, 3).forEach(t => {
      const score = calculateCruzScore(extractScoreInput(t))
      items.push({
        id: `u-${t.trafico}`,
        severity: score < 50 ? 'red' : 'amber',
        description: `${fmtId(t.trafico)} requiere seguimiento — score ${score}`,
        date: t.fecha_llegada,
        link: `/traficos/${encodeURIComponent(t.trafico)}`,
        action: 'Revisar',
      })
    })
    incidencias.slice(0, 2).forEach((e: Record<string, unknown>) => {
      items.push({
        id: `i-${e.cve_entrada}`,
        severity: 'amber',
        description: `Entrada ${e.cve_entrada} — ${(e.mercancia_danada ? 'Mercancia danada' : 'Faltantes reportados')}`,
        date: e.fecha_llegada_mercancia as string | null,
        link: `/entradas/${e.cve_entrada}`,
        action: 'Ver',
      })
    })
    return items.slice(0, 5)
  }, [urgentes, incidencias])

  // ── Status sentence color ──
  const statusDotColor = statusSentence?.level === 'red' ? TOKEN.red : statusSentence?.level === 'amber' ? TOKEN.amber : TOKEN.green

  // ── Today formatted ──
  const todayFormatted = fmtDate(new Date().toISOString())

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
      </div>

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
              <div style={{ fontSize: 13, color: TOKEN.textSecondary, marginTop: 4 }}>traficos</div>
            </>
          ) : (
            <div style={{ fontSize: 15, color: TOKEN.gray, fontWeight: 600 }}>Sin traficos activos</div>
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
            </>
          ) : (
            <>
              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: TOKEN.gray, lineHeight: 1 }}>
                0
              </div>
              <div style={{ fontSize: 13, color: TOKEN.gray, marginTop: 4 }}>Sin cruces — {todayFormatted}</div>
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
            </>
          ) : (
            <div style={{ fontSize: 15, color: TOKEN.gray, fontWeight: 600 }}>Sin datos</div>
          )}
        </div>
      </div>

      {/* ═══ SECTION C — NECESITAN TU ATENCION ═══ */}
      {actions.length > 0 ? (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: TOKEN.text }}>
              Necesitan tu atencion ({actions.length})
            </span>
            {(urgentes.length + incidencias.length) > 5 && (
              <Link href="/traficos" style={{ fontSize: 13, fontWeight: 700, color: TOKEN.gold, textDecoration: 'none' }}>
                Ver todas →
              </Link>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actions.map(a => (
              <Link key={a.id} href={a.link} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
                borderRadius: TOKEN.radiusMd, textDecoration: 'none', color: 'inherit',
                minHeight: 60,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: a.severity === 'red' ? TOKEN.red : TOKEN.amber,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TOKEN.text }}>{a.description}</div>
                  <div style={{ fontSize: 12, color: TOKEN.textSecondary, fontFamily: 'var(--font-jetbrains-mono)', marginTop: 2 }}>
                    {fmtDate(a.date)}
                  </div>
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: TOKEN.gold,
                  flexShrink: 0, padding: '6px 12px',
                  border: `1px solid ${TOKEN.gold}`, borderRadius: TOKEN.radiusMd,
                }}>
                  {a.action}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : !loading ? (
        <div style={{
          marginBottom: 32, padding: 24, textAlign: 'center',
          background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
          borderRadius: TOKEN.radiusMd,
        }}>
          <CheckCircle size={20} style={{ color: TOKEN.green, margin: '0 auto 8px', display: 'block' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: TOKEN.text }}>
            Sin pendientes — Todas las operaciones estan en orden
          </div>
        </div>
      ) : null}

      {/* ═══ SECTION D — PUENTES AHORA ═══ */}
      <div>
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
            // Cap at 480 min — data error beyond that
            const displayMin = hasData && waitMin > 480 ? null : waitMin
            const isRecommended = hasData && displayMin !== null && displayMin < 120
            const waitColor = !hasData || displayMin === null
              ? TOKEN.gray
              : displayMin <= 30 ? TOKEN.green
              : displayMin <= 60 ? TOKEN.amber
              : TOKEN.red

            // Source label from updated timestamp
            const sourceLabel = b.updated
              ? `(CBP ${new Date(b.updated).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' })})`
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
                    <div style={{ fontSize: 11, color: TOKEN.textSecondary, marginTop: 4 }}>{sourceLabel}</div>
                    {isRecommended && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: TOKEN.green, marginTop: 4 }}>
                        Recomendado
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 14, color: TOKEN.gray, fontWeight: 600 }}>Sin datos — verificando</div>
                )}
              </div>
            )
          }) : (
            // Skeleton while loading
            [0, 1, 2, 3].map(i => (
              <div key={i} style={{
                padding: 16, borderRadius: TOKEN.radiusMd,
                background: TOKEN.surfaceCard, border: `1px solid ${TOKEN.border}`,
              }}>
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
    </div>
  )
}
