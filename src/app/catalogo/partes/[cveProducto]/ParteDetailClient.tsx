'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GlassCard } from '@/components/aguila/GlassCard'

export interface DetailPayload {
  parte: {
    cve_producto: string
    descripcion: string | null
    descripcion_ingles: string | null
    fraccion: string | null
    fraccion_formatted: string | null
    nico: string | null
    umt: string | null
    pais_origen: string | null
    marca: string | null
    precio_unitario: number | null
    fraccion_classified_at: string | null
    fraccion_source: string | null
    created_at: string | null
    tmec_eligible: boolean
    times_used_24mo: number
    times_used_lifetime: number
    last_used_at: string | null
  }
  classifications: Array<{
    numero_parte: string | null
    clave_insumo: string | null
    fraccion_assigned: string | null
    think_confidence: number | null
    supertito_agreed: boolean | null
    supertito_correction: string | null
    ts: string | null
  }>
  ocas: Array<{
    id: string | number
    fraccion: string | null
    legal_reasoning: string | null
    approved_by: string | null
    last_used: string | null
    use_count: number | null
    alternative_fracciones: string[] | null
    created_at: string | null
  }>
  uses_timeline: Array<{
    created_at: string | null
    trafico_ref: string | null
    cantidad: number | null
    umt: string | null
    precio_unitario: number | null
    proveedor_clave: string | null
  }>
  proveedores: Array<{
    clave: string
    nombre: string | null
    uses: number
    avg_price: number | null
    last_use: string | null
  }>
  cost_trend: Array<{
    month: string
    avg_price: number
    uses: number
  }>
  supertito_stats?: { agreed: number; corrections: number; total: number }
}

type TabId = 'historia' | 'clasificacion' | 'proveedores' | 'costos'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'historia', label: 'Historia de uso' },
  { id: 'clasificacion', label: 'Clasificación y OCA' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'costos', label: 'Tendencia de costos' },
]

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
function fmtInt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-MX')
}
function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago' })
  } catch { return '' }
}
function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (isNaN(ms)) return null
  return Math.max(0, Math.floor(ms / 86_400_000))
}

export function ParteDetailClient({
  data,
  role,
  formattedFraccion,
}: {
  data: DetailPayload
  role: string
  formattedFraccion: string | null
}) {
  const [active, setActive] = useState<TabId>('historia')

  // Quick stats
  const avgProveedorPrice = data.proveedores.length
    ? data.proveedores.reduce((a, p) => a + (p.avg_price || 0), 0) / Math.max(1, data.proveedores.filter((p) => p.avg_price != null).length)
    : null
  const lastDays = daysSince(data.parte.last_used_at)
  const metaLine = data.parte.times_used_24mo > 0
    ? `Usada ${data.parte.times_used_24mo}× en 24 meses${lastDays !== null ? ` · última hace ${lastDays} día${lastDays === 1 ? '' : 's'}` : ''}`
    : 'Sin uso registrado en los últimos 24 meses'

  return (
    <>
      <p style={{ margin: '0 0 16px', fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.6)' }}>
        {metaLine}
      </p>

      {/* 4 stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard label="Usos" value={fmtInt(data.parte.times_used_24mo)} sublabel="últimos 24 meses" />
        <StatCard label="Valor promedio" value={fmtUsd(avgProveedorPrice)} sublabel="USD por unidad" />
        <StatCard label="OCA" value={String(data.ocas.length)} sublabel="opiniones firmadas" />
        <StatCard label="Proveedores" value={String(data.proveedores.length)} sublabel="han suministrado" />
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 16,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            style={{
              minHeight: 60,
              padding: '0 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: active === t.id ? '2px solid var(--portal-gold-500)' : '2px solid transparent',
              color: active === t.id ? 'var(--portal-fg-1)' : 'rgba(255,255,255,0.6)',
              fontSize: 'var(--aguila-fs-section)',
              fontWeight: active === t.id ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'historia' && <HistoryTab data={data} />}
      {active === 'clasificacion' && <ClassificationTab data={data} formattedFraccion={formattedFraccion} />}
      {active === 'proveedores' && <ProveedoresTab data={data} />}
      {active === 'costos' && <CostosTab data={data} />}

      {/* Action bar */}
      <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {role === 'client' && (
          <button
            style={{
              minHeight: 60,
              padding: '0 24px',
              borderRadius: 12,
              background: 'rgba(192,197,206,0.12)',
              border: '1px solid rgba(192,197,206,0.3)',
              color: 'var(--portal-fg-1)',
              fontSize: 'var(--aguila-fs-section)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => {
              // TODO: open mensajeria thread prefilled with this parte. For
              // now, link to mensajeria with a query hint.
              window.location.href = `/mensajeria?about=parte:${encodeURIComponent(data.parte.cve_producto)}`
            }}
          >
            Contactar sobre esta parte
          </button>
        )}
        {(role === 'broker' || role === 'admin') && data.parte.fraccion && (
          <Link
            href={`/oca/nuevo?fraccion=${encodeURIComponent(data.parte.fraccion)}&cve=${encodeURIComponent(data.parte.cve_producto)}`}
            style={{
              minHeight: 60,
              padding: '0 24px',
              borderRadius: 12,
              background: 'rgba(234,179,8,0.12)',
              border: '1px solid rgba(234,179,8,0.3)',
              color: 'var(--portal-status-amber-fg)',
              fontSize: 'var(--aguila-fs-section)',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Generar OCA nuevo →
          </Link>
        )}
      </div>
    </>
  )
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <GlassCard padding="12px 16px">
      <div>
        <p style={{ margin: 0, fontSize: 'var(--aguila-fs-label)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>{label}</p>
        <p className="font-mono" style={{ margin: '4px 0 2px', fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--portal-fg-1)' }}>{value}</p>
        {sublabel && <p style={{ margin: 0, fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.5)' }}>{sublabel}</p>}
      </div>
    </GlassCard>
  )
}

function HistoryTab({ data }: { data: DetailPayload }) {
  if (!data.uses_timeline.length) {
    return (
      <GlassCard padding="20px">
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)' }}>Sin registros de uso aún.</p>
      </GlassCard>
    )
  }
  return (
    <GlassCard padding="0">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--aguila-fs-body)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Th>Fecha</Th>
              <Th>Tráfico</Th>
              <Th align="right">Cantidad</Th>
              <Th align="right">Valor U. USD</Th>
              <Th>Proveedor</Th>
            </tr>
          </thead>
          <tbody>
            {data.uses_timeline.map((u, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <Td>{fmtDate(u.created_at)}</Td>
                <Td>{u.trafico_ref ? (
                  <Link href={`/embarques/${encodeURIComponent(u.trafico_ref)}`} className="font-mono" style={{ color: 'var(--portal-status-amber-fg)', textDecoration: 'none' }}>
                    {u.trafico_ref}
                  </Link>
                ) : '—'}</Td>
                <Td align="right" mono>{fmtInt(u.cantidad)}{u.umt ? ` ${u.umt}` : ''}</Td>
                <Td align="right" mono>{fmtUsd(u.precio_unitario)}</Td>
                <Td mono>{u.proveedor_clave || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

function ClassificationTab({ data, formattedFraccion }: { data: DetailPayload; formattedFraccion: string | null }) {
  const hasClassifications = data.classifications.length > 0
  const hasOcas = data.ocas.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Classifications section */}
      <section>
        <h2 style={{ margin: '0 0 10px', fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.02em' }}>
          Historial de clasificación
        </h2>
        {!hasClassifications ? (
          <GlassCard padding="16px">
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: 'var(--aguila-fs-body)' }}>
              Sin clasificaciones registradas para esta parte.
            </p>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.classifications.map((c, i) => (
              <GlassCard key={i} padding="14px 16px">
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{/* WHY: intermediate meta (between label-10 and meta-11) */}
                      {c.ts ? fmtDate(c.ts) : '—'}
                    </p>
                    <p className="font-mono" style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: 'var(--portal-status-amber-fg)' }}>{/* WHY: fraccion emphasis value between body-13 and kpi-small-18 */}
                      {c.fraccion_assigned || '—'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {typeof c.think_confidence === 'number' && (
                      <p style={{ margin: 0, fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.55)' }}>
                        Confianza: <span className="font-mono">{Math.round(c.think_confidence * 100)}%</span>
                      </p>
                    )}
                    {c.supertito_agreed === true && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--portal-status-green-fg)', fontWeight: 700 }}>{/* WHY: intermediate meta for inline supertito signal */}
                        ✓ Tito de acuerdo
                      </p>
                    )}
                    {c.supertito_correction && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--portal-status-red-fg)' }}>{/* WHY: intermediate meta for inline supertito correction */}
                        ✗ Tito corrigió a <span className="font-mono">{c.supertito_correction}</span>
                      </p>
                    )}
                    {c.supertito_agreed === null && !c.supertito_correction && (
                      <p style={{ margin: '4px 0 0', fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.4)' }}>
                        Pendiente de revisión
                      </p>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      {/* OCAs section */}
      <section>
        <h2 style={{ margin: '0 0 10px', fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.02em' }}>
          Opiniones de Clasificación Arancelaria
        </h2>
        {!hasOcas ? (
          <GlassCard padding="16px" style={{ borderColor: 'var(--portal-status-amber-ring)', background: 'rgba(251,191,36,0.04)' }}>
            <p style={{ margin: 0, color: 'var(--portal-status-amber-fg)', fontSize: 'var(--aguila-fs-body)', fontWeight: 600 }}>
              {formattedFraccion
                ? `La fracción ${formattedFraccion} no tiene OCA firmada para EVCO.`
                : 'Esta parte aún no tiene fracción clasificada.'}
            </p>
            <p style={{ margin: '6px 0 0', color: 'rgba(252,211,77,0.75)', fontSize: 12 }}>{/* WHY: intermediate meta paired with body-13 primary line */}
              Contacta a tu agente aduanal para generar una.
            </p>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.ocas.map((o) => (
              <OCACard key={o.id} oca={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function OCACard({ oca }: { oca: DetailPayload['ocas'][number] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <GlassCard padding="14px 16px">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="font-mono" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--portal-status-amber-fg)' }}>{/* WHY: fraccion emphasis value between body-13 and kpi-small-18 */}
            {oca.fraccion}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{/* WHY: intermediate meta for OCA provenance line */}
            {oca.approved_by ? `Firmada por ${oca.approved_by}` : 'Firma pendiente'}
            {oca.last_used && ` · último uso ${fmtDate(oca.last_used)}`}
            {typeof oca.use_count === 'number' && ` · ${oca.use_count} usos`}
          </p>
          {oca.alternative_fracciones && oca.alternative_fracciones.length > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.5)' }}>
              Fracciones alternativas consideradas: <span className="font-mono">{oca.alternative_fracciones.join(', ')}</span>
            </p>
          )}
        </div>
      </div>
      {oca.legal_reasoning && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              marginTop: 12,
              minHeight: 44,
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.75)',
              fontSize: 12, // WHY: intermediate meta for inline expand/collapse control
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {expanded ? '− Ocultar razonamiento' : '+ Razonamiento legal'}
          </button>
          {expanded && (
            <p style={{ marginTop: 12, fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {oca.legal_reasoning}
            </p>
          )}
        </>
      )}
    </GlassCard>
  )
}

function ProveedoresTab({ data }: { data: DetailPayload }) {
  if (!data.proveedores.length) {
    return (
      <GlassCard padding="20px">
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)' }}>Sin registros de proveedor para esta parte.</p>
      </GlassCard>
    )
  }
  const maxUses = data.proveedores.reduce((m, p) => Math.max(m, p.uses), 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.proveedores.map((p) => {
        const barPct = maxUses > 0 ? Math.max(10, Math.round((p.uses / maxUses) * 100)) : 0
        return (
          <GlassCard key={p.clave} padding="14px 16px">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <p className="font-mono" style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{/* WHY: intermediate meta for supplier clave code */}
                  {p.clave}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
                  {p.nombre || p.clave}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{/* WHY: intermediate meta for supplier stats line */}
                  {p.uses}× · {p.avg_price != null ? `prom. ${fmtUsd(p.avg_price)}` : 'sin precio'}
                  {p.last_use && ` · último ${fmtDate(p.last_use)}`}
                </p>
              </div>
              <div style={{ flex: '0 0 100px' }}>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${barPct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, rgba(192,197,206,0.3), rgba(192,197,206,0.6))',
                    }}
                  />
                </div>
              </div>
            </div>
          </GlassCard>
        )
      })}
    </div>
  )
}

function CostosTab({ data }: { data: DetailPayload }) {
  if (!data.cost_trend.length) {
    return (
      <GlassCard padding="20px">
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)' }}>Sin datos de costo suficientes para los últimos 12 meses.</p>
      </GlassCard>
    )
  }
  const prices = data.cost_trend.map((c) => c.avg_price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length

  // Variation check: last 6 vs prior 6
  let variationPct = 0
  if (data.cost_trend.length >= 6) {
    const half = Math.floor(data.cost_trend.length / 2)
    const recentPrices = data.cost_trend.slice(-half)
    const olderPrices = data.cost_trend.slice(0, half)
    const recentAvg = recentPrices.reduce((a, b) => a + b.avg_price, 0) / recentPrices.length
    const olderAvg = olderPrices.reduce((a, b) => a + b.avg_price, 0) / olderPrices.length
    if (olderAvg > 0) variationPct = Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
  }
  const alertVariation = Math.abs(variationPct) >= 20

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {alertVariation && (
        <GlassCard padding="12px 16px" style={{ borderColor: 'rgba(251,191,36,0.28)', background: 'rgba(251,191,36,0.04)' }}>
          <p style={{ margin: 0, color: 'var(--portal-status-amber-fg)', fontSize: 'var(--aguila-fs-body)', fontWeight: 600 }}>
            El costo unitario ha {variationPct > 0 ? 'aumentado' : 'bajado'} un {Math.abs(variationPct)}% en los últimos 6 meses. Revisa con tu comprador.
          </p>
        </GlassCard>
      )}

      {/* Simple line chart — drawn with SVG polyline for zero dependencies */}
      <GlassCard padding="16px">
        <MiniLineChart series={data.cost_trend} />
      </GlassCard>

      <GlassCard padding="14px 16px">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
          <StatInline label="Mínimo" value={fmtUsd(min)} />
          <StatInline label="Máximo" value={fmtUsd(max)} />
          <StatInline label="Promedio" value={fmtUsd(avg)} />
          <StatInline label="Variación" value={`${variationPct >= 0 ? '+' : ''}${variationPct}%`} tone={alertVariation ? 'amber' : undefined} />
        </div>
      </GlassCard>
    </div>
  )
}

function MiniLineChart({ series }: { series: DetailPayload['cost_trend'] }) {
  if (series.length < 2) {
    return (
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12 /* WHY: intermediate meta for chart fallback hint */ }}>
        Necesitamos al menos 2 meses de datos.
      </p>
    )
  }
  const w = 600
  const h = 140
  const pad = 24
  const min = Math.min(...series.map((s) => s.avg_price))
  const max = Math.max(...series.map((s) => s.avg_price))
  const range = Math.max(1, max - min)
  const xStep = (w - 2 * pad) / Math.max(1, series.length - 1)
  const points = series.map((s, i) => {
    const x = pad + i * xStep
    const y = h - pad - ((s.avg_price - min) / range) * (h - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tendencia mensual del costo">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--portal-fg-3)"
        strokeWidth="2"
      />
      {series.map((s, i) => {
        const x = pad + i * xStep
        const y = h - pad - ((s.avg_price - min) / range) * (h - 2 * pad)
        return <circle key={i} cx={x} cy={y} r={3} fill="var(--portal-fg-3)" />
      })}
      {series.map((s, i) => {
        if (i % 2 !== 0 && i !== series.length - 1) return null
        const x = pad + i * xStep
        return (
          <text key={`l-${i}`} x={x} y={h - 6} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">
            {s.month.slice(5)}
          </text>
        )
      })}
    </svg>
  )
}

function StatInline({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 'var(--aguila-fs-label)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>{label}</p>
      <p className="font-mono" style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: tone === 'amber' ? 'var(--portal-status-amber-fg)' : 'var(--portal-fg-1)' }}>{value}</p>{/* WHY: stat-inline emphasis value between body-13 and kpi-small-18 */}
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{ padding: '10px 12px', textAlign: align, fontSize: 'var(--aguila-fs-label)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left', mono = false }: { children: React.ReactNode; align?: 'left' | 'right'; mono?: boolean }) {
  return (
    <td className={mono ? 'font-mono' : undefined} style={{ padding: '10px 12px', textAlign: align, fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.85)' }}>
      {children}
    </td>
  )
}
