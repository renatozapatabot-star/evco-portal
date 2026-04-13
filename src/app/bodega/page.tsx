'use client'

import { useEffect, useState, useMemo } from 'react'
import { Download, Search } from 'lucide-react'
import { getCookieValue, getCompanyIdCookie } from '@/lib/client-config'
import { fmtDate, fmtKg } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { EmptyState } from '@/components/ui/EmptyState'

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

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */

const T = {
  bg: 'var(--bg-main)',
  card: 'var(--bg-card)',
  border: 'var(--border)',
  gold: 'var(--gold)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  red: 'var(--danger-500)',
  redBg: 'var(--red-50)',
  redBorder: 'var(--red-100)',
  green: 'var(--success)',
  greenBg: 'var(--green-50)',
  greenBorder: 'var(--green-100)',
  amber: 'var(--warning-500, #D97706)',
  amberBg: 'var(--amber-50)',
  amberBorder: 'var(--amber-100)',
  radius: 8,
} as const

type TabKey = 'llegadas' | 'bodega' | 'kpis'

/* ── Helpers ── */

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000))
}

function cutoffNinetyDaysAgo(): number {
  return Date.now() - 90 * 86400000
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

function dwellTextColor(days: number): string {
  if (days < 1) return T.green
  if (days <= 2) return T.amber
  return T.red
}

/* ── Component ── */

export default function BodegaPage() {
  const isMobile = useIsMobile()
  const role = getCookieValue('user_role')
  const isBroker = role === 'broker' || role === 'admin'

  const [rows, setRows] = useState<Entrada[]>([])
  const [crossedSet, setCrossedSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('llegadas')
  const [bodegaSearch, setBodegaSearch] = useState('')

  function loadData() {
    const companyId = getCompanyIdCookie()
    const url = `/api/data?table=entradas&company_id=${companyId}&limit=2000&order_by=fecha_llegada_mercancia&order_dir=desc`
    setLoading(true)
    setError(null)

    // Fetch entradas + traficos in parallel
    const safeFetch = (u: string) => fetch(u).then(r => {
      if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
      return r.json()
    })
    Promise.all([
      safeFetch(url),
      safeFetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&select=trafico,fecha_cruce,estatus`),
    ])
      .then(([entradaData, traficoData]) => {
        setRows(entradaData.data ?? [])
        // Build set of embarques that have already crossed or completed
        const crossed = new Set<string>()
        const traficos = Array.isArray(traficoData.data) ? traficoData.data : []
        traficos.forEach((t: { trafico?: string; fecha_cruce?: string; estatus?: string }) => {
          if (!t.trafico) return
          const s = (t.estatus || '').toLowerCase()
          const isComplete = t.fecha_cruce || s.includes('cruz') || s.includes('complet') || s.includes('pagado') || s.includes('libera')
          if (isComplete) crossed.add(t.trafico)
        })
        setCrossedSet(crossed)
      })
      .catch(err => {
        if (err.message === 'session_expired') { window.location.href = '/login'; return }
        setError('No se pudo cargar el inventario.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [isBroker])

  /* ── Derived data ── */

  const danosCount = useMemo(
    () => rows.filter(e => e.mercancia_danada || e.tiene_faltantes).length,
    [rows]
  )

  const enBodega = useMemo(() => {
    const cutoff = cutoffNinetyDaysAgo() // 90 days max — older entries are not in the warehouse
    return rows
      .filter(e => {
        if (!e.trafico || crossedSet.has(e.trafico)) return false
        const arrived = e.fecha_llegada_mercancia ? new Date(e.fecha_llegada_mercancia).getTime() : 0
        return arrived >= cutoff
      })
      .sort((a, b) => daysSince(b.fecha_llegada_mercancia) - daysSince(a.fecha_llegada_mercancia))
  }, [rows, crossedSet])

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
    { key: 'bodega', label: 'En Bodega', badge: enBodega.length > 0 ? enBodega.length : undefined },
    { key: 'kpis', label: 'KPIs', brokerOnly: true },
  ]

  const visibleTabs = tabs.filter(t => !t.brokerOnly || isBroker)

  /* ── Error ── */

  if (error) {
    return (
      <div className="page-shell" style={{ maxWidth: 1200 }}>
        <ErrorCard message={error} onRetry={loadData} />
      </div>
    )
  }

  /* ── Loading ── */

  if (loading) {
    return (
      <div className="page-shell" style={{ maxWidth: 1200 }}>
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
    <div className="page-shell" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>
          Inventario
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
              <span
                aria-label={`${t.badge} entradas en bodega`}
                style={{
                  background: 'var(--teal, #0D9488)', color: '#FFFFFF',
                  fontSize: 11, fontWeight: 700, padding: '2px 7px',
                  borderRadius: 9999, lineHeight: 1.2,
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ TAB 1 — Llegadas ═══ */}
      {tab === 'llegadas' && (
        <div>
          {/* Search */}
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flex: 1,
              background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius,
              padding: '0 14px', height: 48,
            }}>
              <Search size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
              <input
                placeholder="Buscar entrada, embarque..."
                value={bodegaSearch}
                onChange={e => setBodegaSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T.textPrimary, width: '100%' }}
                aria-label="Buscar en inventario"
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }} aria-label="Llegadas de mercancía">
            <thead>
              <tr>
                {['Fecha', 'Entrada', 'Embarque', 'Bultos', 'Peso (kg)'].map(h => (
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
                  <td colSpan={5}>
                    <EmptyState icon="📦" title="Sin entradas registradas" description="Las llegadas de mercancía aparecerán aquí" cta={{ label: 'Ver entradas', href: '/entradas' }} />
                  </td>
                </tr>
              ) : rows.filter(e => {
                if (!bodegaSearch.trim()) return true
                const q = bodegaSearch.toLowerCase()
                return (e.cve_entrada || '').toLowerCase().includes(q) || (e.trafico || '').toLowerCase().includes(q)
              }).map(e => {
                const badge = statusBadge(e)
                return (
                  <tr key={e.cve_entrada} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '12px', fontSize: 13, color: T.textSecondary }}>
                      {fmtDate(e.fecha_llegada_mercancia)}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, color: T.textPrimary, fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {e.cve_entrada}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13 }}>
                      {e.trafico ? (
                        <Link href={`/embarques/${encodeURIComponent(e.trafico)}`} style={{
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
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ═══ TAB 2 — En Bodega ═══ */}
      {tab === 'bodega' && (
        enBodega.length === 0 ? (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
            <EmptyState icon="🏭" title="Sin mercancía en bodega" description="Las entradas con embarque asignado aparecerán aquí" />
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
              const textColor = dwellTextColor(days)
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
                      color: textColor,
                    }}>
                      {days}<span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>d</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: T.textSecondary }}>
                    <span>{e.cantidad_bultos ?? 0} {(e.cantidad_bultos ?? 0) === 1 ? 'bulto' : 'bultos'}</span>
                    <span>{e.peso_bruto != null ? `${fmtKg(e.peso_bruto)} kg` : '—'}</span>
                  </div>
                  {e.trafico && (
                    <Link href={`/embarques/${encodeURIComponent(e.trafico)}`} style={{
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

      {/* ═══ TAB 3 — KPIs (broker/admin only) ═══ */}
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
