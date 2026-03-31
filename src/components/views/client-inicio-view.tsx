'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { COMPANY_ID, CLIENT_CLAVE } from '@/lib/client-config'
import { fmtDate, fmtDateTime, fmtUSDCompact } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'

/* ── Types ── */

interface CruzAlert {
  icon: string
  title: string
  action: string
  prompt: string
}

interface TraficoRow {
  trafico: string
  estatus: string
  fecha_llegada: string | null
  importe_total: number | null
  pedimento: string | null
  descripcion_mercancia: string | null
  fecha_cruce: string | null
  updated_at?: string
  [k: string]: unknown
}

interface ActivityItem {
  trafico: string
  estatus: string
  updated_at: string
}

/* ── Dark theme tokens ── */

const T = {
  bg: '#0D0D0C',
  card: '#1A1814',
  border: '#302C23',
  gold: '#B8953F',
  goldHover: '#A6832F',
  textPrimary: '#F5F0E8',
  textSecondary: '#A09882',
  red: '#A3162A',
  greenBg: '#1A3A2A',
  greenBorder: '#2D8F4E',
  greenText: '#2D8F4E',
  blockedRed: '#CC1B2F',
  pendingGold: '#D4A017',
  radius: 8,
} as const

/* ── Stage helpers ── */

const STAGES = ['Recibido', 'Documentación', 'Despacho', 'Cruce', 'Entregado'] as const

function getStageIndex(estatus: string): number {
  const s = (estatus || '').toLowerCase()
  if (s.includes('entreg') || s.includes('complet')) return 4
  if (s.includes('cruz')) return 3
  if (s.includes('despacho') || s.includes('revis') || s.includes('proceso')) return 2
  if (s.includes('document') || s.includes('pedimento')) return 1
  return 0
}

function getProgressColor(t: TraficoRow): string {
  const s = (t.estatus || '').toLowerCase()
  if (s.includes('deten') || s.includes('bloque') || s.includes('rechaz')) return T.blockedRed
  if (!t.pedimento) return T.pendingGold
  return T.gold
}

/* ── Component ── */

export default function ClientInicioView() {
  const isMobile = useIsMobile()
  const [alerts, setAlerts] = useState<CruzAlert[]>([])
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/cruz-alerts').then(r => r.json()),
      fetch(
        `/api/data?table=traficos&company_id=${COMPANY_ID}&trafico_prefix=${CLIENT_CLAVE}-&limit=200&order_by=updated_at&order_dir=desc`
      ).then(r => r.json()),
    ])
      .then(([alertData, traficoData]) => {
        setAlerts(alertData.alerts ?? [])
        setTraficos(traficoData.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /* ── Derived data ── */

  const activeTraficos = useMemo(
    () => traficos.filter(t => {
      const s = (t.estatus || '').toLowerCase()
      return !s.includes('complet') && !s.includes('entreg')
    }),
    [traficos]
  )

  const completedThisMonth = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    return traficos.filter(t => {
      const s = (t.estatus || '').toLowerCase()
      return (s.includes('complet') || s.includes('entreg') || s.includes('cruz'))
        && t.fecha_cruce && t.fecha_cruce >= monthStart
    })
  }, [traficos])

  const monthlyValue = useMemo(
    () => completedThisMonth.reduce((s, t) => s + (Number(t.importe_total) || 0), 0),
    [completedThisMonth]
  )

  // USMCA savings estimate (simplified — traficos tagged usmca/t-mec)
  const usmcaSavings = useMemo(() => {
    const usmca = completedThisMonth.filter(t =>
      (t.descripcion_mercancia || '').toLowerCase().match(/t-mec|tmec|usmca/)
    )
    // Estimated savings ~5% of value for USMCA-eligible
    return usmca.reduce((s, t) => s + (Number(t.importe_total) || 0) * 0.05, 0)
  }, [completedThisMonth])

  // Activity feed: last 5 status changes
  const recentActivity = useMemo<ActivityItem[]>(() =>
    traficos
      .filter(t => t.updated_at)
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
      .slice(0, 5)
      .map(t => ({ trafico: t.trafico, estatus: t.estatus, updated_at: t.updated_at! })),
    [traficos]
  )

  // Pending doc alerts (action_required type — use all alerts from endpoint)
  const pendingDocs = alerts

  /* ── Loading skeleton ── */

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32, maxWidth: 960, margin: '0 auto' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: 24, marginBottom: 16,
            height: i === 1 ? 100 : 200, opacity: 0.5,
          }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 960, margin: '0 auto' }}>

      {/* ═══ SECTION 1 — Atención Requerida ═══ */}
      {pendingDocs.length > 0 ? (
        <div style={{
          background: T.red,
          borderRadius: T.radius,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: 18, fontWeight: 700, color: T.textPrimary,
            marginBottom: 12,
          }}>
            ⚠️ {pendingDocs.length} documento{pendingDocs.length !== 1 ? 's' : ''} pendiente{pendingDocs.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {pendingDocs.map((alert, i) => (
              <div key={i} style={{ fontSize: 14, color: T.textPrimary, lineHeight: 1.5 }}>
                {alert.icon} {alert.title}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
            Estos documentos son necesarios para continuar el despacho. Plazo: 24 horas.
          </div>
          <Link href="/documentos/pendientes" style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '12px 24px', borderRadius: T.radius,
            background: T.textPrimary, color: T.red,
            fontSize: 14, fontWeight: 700,
            textDecoration: 'none', minHeight: 60,
          }}>
            Subir documentos
          </Link>
        </div>
      ) : (
        <div style={{
          background: T.greenBg,
          border: `1px solid ${T.greenBorder}`,
          borderRadius: T.radius,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.greenText }}>
            ✓ No hay pendientes de su parte
          </div>
        </div>
      )}

      {/* ═══ SECTION 2 — Embarques Activos ═══ */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: T.textPrimary,
          marginBottom: 16,
        }}>
          Embarques Activos
        </div>

        {activeTraficos.length === 0 ? (
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: 32, textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, color: T.textSecondary }}>
              No hay embarques activos en este momento.
            </div>
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: 12,
            }}>
              {activeTraficos.slice(0, 6).map(t => {
                const stageIdx = getStageIndex(t.estatus)
                const progressColor = getProgressColor(t)
                return (
                  <div key={t.trafico} style={{
                    background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: T.radius, padding: 20,
                  }}>
                    {/* Tráfico ID */}
                    <div style={{
                      fontSize: 15, fontWeight: 700,
                      fontFamily: 'var(--font-jetbrains-mono)',
                      color: T.gold, marginBottom: 6,
                    }}>
                      {t.trafico}
                    </div>

                    {/* Description */}
                    <div style={{
                      fontSize: 13, color: T.textSecondary,
                      marginBottom: 12,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {t.descripcion_mercancia || 'Sin descripción'}
                    </div>

                    {/* Progress bar */}
                    <div style={{
                      display: 'flex', gap: 3, marginBottom: 6,
                    }}>
                      {STAGES.map((_, i) => (
                        <div key={i} style={{
                          flex: 1, height: 6, borderRadius: 3,
                          background: i <= stageIdx ? progressColor : T.border,
                          transition: 'background 0.3s',
                        }} />
                      ))}
                    </div>

                    {/* Stage label */}
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: progressColor, marginBottom: 10,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {STAGES[stageIdx]}
                    </div>

                    {/* Estimated crossing */}
                    {t.fecha_cruce && (
                      <div style={{
                        fontSize: 12, color: T.textSecondary,
                        fontFamily: 'var(--font-jetbrains-mono)',
                        marginBottom: 12,
                      }}>
                        Cruce estimado: {fmtDate(t.fecha_cruce)}
                      </div>
                    )}

                    {/* Ver detalle button */}
                    <Link
                      href={`/traficos/${encodeURIComponent(t.trafico)}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center',
                        fontSize: 13, fontWeight: 600, color: T.gold,
                        padding: '10px 16px', borderRadius: T.radius,
                        border: `1px solid ${T.border}`,
                        textDecoration: 'none', minHeight: 60,
                      }}
                    >
                      Ver detalle →
                    </Link>
                  </div>
                )
              })}
            </div>

            {activeTraficos.length > 6 && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <Link href="/traficos" style={{
                  fontSize: 14, fontWeight: 600, color: T.gold,
                  textDecoration: 'none',
                }}>
                  Ver todos ({activeTraficos.length} embarques activos) →
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ SECTION 3 — Resumen del Mes ═══ */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: '16px 24px', marginBottom: 24,
        display: 'flex', alignItems: 'center',
        flexWrap: 'wrap', gap: 4,
        fontSize: 14, color: T.textSecondary,
      }}>
        <span>Completados: </span>
        <Link href="/traficos?estatus=Cruzado" style={{
          color: T.textPrimary, fontWeight: 700,
          fontFamily: 'var(--font-jetbrains-mono)',
          textDecoration: 'none',
        }}>
          {completedThisMonth.length}
        </Link>
        <span> · Valor: </span>
        <Link href="/reportes" style={{
          color: T.textPrimary, fontWeight: 700,
          fontFamily: 'var(--font-jetbrains-mono)',
          textDecoration: 'none',
        }}>
          {fmtUSDCompact(monthlyValue)}
        </Link>
        {usmcaSavings > 0 && (
          <>
            <span> · Ahorros USMCA: </span>
            <Link href="/reportes" style={{
              color: T.textPrimary, fontWeight: 700,
              fontFamily: 'var(--font-jetbrains-mono)',
              textDecoration: 'none',
            }}>
              {fmtUSDCompact(usmcaSavings)}
            </Link>
          </>
        )}
      </div>

      {/* ═══ SECTION 4 — Actividad Reciente ═══ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: T.textPrimary,
          marginBottom: 16,
        }}>
          Actividad Reciente
        </div>

        {recentActivity.length === 0 ? (
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: 24, textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, color: T.textSecondary }}>
              Sin actividad reciente.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentActivity.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: T.card, border: `1px solid ${T.border}`,
                borderRadius: T.radius,
              }}>
                <div style={{
                  fontSize: 12, color: T.textSecondary,
                  fontFamily: 'var(--font-jetbrains-mono)',
                  flexShrink: 0, minWidth: isMobile ? 80 : 130,
                }}>
                  {fmtDateTime(item.updated_at)}
                </div>
                <Link
                  href={`/traficos/${encodeURIComponent(item.trafico)}`}
                  style={{
                    fontSize: 14, fontWeight: 700,
                    fontFamily: 'var(--font-jetbrains-mono)',
                    color: T.gold, textDecoration: 'none',
                  }}
                >
                  {item.trafico}
                </Link>
                <div style={{ fontSize: 13, color: T.textSecondary }}>
                  {item.estatus}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
