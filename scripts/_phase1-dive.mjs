import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const TODAY = new Date('2026-04-19T00:00:00Z')
const MXN_PER_USD = 20
const OUT_DIR = '/tmp/prospect-engine'
await fs.mkdir(OUT_DIR, { recursive: true })

// ── Fetch companies ─────────────────────────────────────────────
console.log('Fetching companies...')
const { data: companies } = await sb.from('companies').select('*')
const compsByCid = new Map(companies.map(c => [c.company_id, c]))

// ── Paginate all traficos ───────────────────────────────────────
console.log('Paginating traficos...')
const trafStats = new Map() // company_id -> per-client stats
const PAGE = 1000
let fromRow = 0
while (true) {
  const { data, error } = await sb.from('traficos')
    .select('company_id, fecha_llegada, fecha_cruce, importe_total, predicted_landed_cost, regimen')
    .range(fromRow, fromRow + PAGE - 1)
  if (error) throw error
  if (!data?.length) break
  for (const r of data) {
    const cid = r.company_id; if (!cid) continue
    const dt = r.fecha_cruce || r.fecha_llegada
    let s = trafStats.get(cid)
    if (!s) {
      s = { count: 0, first: null, last: null, impTotal: 0, impCount: 0,
            last90Count: 0, prev90Count: 0, last365Count: 0, prev365Count: 0 }
      trafStats.set(cid, s)
    }
    s.count++
    if (dt) {
      if (!s.first || dt < s.first) s.first = dt
      if (!s.last || dt > s.last) s.last = dt
      const dtDate = new Date(dt)
      const daysAgo = Math.floor((TODAY - dtDate) / 86400000)
      if (daysAgo >= 0 && daysAgo < 90) s.last90Count++
      else if (daysAgo >= 90 && daysAgo < 180) s.prev90Count++
      if (daysAgo >= 0 && daysAgo < 365) s.last365Count++
      else if (daysAgo >= 365 && daysAgo < 730) s.prev365Count++
    }
    const imp = Number(r.importe_total) || 0
    if (imp > 0) { s.impTotal += imp; s.impCount++ }
  }
  fromRow += PAGE
  if (data.length < PAGE) break
}
console.log(`  traficos → ${trafStats.size} companies with shipments`)

// ── Paginate globalpc_facturas for USD/MXN valor_comercial grounding ─
console.log('Paginating globalpc_facturas for revenue grounding...')
const facStats = new Map() // company_id -> { count, vcUSDEquiv, count_w_value }
fromRow = 0
while (true) {
  const { data, error } = await sb.from('globalpc_facturas')
    .select('company_id, valor_comercial, flete, moneda')
    .range(fromRow, fromRow + PAGE - 1)
  if (error) throw error
  if (!data?.length) break
  for (const r of data) {
    const cid = r.company_id; if (!cid) continue
    let s = facStats.get(cid) || { count: 0, vcUSDEquiv: 0, fleteUSDEquiv: 0, withValue: 0 }
    s.count++
    const vc = Number(r.valor_comercial) || 0
    const fl = Number(r.flete) || 0
    if (vc > 0) s.withValue++
    let usdVC = vc, usdFL = fl
    if (r.moneda && r.moneda !== 'USD' && r.moneda !== 'DLS' && r.moneda !== 'DOLARES') {
      usdVC = vc / MXN_PER_USD; usdFL = fl / MXN_PER_USD
    }
    s.vcUSDEquiv += usdVC
    s.fleteUSDEquiv += usdFL
    facStats.set(cid, s)
  }
  fromRow += PAGE
  if (data.length < PAGE) break
}
console.log(`  facturas → ${facStats.size} companies with commercial values`)

// ── Compute per-client analysis ─────────────────────────────────
function daysBetween(a, b) { return Math.floor((b - new Date(a)) / 86400000) }

// Per-tráfico broker fee estimate (transparent, conservative)
// Formula: 0.15% of valor comercial USD, clamped to [80, 600]
// Fallback: $180 flat if no commercial value data
function perTraficoFee(totalUSDValue, traficosWithValue, totalTraficos) {
  if (traficosWithValue > 0 && totalUSDValue > 0) {
    const avgUSDPerTraf = totalUSDValue / traficosWithValue
    const advalorem = avgUSDPerTraf * 0.0015
    return Math.max(80, Math.min(600, advalorem))
  }
  return 180
}

// Trajectory: last 90d vs prior 90d count
function trajectoryLabel(last90, prev90) {
  if (last90 === 0 && prev90 === 0) return 'DORMANT'
  if (last90 === 0) return 'STOPPED'
  if (prev90 === 0) return 'STARTED'
  const ratio = last90 / prev90
  if (ratio >= 1.25) return 'GROWING'
  if (ratio >= 0.85) return 'STEADY'
  if (ratio >= 0.5) return 'SLOWING'
  return 'DECLINING'
}

// Reactivation probability by silence duration + volume bonus
function reactivationProb(daysSince, count) {
  if (daysSince == null) return 0.01
  let base
  if (daysSince < 30)      base = 0.95  // effectively still active
  else if (daysSince < 60)  base = 0.85
  else if (daysSince < 90)  base = 0.70
  else if (daysSince < 180) base = 0.55
  else if (daysSince < 365) base = 0.32
  else if (daysSince < 730) base = 0.15
  else if (daysSince < 1460) base = 0.07
  else if (daysSince < 2190) base = 0.04
  else base = 0.02
  // Volume bonus: log-scale, big-history clients slightly more likely to engage
  const volBonus = Math.min(0.15, Math.log10(count + 1) * 0.05)
  return Math.min(0.97, base + volBonus)
}

// Urgency: how fast can this revenue disappear if we don't act?
function urgencyScore(daysSince, count) {
  if (count === 0) return 0
  if (daysSince == null) return 0
  // Peak urgency at 60-180 days (just-lapsed, still winnable, not yet gone)
  if (daysSince < 30) return 0.2   // not urgent — still active
  if (daysSince < 60) return 0.5
  if (daysSince < 180) return 1.0  // PEAK
  if (daysSince < 365) return 0.8
  if (daysSince < 730) return 0.5
  if (daysSince < 1460) return 0.3
  return 0.1
}

const analysis = []
for (const [cid, t] of trafStats.entries()) {
  const c = compsByCid.get(cid) || {}
  const f = facStats.get(cid) || { count: 0, vcUSDEquiv: 0, fleteUSDEquiv: 0, withValue: 0 }
  const daysSinceLast = t.last ? daysBetween(t.last, TODAY) : null
  const daysSinceFirst = t.first ? daysBetween(t.first, TODAY) : null
  const activeYears = daysSinceFirst ? Math.max(1, daysSinceFirst / 365) : 1
  const historicalAnnualRate = t.count / activeYears

  // Actual pace: if recent data exists, prefer last 365d; else historical rate
  const annualizedPace = t.last365Count >= 20 ? t.last365Count : historicalAnnualRate

  const fee = perTraficoFee(f.vcUSDEquiv, f.withValue, t.count)
  const historicalAnnualRevenue = annualizedPace * fee

  const reactivateProb = reactivationProb(daysSinceLast, t.count)
  const rar = historicalAnnualRevenue * reactivateProb
  const urgency = urgencyScore(daysSinceLast, t.count)
  const trajectory = trajectoryLabel(t.last90Count, t.prev90Count)

  analysis.push({
    company_id: cid,
    name: c.name || '—',
    rfc: c.rfc || null,
    clave: c.clave_cliente || c.globalpc_clave || null,
    active: !!c.active,
    contact_name: c.contact_name || '',
    contact_email: c.contact_email || '',
    contact_phone: c.contact_phone || '',
    total_traficos: t.count,
    first_cruce: t.first,
    last_cruce: t.last,
    days_silent: daysSinceLast,
    last_90d: t.last90Count,
    prev_90d: t.prev90Count,
    last_365d: t.last365Count,
    prev_365d: t.prev365Count,
    annual_pace: Math.round(annualizedPace * 10) / 10,
    trajectory,
    facturas_count: f.count,
    facturas_with_value: f.withValue,
    total_comercial_usd: Math.round(f.vcUSDEquiv),
    avg_fee_per_trafico_usd: Math.round(fee),
    historical_annual_revenue_usd: Math.round(historicalAnnualRevenue),
    reactivation_probability: Math.round(reactivateProb * 1000) / 1000,
    revenue_at_risk_usd: Math.round(rar),
    urgency_score: urgency,
    priority_score: Math.round(rar * urgency * 100) / 100, // master ranking
  })
}

// Sort by priority (RAR × urgency)
analysis.sort((a, b) => b.priority_score - a.priority_score)

// ── Outputs ─────────────────────────────────────────────────────
const json = {
  generated_at: TODAY.toISOString(),
  methodology: {
    per_trafico_fee: '0.15% of valor_comercial USD, clamped [$80, $600]. Fallback $180 when no facturas data.',
    reactivation_probability: 'piecewise function of days_silent + log volume bonus',
    urgency_score: 'peaks at 60-180d silence, decays to 0.1 at >4y',
    priority_score: 'revenue_at_risk_usd × urgency_score',
    mxn_per_usd: MXN_PER_USD,
    assumptions: [
      'Revenue estimate is an approximation. Actual broker fees vary by complexity, regime, and client contract.',
      'facturas coverage is partial (64K of 290K partidas) — clients without facturas get flat $180 assumption.',
      'annual_pace uses last_365d if >=20, else historical rate',
    ],
  },
  total_clients: analysis.length,
  summary: {
    active_60d: analysis.filter(a => a.days_silent !== null && a.days_silent < 60).length,
    hot_60_180d: analysis.filter(a => a.days_silent !== null && a.days_silent >= 60 && a.days_silent < 180).length,
    warm_180_365d: analysis.filter(a => a.days_silent !== null && a.days_silent >= 180 && a.days_silent < 365).length,
    cold_365_1095d: analysis.filter(a => a.days_silent !== null && a.days_silent >= 365 && a.days_silent < 1095).length,
    archive_1095d_plus: analysis.filter(a => a.days_silent !== null && a.days_silent >= 1095).length,
    total_rar_usd: analysis.reduce((s, a) => s + a.revenue_at_risk_usd, 0),
    top_10_rar_sum: analysis.slice(0, 10).reduce((s, a) => s + a.revenue_at_risk_usd, 0),
  },
  clients: analysis,
}

await fs.writeFile(path.join(OUT_DIR, 'phase1-existing-clients.json'), JSON.stringify(json, null, 2))
console.log(`\n✓ Phase 1 → ${OUT_DIR}/phase1-existing-clients.json`)
console.log(`  ${analysis.length} clients analyzed`)
console.log(`  Total RAR: $${json.summary.total_rar_usd.toLocaleString('en-US')} USD`)
console.log(`  Top 10 RAR: $${json.summary.top_10_rar_sum.toLocaleString('en-US')} USD`)

// Print top 20 for the inline preview
console.log('\n──── TOP 20 BY PRIORITY (RAR × URGENCY) ────')
console.log('Rank | Client | Traficos | Silent | Trajectory | HAR | ReactProb | RAR | Priority')
for (let i = 0; i < Math.min(20, analysis.length); i++) {
  const a = analysis[i]
  console.log([
    String(i+1).padStart(2),
    a.name.slice(0, 35).padEnd(35),
    String(a.total_traficos).padStart(5),
    (a.days_silent ?? '—').toString().padStart(4) + 'd',
    a.trajectory.padEnd(9),
    '$' + a.historical_annual_revenue_usd.toLocaleString('en-US').padStart(9),
    (a.reactivation_probability * 100).toFixed(0).padStart(3) + '%',
    '$' + a.revenue_at_risk_usd.toLocaleString('en-US').padStart(8),
    a.priority_score.toFixed(1).padStart(8),
  ].join(' │ '))
}
