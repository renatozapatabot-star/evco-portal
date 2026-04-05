'use client'

import { useEffect, useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import { getCookieValue, getCompanyIdCookie, getClientClaveCookie } from '@/lib/client-config'
import { fmtDate, fmtKg } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'
import { ErrorCard } from '@/components/ui/ErrorCard'

/* ── Types ── */

interface Entrada {
  cve_entrada: string
  cve_cliente: string | null
  trafico: string | null
  fecha_llegada_mercancia: string | null
  cantidad_bultos: number | null
  peso_bruto: number | null
  tiene_faltantes: boolean | null
  mercancia_danada: boolean | null
  comentarios_danada: string | null
  company_id: string | null
}

/* ── Dark tokens ── */

const T = {
  bg: '#0F0E0C',
  card: '#1A1814',
  border: '#302C23',
  gold: '#C4963C',
  textPrimary: '#F5F0E8',
  textSecondary: '#A09882',
  textMuted: '#6B6355',
  red: '#C23B22',
  redBg: '#2A1215',
  redBorder: '#5C2226',
  green: '#2D8F4E',
  greenBg: '#1A3A2A',
  greenBorder: '#2D8F4E',
  amber: '#D4A017',
  amberBg: '#2A2415',
  amberBorder: '#5C4D22',
  radius: 8,
} as const

type TabKey = 'llegadas' | 'bodega' | 'danos' | 'kpis'

/* ── Helpers ── */

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000))
}

function statusBadge(e: Entrada) {
  if (e.mercancia_danada) return { label: 'DAÑADO', bg: T.redBg, border: T.redBorder, color: T.red }
  if (e.tiene_faltantes) return { label: 'FALTANTES', bg: T.amberBg, border: T.amberBorder, color: T.amber }
  return { label: 'OK', bg: T.greenBg, border: T.greenBorder, color: T.green }
}

function dwellColor(days: number): string {
  if (days < 1) return T.greenBorder
  if (days <= 2) return T.amberBorder
  return T.redBorder
}

/* ── Component ── */

export default function BodegaPage() {
  const isMobile = useIsMobile()
  const role = getCookieValue('user_role')
  const isBroker = role === 'broker' || role === 'admin'

  const [rows, setRows] = useState<Entrada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('llegadas')

  function loadData() {
    const companyId = getCompanyIdCookie()
    const clientClave = getClientClaveCookie()
    const url = isBroker
      ? `/api/data?table=entradas&company_id=${companyId}&limit=2000&order_by=fecha_llegada_mercancia&order_dir=desc`
      : `/api/data?table=entradas&cve_cliente=${clientClave}&limit=2000&order_by=fecha_llegada_mercancia&order_dir=desc`
    setLoading(true)
    setError(null)
    fetch(url)
      .then(r => r.json())
      .then(d => setRows(d.data ?? []))
      .catch(() => setError('No se pudo cargar la bodega.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [isBroker])

  /* ── Derived data ── */

  const danosCount = useMemo(
    () => rows.filter(e => e.mercancia_danada || e.tiene_faltantes).length,
    [rows]
  )

  const enBodega = useMemo(
    () => rows
      .filter(e => e.trafico != null)
      .sort((a, b) => daysSince(b.fecha_llegada_mercancia) - daysSince(a.fecha_llegada_mercancia)),
    [rows]
  )

  const danos = useMemo(
    () => rows.filter(e => e.mercancia_danada || e.tiene_faltantes),
    [rows]
  )

  // KPI data — this month only
  const monthlyRows = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    return rows.filter(e => e.fecha_llegada_mercancia && e.fecha_llegada_mercancia >= monthStart)
  }, [rows])

  const kpis = useMemo(() => {
    const withDates = monthlyRows.filter(e => e.fecha_llegada_mercancia)
    const avgDwell = withDates.length > 0
      ? Math.round(withDates.reduce((s, e) => s + daysSince(e.fecha_llegada_mercancia), 0) / withDates.length)
      : 0
    const damageRate = monthlyRows.length > 0
      ? ((monthlyRows.filter(e => e.mercancia_danada || e.tiene_faltantes).length / monthlyRows.length) * 100).toFixed(1)
      : '0.0'
    const totalBultos = monthlyRows.reduce((s, e) => s + (e.cantidad_bultos ?? 0), 0)
    const totalPeso = monthlyRows.reduce((s, e) => s + (e.peso_bruto ?? 0), 0)
    return { avgDwell, damageRate, totalBultos, totalPeso }
  }, [monthlyRows])

  /* ── Tabs config ── */

  const tabs: { key: TabKey; label: string; badge?: number; brokerOnly?: boolean }[] = [
    { key: 'llegadas', label: 'Llegadas' },
    { key: 'bodega', label: 'En Bodega' },
    { key: 'danos', label: 'Daños', badge: danosCount > 0 ? danosCount : undefined },
    { key: 'kpis', label: 'KPIs', brokerOnly: true },
  ]

  const visibleTabs = tabs.filter(t => !t.brokerOnly || isBroker)

  /* ── Error ── */

  if (error) {
    return (
      <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1200, margin: '0 auto' }}>
        <ErrorCard message={error} onRetry={loadData} />
      </div>
    )
  }

  /* ── Loading ── */

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1200, margin: '0 auto' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, height: 48, marginBottom: 8, opacity: 0.5,
          }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>
          Bodega
        </h1>
        <p style={{ fontSize: 14, color: T.textSecondary }}>
          Inteligencia de almacén · {rows.length} entradas
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        borderBottom: `1px solid ${T.border}`, paddingBottom: 0,
        overflowX: 'auto',
      }}>
        {visibleTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px',
              fontSize: 13, fontWeight: 600,
              color: tab === t.key ? T.gold : T.textSecondary,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === t.key ? `2px solid ${T.gold}` : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 8,
              minHeight: 60, whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.badge != null && (
              <span style={{
                background: T.red, color: T.textPrimary,
                fontSize: 11, fontWeight: 700, padding: '2px 7px',
                borderRadius: 9999, lineHeight: 1.2,
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ TAB 1 — Llegadas ═══ */}
      {tab === 'llegadas' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Fecha', 'Entrada', 'Tráfico', 'Bultos', 'Peso (kg)', 'Estado'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 12px',
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: T.textMuted,
                    borderBottom: `1px solid ${T.border}`,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: T.textSecondary }}>
                    Sin entradas registradas.
                  </td>
                </tr>
              ) : rows.map(e => {
                const badge = statusBadge(e)
                return (
                  <tr key={e.cve_entrada} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '12px', fontSize: 13, color: T.textSecondary, fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {fmtDate(e.fecha_llegada_mercancia)}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, color: T.textPrimary, fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {e.cve_entrada}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13 }}>
                      {e.trafico ? (
                        <Link href={`/traficos/${encodeURIComponent(e.trafico)}`} style={{
                          color: T.gold, fontWeight: 600, textDecoration: 'none',
                          fontFamily: 'var(--font-jetbrains-mono)',
                        }}>
                          {e.trafico}
                        </Link>
                      ) : (
                        <span style={{ color: T.textMuted }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: T.textPrimary, fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {e.cantidad_bultos ?? '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: T.textPrimary, fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {e.peso_bruto != null ? fmtKg(e.peso_bruto) : '—'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px',
                        fontSize: 11, fontWeight: 700, borderRadius: 9999,
                        background: badge.bg, border: `1px solid ${badge.border}`,
                        color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ TAB 2 — En Bodega ═══ */}
      {tab === 'bodega' && (
        enBodega.length === 0 ? (
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: 32, textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, color: T.textSecondary }}>
              Sin entradas en bodega con tráfico asignado.
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: 12,
          }}>
            {enBodega.map(e => {
              const days = daysSince(e.fecha_llegada_mercancia)
              const borderColor = dwellColor(days)
              return (
                <div key={e.cve_entrada} style={{
                  background: T.card,
                  border: `1px solid ${borderColor}`,
                  borderLeft: `4px solid ${borderColor}`,
                  borderRadius: T.radius, padding: 20,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: T.textPrimary,
                      fontFamily: 'var(--font-jetbrains-mono)',
                    }}>
                      {e.cve_entrada}
                    </div>
                    <div style={{
                      fontSize: 28, fontWeight: 900, lineHeight: 1,
                      fontFamily: 'var(--font-jetbrains-mono)',
                      color: borderColor,
                    }}>
                      {days}<span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>d</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: T.textSecondary }}>
                    <span>{e.cantidad_bultos ?? 0} bultos</span>
                    <span>{e.peso_bruto != null ? `${fmtKg(e.peso_bruto)} kg` : '—'}</span>
                  </div>
                  {e.trafico && (
                    <Link href={`/traficos/${encodeURIComponent(e.trafico)}`} style={{
                      display: 'inline-block', marginTop: 10,
                      fontSize: 12, fontWeight: 600, color: T.gold,
                      textDecoration: 'none', fontFamily: 'var(--font-jetbrains-mono)',
                    }}>
                      {e.trafico} →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ═══ TAB 3 — Daños ═══ */}
      {tab === 'danos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              disabled
              title="Próximamente"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: T.radius,
                background: T.card, border: `1px solid ${T.border}`,
                color: T.textMuted, fontSize: 13, fontWeight: 600,
                cursor: 'not-allowed', opacity: 0.6, minHeight: 60,
              }}
            >
              <Download size={14} />
              Exportar reporte
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Entrada', 'Fecha', 'Comentarios', isBroker ? 'Cliente' : null].filter(Boolean).map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 12px',
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: T.textMuted,
                      borderBottom: `1px solid ${T.border}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {danos.length === 0 ? (
                  <tr>
                    <td colSpan={isBroker ? 4 : 3} style={{ padding: 32, textAlign: 'center', color: T.textSecondary }}>
                      Sin incidencias registradas.
                    </td>
                  </tr>
                ) : danos.map(e => {
                  const badge = statusBadge(e)
                  return (
                    <tr key={e.cve_entrada} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '12px', fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontWeight: 700, color: T.textPrimary,
                            fontFamily: 'var(--font-jetbrains-mono)',
                          }}>
                            {e.cve_entrada}
                          </span>
                          <span style={{
                            padding: '2px 8px', fontSize: 10, fontWeight: 700,
                            borderRadius: 9999, background: badge.bg,
                            border: `1px solid ${badge.border}`, color: badge.color,
                          }}>
                            {badge.label}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontSize: 13, color: T.textSecondary, fontFamily: 'var(--font-jetbrains-mono)' }}>
                        {fmtDate(e.fecha_llegada_mercancia)}
                      </td>
                      <td style={{ padding: '12px', fontSize: 13, color: T.textSecondary, maxWidth: 300 }}>
                        {e.comentarios_danada || '—'}
                      </td>
                      {isBroker && (
                        <td style={{ padding: '12px', fontSize: 13, color: T.textMuted }}>
                          {e.cve_cliente || e.company_id || '—'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB 4 — KPIs (broker/admin only) ═══ */}
      {tab === 'kpis' && isBroker && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 12,
        }}>
          {/* Avg dwell */}
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: 24,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: T.textMuted, marginBottom: 8,
            }}>
              Permanencia promedio
            </div>
            <div style={{
              fontSize: 40, fontWeight: 900, lineHeight: 1,
              fontFamily: 'var(--font-jetbrains-mono)',
              color: T.textPrimary,
            }}>
              {kpis.avgDwell}<span style={{ fontSize: 16, color: T.textMuted }}>d</span>
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 6 }}>
              este mes
            </div>
          </div>

          {/* Damage rate */}
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: 24,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: T.textMuted, marginBottom: 8,
            }}>
              Tasa de daño
            </div>
            <div style={{
              fontSize: 40, fontWeight: 900, lineHeight: 1,
              fontFamily: 'var(--font-jetbrains-mono)',
              color: Number(kpis.damageRate) > 5 ? T.red : T.textPrimary,
            }}>
              {kpis.damageRate}<span style={{ fontSize: 16, color: T.textMuted }}>%</span>
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 6 }}>
              {monthlyRows.filter(e => e.mercancia_danada || e.tiene_faltantes).length} de {monthlyRows.length} entradas
            </div>
          </div>

          {/* Total bultos */}
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: 24,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: T.textMuted, marginBottom: 8,
            }}>
              Total bultos
            </div>
            <div style={{
              fontSize: 40, fontWeight: 900, lineHeight: 1,
              fontFamily: 'var(--font-jetbrains-mono)',
              color: T.textPrimary,
            }}>
              {kpis.totalBultos.toLocaleString('es-MX')}
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 6 }}>
              recibidos este mes
            </div>
          </div>

          {/* Total peso */}
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: 24,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: T.textMuted, marginBottom: 8,
            }}>
              Total peso
            </div>
            <div style={{
              fontSize: 40, fontWeight: 900, lineHeight: 1,
              fontFamily: 'var(--font-jetbrains-mono)',
              color: T.textPrimary,
            }}>
              {fmtKg(kpis.totalPeso)}
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 6 }}>
              kg este mes
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
