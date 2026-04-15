'use client'

/**
 * ZAPATA AI · V1.5 F10 — Operator performance dashboard UI.
 *
 * Silver glass header, date-range picker (defaults to current month), sortable
 * table with mono on numeric columns. Row click → /admin/operadores/[id].
 * Mobile 375px: cards stacked. 60px tap targets on every interactive row.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  BORDER,
  BORDER_HAIRLINE,
  GLASS_SHADOW,
  SILVER_GRADIENT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import { formatHours, formatPct, type OperatorMetricsRow } from '@/lib/operators/metrics'

type SortKey =
  | 'name'
  | 'traficosHandled'
  | 'avgCycleHours'
  | 'errorRate'
  | 'classificationAccuracy'
  | 'mveComplianceRate'
  | 'lastActiveAt'

function firstOfMonthISO(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return d.toISOString().slice(0, 10)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const MONO = 'var(--font-jetbrains-mono)'
const SANS = 'var(--font-geist-sans)'

export function OperatorsMetricsClient() {
  const router = useRouter()
  const [from, setFrom] = useState(firstOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState<OperatorMetricsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('traficosHandled')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/operadores/metrics?from=${encodeURIComponent(from)}T00:00:00Z&to=${encodeURIComponent(to)}T23:59:59Z`,
        { cache: 'no-store' },
      )
      const body = await res.json()
      if (body.error) {
        setError(body.error.message ?? 'Error de red')
        setRows([])
      } else {
        setRows(body.data?.operators ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      const norm = (v: unknown): number | string => {
        if (v === null || v === undefined) return sortDir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
        if (typeof v === 'number') return v
        return String(v)
      }
      const na = norm(va)
      const nb = norm(vb)
      if (na < nb) return sortDir === 'asc' ? -1 : 1
      if (na > nb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [rows, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  const sortArrow = (k: SortKey) =>
    sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <main
      className="aduana-dark"
      style={{
        padding: 24,
        minHeight: '100vh',
        color: TEXT_PRIMARY,
        maxWidth: 1280,
        margin: '0 auto',
      }}
    >
      <header
        style={{
          background: 'rgba(255,255,255,0.045)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: 20,
          boxShadow: GLASS_SHADOW,
          marginBottom: 16,
        }}
      >
        <h1
          style={{
            fontFamily: SANS,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: 0,
            background: SILVER_GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Desempeño del equipo
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, marginTop: 6, marginBottom: 16 }}>
          Métricas por operador: embarques atendidos, ciclo promedio, tasa de
          error, precisión en clasificación y cumplimiento MVE.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{
                display: 'block',
                marginTop: 6,
                minHeight: 44,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                color: TEXT_PRIMARY,
                fontFamily: MONO,
                fontSize: 'var(--aguila-fs-body)',
              }}
            />
          </label>
          <label style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                display: 'block',
                marginTop: 6,
                minHeight: 44,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                color: TEXT_PRIMARY,
                fontFamily: MONO,
                fontSize: 'var(--aguila-fs-body)',
              }}
            />
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            style={{
              minHeight: 60,
              minWidth: 120,
              padding: '0 20px',
              borderRadius: 14,
              border: `1px solid ${ACCENT_SILVER}`,
              background: SILVER_GRADIENT,
              color: '#0A0A0C',
              fontFamily: SANS,
              fontSize: 'var(--aguila-fs-section)',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
          <div style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED, marginLeft: 'auto', fontFamily: MONO }}>
            {sorted.length} operador{sorted.length === 1 ? '' : 'es'}
          </div>
        </div>
        {error && (
          <p style={{ marginTop: 12, fontSize: 'var(--aguila-fs-body)', color: '#EF4444' }}>{error}</p>
        )}
      </header>

      {sorted.length === 0 && !loading ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop table */}
          <section className="operadores-table" style={{
            background: 'rgba(255,255,255,0.045)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: 8,
            boxShadow: GLASS_SHADOW,
            overflowX: 'auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  {[
                    { k: 'name', label: 'Operador', align: 'left' as const },
                    { k: 'traficosHandled', label: 'Embarques', align: 'right' as const },
                    { k: 'avgCycleHours', label: 'Ciclo prom.', align: 'right' as const },
                    { k: 'errorRate', label: 'Error %', align: 'right' as const },
                    { k: 'classificationAccuracy', label: 'Clasificación %', align: 'right' as const },
                    { k: 'mveComplianceRate', label: 'MVE %', align: 'right' as const },
                    { k: 'lastActiveAt', label: 'Última actividad', align: 'right' as const },
                  ].map((col) => (
                    <th
                      key={col.k}
                      onClick={() => toggleSort(col.k as SortKey)}
                      style={{
                        textAlign: col.align,
                        fontSize: 'var(--aguila-fs-label)',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: TEXT_MUTED,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderBottom: `1px solid ${BORDER_HAIRLINE}`,
                      }}
                    >
                      {col.label}{sortArrow(col.k as SortKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr
                    key={r.operatorId}
                    onClick={() => router.push(`/admin/operadores/${r.operatorId}`)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: `1px solid ${BORDER_HAIRLINE}`,
                      height: 60,
                    }}
                  >
                    <td style={{ padding: '10px 14px', fontFamily: SANS }}>
                      <div style={{ fontWeight: 600, color: TEXT_PRIMARY, fontSize: 'var(--aguila-fs-section)' }}>{r.name}</div>
                      <div style={{ fontSize: 'var(--aguila-fs-meta)', color: ACCENT_SILVER, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {r.role}
                      </div>
                    </td>
                    <td style={cellMono('right')}>{r.traficosHandled}</td>
                    <td style={cellMono('right')}>{formatHours(r.avgCycleHours)}</td>
                    <td style={cellMono('right')}>{formatPct(r.errorRate)}</td>
                    <td style={cellMono('right')}>{formatPct(r.classificationAccuracy)}</td>
                    <td style={cellMono('right')}>{formatPct(r.mveComplianceRate)}</td>
                    <td style={cellMono('right')}>
                      {r.lastActiveAt ? fmtDateTime(r.lastActiveAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Mobile card stack — appears only on <=640 via CSS */}
          <style>{`
            @media (max-width: 640px) {
              .operadores-table { display: none; }
              .operadores-cards { display: grid !important; }
            }
          `}</style>

          <section className="operadores-cards" style={{
            display: 'none',
            gridTemplateColumns: '1fr',
            gap: 12,
            marginTop: 16,
          }}>
            {sorted.map((r) => (
              <button
                type="button"
                key={r.operatorId}
                onClick={() => router.push(`/admin/operadores/${r.operatorId}`)}
                style={{
                  textAlign: 'left',
                  background: 'rgba(255,255,255,0.045)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 20,
                  padding: 16,
                  color: TEXT_PRIMARY,
                  minHeight: 60,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'var(--aguila-fs-body-lg)' }}>{r.name}</div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: ACCENT_SILVER, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  {r.role}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontFamily: MONO, fontSize: 'var(--aguila-fs-body)' }}>
                  <div><span style={{ color: TEXT_MUTED }}>Embarques</span><br />{r.traficosHandled}</div>
                  <div><span style={{ color: TEXT_MUTED }}>Ciclo</span><br />{formatHours(r.avgCycleHours)}</div>
                  <div><span style={{ color: TEXT_MUTED }}>Error</span><br />{formatPct(r.errorRate)}</div>
                  <div><span style={{ color: TEXT_MUTED }}>MVE</span><br />{formatPct(r.mveComplianceRate)}</div>
                </div>
              </button>
            ))}
          </section>
        </>
      )}
    </main>
  )
}

function cellMono(align: 'left' | 'right'): React.CSSProperties {
  return {
    padding: '10px 14px',
    fontFamily: MONO,
    fontSize: 'var(--aguila-fs-body)',
    color: ACCENT_SILVER_BRIGHT,
    textAlign: align,
    whiteSpace: 'nowrap',
  }
}

function EmptyState() {
  return (
    <section
      style={{
        background: 'rgba(255,255,255,0.045)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        padding: 40,
        boxShadow: GLASS_SHADOW,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 'var(--aguila-fs-kpi-large)', marginBottom: 12, opacity: 0.5 }}>○</div>
      <h2 style={{ fontFamily: SANS, fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, margin: 0 }}>
        Sin actividad en el rango seleccionado.
      </h2>
      <p style={{ color: TEXT_SECONDARY, fontSize: 'var(--aguila-fs-body)', marginTop: 8 }}>
        Ajusta las fechas o verifica que tu equipo esté registrando acciones.
      </p>
    </section>
  )
}
