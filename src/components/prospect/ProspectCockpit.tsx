/**
 * ProspectCockpit — the prospect-facing surface at /prospect/[token].
 *
 * Renders an importer-of-record dashboard for a prospect using public
 * Aduana 240 records (aggregated by src/lib/prospect-data.ts). Honest by
 * design: shows only verifiable signals, never synthesizes data, frames
 * everything as "vista preliminar basada en registros públicos."
 *
 * Composition discipline:
 *   - Wraps in <PageShell> (auto-renders AguilaFooter + atmospheric aura).
 *   - All glass surfaces compose from <GlassCard> — no inline glass
 *     chemistry (core-invariants rule 26).
 *   - Numeric values use Geist Mono via .portal-num + tabular-nums
 *     (design-system "los números son el producto").
 *   - 60px touch target on the conversion CTA (3 AM Driver standard).
 *   - Spanish primary; sender identity is "Renato Zapata & Company".
 */

'use client'

import { useMemo } from 'react'
import { PageShell } from '@/components/aguila/PageShell'
import { GlassCard } from '@/components/aguila/GlassCard'
import { Sparkline } from '@/components/aguila/Sparkline'
import { ProspectCTA } from './ProspectCTA'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  GREEN,
} from '@/lib/design-system'
import {
  buildMonthlySparkline,
  type ProspectData,
} from '@/lib/prospect-data'

interface Props {
  data: ProspectData
  token: string
}

const MONO = 'var(--portal-font-mono), Geist Mono, monospace'
const HIGHLIGHT_GREEN_SOFT = 'rgba(134,239,172,0.95)' // mint accent for "Patente nuestra" cell

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function fmtInt(n: number): string {
  return n.toLocaleString('es-MX')
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

function fmtMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
}

const KPI_LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--aguila-fs-label, 10px)',
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: ACCENT_SILVER_DIM,
  margin: 0,
}

const KPI_NUMBER_STYLE: React.CSSProperties = {
  fontFamily: MONO,
  fontWeight: 800,
  fontSize: 36, // WHY: between kpi-compact (32) and kpi-hero (48) — prospect tile density needs the in-between step.
  letterSpacing: '-0.02em',
  color: ACCENT_SILVER_BRIGHT,
  margin: '4px 0 2px',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
}

const KPI_SUBLABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--aguila-fs-meta, 11px)',
  color: ACCENT_SILVER,
  margin: 0,
}

export function ProspectCockpit({ data, token: _token }: Props) {
  const sparkSeries = useMemo(() => buildMonthlySparkline(data.monthly), [data.monthly])
  const monthsRange = useMemo(() => {
    const out: string[] = []
    const anchor = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1))
      out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    }
    return out
  }, [])

  const headerSubtitle = data.razon_social
    ? `RFC ${data.rfc} · Vista preliminar basada en registros públicos de Aduana 240`
    : `RFC ${data.rfc}`

  const currentBrokerLabel = data.primary_patente_is_us
    ? 'Patente 3596 (nosotros)'
    : data.primary_patente
      ? `Patente ${data.primary_patente}`
      : 'No identificado'

  const currentBrokerSub = data.primary_patente_is_us
    ? 'Ya operamos para ti'
    : 'Ya tenemos visibilidad de tus cruces'

  return (
    <PageShell
      title={data.razon_social || 'Vista preliminar'}
      subtitle={headerSubtitle}
      systemStatus="healthy"
      pulseSignal={false}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Honesty banner — sets the framing before any number renders */}
        <GlassCard tier="secondary" padding={16}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <span
              aria-hidden
              style={{
                width: 6, height: 6, borderRadius: '50%', background: GREEN,
                marginTop: 8, boxShadow: '0 0 8px rgba(34,197,94,0.45)',
              }}
              className="aguila-dot-pulse"
            />
            <div style={{ flex: 1, minWidth: 240 }}>
              <p style={{
                fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER_DIM, margin: 0,
                letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
              }}>
                Renato Zapata &amp; Company · Patente 3596
              </p>
              <p style={{
                fontSize: 'var(--aguila-fs-section, 14px)', color: ACCENT_SILVER_BRIGHT,
                margin: '4px 0 0', lineHeight: 1.5,
              }}>
                Esto es lo que ya sabemos sobre tu operación a partir de los
                registros públicos de Aduana 240. Cuando trabajemos juntos,
                cada número se vuelve tuyo en tiempo real.
              </p>
            </div>
          </div>
        </GlassCard>

        {/* 4-tile KPI hero — pedimentos, valor, suplidores, agente actual */}
        <div style={{
          display: 'grid', gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          marginTop: 16,
        }}>
          <GlassCard tier="hero" padding={20}>
            <p style={KPI_LABEL_STYLE}>Pedimentos</p>
            <p style={KPI_NUMBER_STYLE}>{fmtInt(data.total_pedimentos)}</p>
            <p style={KPI_SUBLABEL_STYLE}>
              {data.months_active} {data.months_active === 1 ? 'mes' : 'meses'} con actividad
            </p>
            <div style={{ marginTop: 10 }}>
              <Sparkline data={sparkSeries} tone="silver" height={28} ariaLabel="Pedimentos por mes (últimos 12)" />
            </div>
          </GlassCard>

          <GlassCard tier="hero" padding={20}>
            <p style={KPI_LABEL_STYLE}>Valor importado</p>
            <p style={KPI_NUMBER_STYLE}>{fmtUSD(data.total_valor_usd)}</p>
            <p style={KPI_SUBLABEL_STYLE}>
              USD · promedio {fmtUSD(data.avg_valor_per_pedimento)} por pedimento
            </p>
          </GlassCard>

          <GlassCard tier="hero" padding={20}>
            <p style={KPI_LABEL_STYLE}>Suplidores</p>
            <p style={KPI_NUMBER_STYLE}>{fmtInt(data.top_suppliers.length)}</p>
            <p style={KPI_SUBLABEL_STYLE}>
              {data.top_suppliers.length > 0 ? `Principal: ${data.top_suppliers[0].name.slice(0, 28)}` : 'Sin suplidores identificados'}
            </p>
          </GlassCard>

          <GlassCard tier="hero" padding={20}>
            <p style={KPI_LABEL_STYLE}>Agente actual</p>
            <p style={{
              ...KPI_NUMBER_STYLE,
              // WHY: broker label may be longer than other tile values; use kpi-mid
              // (28) for "Patente 3596 (nosotros)" so it doesn't wrap on mobile.
              fontSize: data.primary_patente ? 'var(--aguila-fs-kpi-mid, 28px)' : 'var(--aguila-fs-headline, 20px)',
            }}>
              {currentBrokerLabel}
            </p>
            <p style={KPI_SUBLABEL_STYLE}>{currentBrokerSub}</p>
          </GlassCard>
        </div>

        {/* Suppliers + monthly volume — two-column on desktop */}
        <div style={{
          display: 'grid', gap: 16, marginTop: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        }}>
          {/* Top suppliers */}
          <GlassCard tier="hero" padding={20}>
            <p style={KPI_LABEL_STYLE}>Tus 5 suplidores principales</p>
            {data.top_suppliers.length === 0 ? (
              <p style={{ color: ACCENT_SILVER_DIM, fontSize: 'var(--aguila-fs-body, 13px)', margin: '12px 0 0' }}>
                Sin suplidores identificados en los registros disponibles.
              </p>
            ) : (
              <div style={{ marginTop: 12 }}>
                {data.top_suppliers.map((s, idx) => (
                  <div
                    key={s.name + idx}
                    style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                      gap: 12, padding: '10px 0',
                      borderBottom: idx < data.top_suppliers.length - 1 ? '1px solid var(--portal-line-1)' : 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: 'var(--aguila-fs-body, 13px)', color: ACCENT_SILVER_BRIGHT, fontWeight: 600,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {s.name}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER_DIM }}>
                        Última operación: {fmtDate(s.last_seen)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{
                        margin: 0, fontFamily: MONO, fontSize: 'var(--aguila-fs-section, 14px)', fontWeight: 700,
                        color: ACCENT_SILVER_BRIGHT, fontVariantNumeric: 'tabular-nums',
                      }}>
                        {fmtInt(s.shipments)}
                      </p>
                      <p style={{
                        margin: '2px 0 0', fontFamily: MONO, fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {fmtUSD(s.total_usd)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Monthly volume — same series as the hero sparkline, expanded */}
          <GlassCard tier="hero" padding={20}>
            <p style={KPI_LABEL_STYLE}>Pedimentos por mes · últimos 12</p>
            <div style={{ marginTop: 14 }}>
              <Sparkline data={sparkSeries} tone="silver" height={64} ariaLabel="Volumen mensual de pedimentos" />
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, marginTop: 8,
            }}>
              {monthsRange.map((m, i) => (
                <span
                  key={m}
                  style={{
                    fontFamily: MONO, fontSize: 9 /* WHY: caption-of-caption under sparkline, smaller than fs-label (10) */, color: ACCENT_SILVER_DIM, textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title={`${m}: ${sparkSeries[i]} pedimentos`}
                >
                  {fmtMonthLabel(m)}
                </span>
              ))}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 12,
              borderTop: '1px solid var(--portal-line-1)',
            }}>
              <div>
                {/* WHY: 9px ultra-meta label — pairs with the 9px sparkline-axis caption above. */}
                <p style={{ ...KPI_LABEL_STYLE, fontSize: 9 /* WHY: ultra-meta caption pairs with sparkline-axis label */ }}>Primer registro</p>
                <p style={{ fontFamily: MONO, fontSize: 'var(--aguila-fs-body, 13px)', color: ACCENT_SILVER_BRIGHT, margin: '2px 0 0' }}>
                  {fmtDate(data.first_seen)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {/* WHY: 9px ultra-meta label — pairs with sibling above. */}
                <p style={{ ...KPI_LABEL_STYLE, fontSize: 9 /* WHY: pairs with sibling caption */ }}>Última operación</p>
                <p style={{ fontFamily: MONO, fontSize: 'var(--aguila-fs-body, 13px)', color: ACCENT_SILVER_BRIGHT, margin: '2px 0 0' }}>
                  {fmtDate(data.last_seen)}
                </p>
              </div>
              {data.avg_days_between !== null ? (
                <div style={{ textAlign: 'right' }}>
                  {/* WHY: 9px ultra-meta label — pairs with siblings. */}
                  <p style={{ ...KPI_LABEL_STYLE, fontSize: 9 /* WHY: pairs with sibling caption */ }}>Frecuencia</p>
                  <p style={{ fontFamily: MONO, fontSize: 'var(--aguila-fs-body, 13px)', color: ACCENT_SILVER_BRIGHT, margin: '2px 0 0' }}>
                    1 cada {data.avg_days_between} días
                  </p>
                </div>
              ) : null}
            </div>
          </GlassCard>
        </div>

        {/* Recent operations — proves we have RFC-keyed truth */}
        {data.recent_facturas.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <GlassCard tier="hero" padding={20}>
              <p style={KPI_LABEL_STYLE}>Operaciones recientes</p>
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--aguila-fs-compact, 12px)' }}>
                  <thead>
                    <tr style={{ color: ACCENT_SILVER_DIM, textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label, 10px)' }}>
                        Fecha
                      </th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label, 10px)' }}>
                        Pedimento
                      </th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label, 10px)' }}>
                        Suplidor
                      </th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label, 10px)', textAlign: 'right' }}>
                        Valor USD
                      </th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label, 10px)' }}>
                        Patente
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_facturas.map((f, idx) => (
                      <tr
                        key={(f.pedimento || '') + idx}
                        style={{ borderTop: '1px solid var(--portal-line-1)' }}
                      >
                        <td style={{ padding: '10px', fontFamily: MONO, color: ACCENT_SILVER, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDate(f.fecha_pago)}
                        </td>
                        <td style={{ padding: '10px', fontFamily: MONO, color: ACCENT_SILVER_BRIGHT, fontVariantNumeric: 'tabular-nums' }}>
                          {f.pedimento || '—'}
                        </td>
                        <td style={{ padding: '10px', color: ACCENT_SILVER, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.proveedor || '—'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: MONO, color: ACCENT_SILVER_BRIGHT, fontVariantNumeric: 'tabular-nums' }}>
                          {f.valor_usd ? fmtUSD(f.valor_usd) : '—'}
                        </td>
                        <td style={{ padding: '10px', fontFamily: MONO, color: f.patente === '3596' ? HIGHLIGHT_GREEN_SOFT : ACCENT_SILVER, fontVariantNumeric: 'tabular-nums' }}>
                          {f.patente || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...KPI_SUBLABEL_STYLE, marginTop: 10 }}>
                Mostrando {data.recent_facturas.length} de {fmtInt(data.total_pedimentos)} operaciones registradas.
              </p>
            </GlassCard>
          </div>
        ) : null}

        {/* Conversion CTA — silver gradient, 60px touch target */}
        <div style={{ marginTop: 16 }}>
          <ProspectCTA rfc={data.rfc} razonSocial={data.razon_social} token={_token} />
        </div>

        {/* Tito's signature — humanizes the surface */}
        <p style={{
          marginTop: 24, marginBottom: 0, textAlign: 'center', fontSize: 'var(--aguila-fs-meta, 11px)',
          color: ACCENT_SILVER_DIM, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
        }}>
          Renato Zapata III · Director General
        </p>
        <p style={{
          // WHY: 10px caption sits below identity name; matches AguilaFooter weight progression.
          marginTop: 4, textAlign: 'center', fontSize: 'var(--aguila-fs-label, 10px)', color: ACCENT_SILVER_DIM,
        }}>
          Generado {fmtDate(data.generated_at)} · Vigencia 7 días
        </p>
      </div>
    </PageShell>
  )
}
