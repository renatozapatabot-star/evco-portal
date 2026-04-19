/**
 * PORTAL · /admin/revenue — Tito's revenue cockpit.
 *
 * Owner-tier (admin/broker only). Aggregates pedimento counts + estimated
 * broker fees across ALL tenants under Patente 3596. Never visible to
 * client tenants — gated by the same role check used in /admin/eagle.
 *
 * Counts are real (pedimentos table is fresh). Fees are ESTIMATED at
 * $125 USD standard / $400 USD IMMEX until Anabel's eConta sync is
 * caught up; the banner makes that explicit.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { getExchangeRate } from '@/lib/rates'
import { getRevenueDashboard } from '@/lib/revenue/aggregate'
import { GlassCard, SectionHeader, KPITile, Sparkline, CockpitSkeleton, PageShell, CockpitBanner } from '@/components/aguila'
import { RevenueLineChart } from '@/components/admin/RevenueLineChart'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function fmtMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount)
}
function fmtNumber(n: number): string {
  return new Intl.NumberFormat('es-MX').format(Math.round(n))
}
function fmtPct(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—'
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}
const MES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
function fmtMonthLong(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MES_ES[(m - 1) % 12]} ${y}`
}

export default async function RevenuePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <RevenueContent />
    </Suspense>
  )
}

async function RevenueContent() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Exchange rate is required for USD→MXN conversion. Per CLAUDE.md, if expired
  // we fail loud rather than silently fall back; the page still renders with
  // an explicit error tile so Tito sees the cause.
  let exchangeRate = 20
  let exchangeRateError: string | null = null
  try {
    const r = await getExchangeRate()
    exchangeRate = r.rate
  } catch (e) {
    exchangeRateError = e instanceof Error ? e.message : String(e)
  }

  const data = await getRevenueDashboard(supabase, exchangeRate)
  const currentMonth = data.months[data.months.length - 1]
  const priorMonth = data.months[data.months.length - 2]
  const ymCurrent = currentMonth.month
  const monthLabel = fmtMonthLong(ymCurrent)

  const sparkCounts = data.months.slice(-7).map(m => m.pedimentoCount)
  const sparkRevenue = data.months.slice(-7).map(m => m.estimatedFeeMXN)

  return (
    <PageShell
      title="Ingresos · Patente 3596"
      subtitle={`Resumen de pedimentos e ingresos estimados · ${monthLabel}`}
      brandHeader={<CockpitBanner role="owner" name="TITO" />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aguila-gap-section, 32px)' }}>

        {/* Estimator banner */}
        {data.estimatorBannerMode !== 'hide' && (
          <GlassCard tier="secondary">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
              <span style={{ fontSize: 'var(--aguila-fs-label, 10px)', letterSpacing: 'var(--aguila-ls-label, 0.08em)', textTransform: 'uppercase', color: 'var(--portal-amber)' }}>
                Cifras estimadas
              </span>
              <p style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: 'var(--portal-fg-2)', margin: 0, lineHeight: 1.5 }}>
                Estimación basada en <strong>$125 USD/pedimento estándar</strong> y{' '}
                <strong>$400 USD/pedimento IMMEX</strong>, convertido a MXN al tipo de cambio{' '}
                <span style={{ fontFamily: 'var(--portal-font-mono)' }}>{exchangeRate.toFixed(4)}</span>.
                {data.mostRecentRealFeeMonth ? (
                  <> Datos reales de eConta llegan hasta <strong>{fmtMonthLong(data.mostRecentRealFeeMonth)}</strong>. Anabel está cargando facturación reciente para cuadrar cifras exactas.</>
                ) : (
                  <> Sin datos reales de eConta en los últimos 12 meses. Anabel está cargando facturación para cuadrar cifras exactas.</>
                )}
              </p>
            </div>
          </GlassCard>
        )}

        {exchangeRateError && (
          <GlassCard tier="secondary" severity="warning">
            <div style={{ padding: 4 }}>
              <span style={{ fontSize: 'var(--aguila-fs-label, 10px)', letterSpacing: 'var(--aguila-ls-label, 0.08em)', textTransform: 'uppercase', color: 'var(--portal-amber)' }}>
                Tipo de cambio
              </span>
              <p style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: 'var(--portal-fg-2)', margin: 0 }}>
                Usando tipo de cambio fallback {exchangeRate.toFixed(4)}: {exchangeRateError}
              </p>
            </div>
          </GlassCard>
        )}

        {/* Hero KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--aguila-gap-card, 16px)' }}>
          <KPITile
            label={`Pedimentos · ${monthLabel}`}
            value={fmtNumber(currentMonth.pedimentoCount)}
            sublabel={`${fmtNumber(currentMonth.pedimentoCountImmex)} IMMEX · ${fmtNumber(currentMonth.pedimentoCountStandard)} estándar`}
            series={sparkCounts}
            current={currentMonth.pedimentoCount}
            previous={priorMonth?.pedimentoCount ?? 0}
            tone="silver"
          />
          <KPITile
            label="Ingresos estimados (MXN)"
            value={fmtMXN(currentMonth.estimatedFeeMXN)}
            sublabel={`Mes anterior: ${fmtMXN(priorMonth?.estimatedFeeMXN ?? 0)}`}
            series={sparkRevenue}
            current={currentMonth.estimatedFeeMXN}
            previous={priorMonth?.estimatedFeeMXN ?? 0}
            tone="silver"
          />
          <KPITile
            label="Ingresos estimados (USD)"
            value={`$${fmtNumber(currentMonth.estimatedFeeUSD)}`}
            sublabel={`@ ${exchangeRate.toFixed(2)} MXN/USD`}
            series={data.months.slice(-7).map(m => m.estimatedFeeUSD)}
            current={currentMonth.estimatedFeeUSD}
            previous={priorMonth?.estimatedFeeUSD ?? 0}
            tone="silver"
          />
          <KPITile
            label="Cobertura datos reales"
            value={`${data.realFeeCoveragePct.toFixed(0)}%`}
            sublabel={data.mostRecentRealFeeMonth ? `Más reciente: ${fmtMonthLong(data.mostRecentRealFeeMonth)}` : 'Sin datos eConta'}
            tone={data.estimatorBannerMode === 'hide' ? 'green' : data.estimatorBannerMode === 'inform' ? 'amber' : 'red'}
          />
        </div>

        {/* 12-month line charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 'var(--aguila-gap-card, 16px)' }}>
          <GlassCard tier="hero">
            <SectionHeader title="Pedimentos · últimos 12 meses" />
            <div style={{ marginTop: 12 }}>
              <RevenueLineChart
                data={data.months.map(m => ({ month: m.month, count: m.pedimentoCount, estimatedMXN: m.estimatedFeeMXN, realMXN: m.realFeeMXN }))}
                metric="count"
                height={240}
              />
            </div>
          </GlassCard>
          <GlassCard tier="hero">
            <SectionHeader title="Ingresos estimados (MXN) · últimos 12 meses" />
            <div style={{ marginTop: 4, marginBottom: 8, fontSize: 11, color: 'var(--portal-fg-3)' }}>Línea continua: estimación · línea verde: real cuando hay datos eConta</div>
            <div style={{ marginTop: 12 }}>
              <RevenueLineChart
                data={data.months.map(m => ({ month: m.month, count: m.pedimentoCount, estimatedMXN: m.estimatedFeeMXN, realMXN: m.realFeeMXN }))}
                metric="revenue"
                height={240}
              />
            </div>
          </GlassCard>
        </div>

        {/* Top 10 by revenue this month */}
        <GlassCard tier="secondary">
          <SectionHeader title={`Top 10 clientes por ingresos · ${monthLabel}`} count={data.topByRevenueThisMonth.length} />
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--aguila-fs-body, 13px)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(192,197,206,0.18)', color: 'var(--portal-fg-3)', textAlign: 'left' }}>
                  <th style={th()}>#</th>
                  <th style={th()}>Cliente</th>
                  <th style={th('right')}>Pedimentos</th>
                  <th style={th('right')}>Estimado MXN</th>
                  <th style={th('right')}>Real MXN</th>
                  <th style={th('right')}>vs mes ant.</th>
                  <th style={th('right')}>vs mismo mes año ant.</th>
                </tr>
              </thead>
              <tbody>
                {data.topByRevenueThisMonth.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--portal-fg-3)' }}>Sin pedimentos registrados este mes</td></tr>
                )}
                {data.topByRevenueThisMonth.map((c, i) => (
                  <tr key={(c.companyId ?? c.rfc ?? c.name) + i} style={{ borderBottom: '1px solid rgba(192,197,206,0.08)' }}>
                    <td style={td()}>{i + 1}</td>
                    <td style={td()}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--portal-fg-3)', fontFamily: 'var(--portal-font-mono)' }}>
                        {c.rfc ?? '—'}{c.companyId ? ` · ${c.companyId}` : ''}
                      </div>
                    </td>
                    <td style={td('right', true)}>{fmtNumber(c.pedimentoCountThisMonth)}</td>
                    <td style={td('right', true)}>{fmtMXN(c.estimatedFeeMXNThisMonth)}</td>
                    <td style={td('right', true)}>{c.realFeeMXNThisMonth === null ? '—' : fmtMXN(c.realFeeMXNThisMonth)}</td>
                    <td style={td('right', true, deltaColor(c.momGrowthPct))}>{fmtPct(c.momGrowthPct)}</td>
                    <td style={td('right', true, deltaColor(c.yoyGrowthPct))}>{fmtPct(c.yoyGrowthPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Top 10 by YoY growth */}
        <GlassCard tier="secondary">
          <SectionHeader title={`Top 10 crecimiento YoY · ${monthLabel} vs ${fmtMonthLong(`${Number(ymCurrent.slice(0, 4)) - 1}-${ymCurrent.slice(5, 7)}`)}`} count={data.topByYoYGrowth.length} />
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--aguila-fs-body, 13px)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(192,197,206,0.18)', color: 'var(--portal-fg-3)', textAlign: 'left' }}>
                  <th style={th()}>#</th>
                  <th style={th()}>Cliente</th>
                  <th style={th('right')}>Pedimentos este mes</th>
                  <th style={th('right')}>Pedimentos hace 1 año</th>
                  <th style={th('right')}>Crecimiento YoY</th>
                </tr>
              </thead>
              <tbody>
                {data.topByYoYGrowth.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--portal-fg-3)' }}>Sin clientes con crecimiento positivo (filtro mínimo: 3 pedimentos este mes)</td></tr>
                )}
                {data.topByYoYGrowth.map((c, i) => (
                  <tr key={(c.companyId ?? c.rfc ?? c.name) + 'yoy' + i} style={{ borderBottom: '1px solid rgba(192,197,206,0.08)' }}>
                    <td style={td()}>{i + 1}</td>
                    <td style={td()}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--portal-fg-3)', fontFamily: 'var(--portal-font-mono)' }}>
                        {c.rfc ?? '—'}{c.companyId ? ` · ${c.companyId}` : ''}
                      </div>
                    </td>
                    <td style={td('right', true)}>{fmtNumber(c.pedimentoCountThisMonth)}</td>
                    <td style={td('right', true)}>{fmtNumber(c.pedimentoCountThisMonthLastYear)}</td>
                    <td style={td('right', true, 'var(--portal-green)')}>{fmtPct(c.yoyGrowthPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Footer signal */}
        <div style={{ fontSize: 11, color: 'var(--portal-fg-3)', textAlign: 'center', fontFamily: 'var(--portal-font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: 8 }}>
          Generado {new Date(data.generatedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })} · TC {exchangeRate.toFixed(4)} · Patente 3596 · Aduana 240
        </div>
      </div>
    </PageShell>
  )
}

function th(align: 'left' | 'right' = 'left'): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
    textAlign: align,
  }
}
function td(align: 'left' | 'right' = 'left', mono = false, color?: string): React.CSSProperties {
  return {
    padding: '10px 12px',
    textAlign: align,
    fontFamily: mono ? 'var(--portal-font-mono)' : undefined,
    color: color ?? 'var(--portal-fg-1)',
    fontVariantNumeric: mono ? 'tabular-nums lining-nums' : undefined,
  }
}
function deltaColor(p: number | null): string {
  if (p === null) return 'var(--portal-fg-3)'
  if (p > 0) return 'var(--portal-green)'
  if (p < 0) return 'var(--portal-red)'
  return 'var(--portal-fg-3)'
}
