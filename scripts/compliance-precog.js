#!/usr/bin/env node
/**
 * CRUZ Compliance Precog — predict SAT audits 30 days in advance
 *
 * Company-level audit risk assessment across 5 factors:
 * 1. Reconocimiento pattern (3+ in 90d = elevated)
 * 2. Value anomalies (outliers vs historical)
 * 3. Document completeness at filing
 * 4. MVE compliance gaps
 * 5. Network signals (industry audit campaigns, similar client flags)
 *
 * Each factor scores 0-20 (max total 100).
 * Outputs risk level, trend, audit probability, and recommendations.
 *
 * Cron: 0 5 * * 1 (weekly Monday 5 AM)
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'compliance-precog'

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDate = d => `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`

// ============================================================================
// Factor Scorers (each returns { score: 0-20, ...details })
// ============================================================================

async function scoreReconocimiento(companyId) {
  // Count reconocimientos (semaforo=1) in last 90 days
  const { data: recent } = await supabase.from('traficos')
    .select('trafico, semaforo, fecha_cruce')
    .eq('company_id', companyId)
    .eq('semaforo', 1)
    .gte('fecha_llegada', daysAgo(90))
    .limit(100)

  const count90d = (recent || []).length

  // Count total ops in 90d for rate
  const { count: total90d } = await supabase.from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('fecha_llegada', daysAgo(90))

  const rate = total90d > 0 ? (count90d / total90d) : 0

  // Prior 90d for trend
  const { data: prior } = await supabase.from('traficos')
    .select('semaforo')
    .eq('company_id', companyId)
    .eq('semaforo', 1)
    .gte('fecha_llegada', daysAgo(180))
    .lt('fecha_llegada', daysAgo(90))
    .limit(100)

  const countPrior = (prior || []).length
  const trend = count90d > countPrior + 1 ? 'increasing' : count90d < countPrior - 1 ? 'decreasing' : 'stable'

  let score = 0
  if (count90d >= 5) score = 20
  else if (count90d >= 3) score = 14
  else if (count90d >= 2) score = 8
  else if (count90d >= 1) score = 4

  // Increasing trend adds penalty
  if (trend === 'increasing') score = Math.min(20, score + 4)

  return {
    score,
    count_90d: count90d,
    total_90d: total90d || 0,
    rate_pct: Math.round(rate * 100),
    trend,
    detail: count90d === 0
      ? 'Sin reconocimientos en 90 días — excelente'
      : `${count90d} reconocimientos en 90d (${Math.round(rate * 100)}%). Tendencia: ${trend}`,
  }
}

async function scoreValueAnomalies(companyId) {
  // Find value outliers (> 2x avg) in last 90d
  const { data: recent } = await supabase.from('traficos')
    .select('trafico, importe_total')
    .eq('company_id', companyId)
    .not('importe_total', 'is', null)
    .gte('fecha_llegada', daysAgo(90))
    .limit(500)

  const values = (recent || []).map(t => Number(t.importe_total)).filter(v => v > 0)
  if (values.length < 5) {
    return { score: 0, outlier_count: 0, avg_deviation_pct: 0, detail: 'Insuficientes operaciones para análisis' }
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const outliers = values.filter(v => v > avg * 2).length
  const avgDeviation = values.reduce((s, v) => s + Math.abs(v - avg) / avg, 0) / values.length

  let score = 0
  if (outliers >= 5) score = 20
  else if (outliers >= 3) score = 12
  else if (outliers >= 1) score = 6

  return {
    score,
    outlier_count: outliers,
    avg_deviation_pct: Math.round(avgDeviation * 100),
    detail: outliers === 0
      ? 'Valores consistentes — sin outliers'
      : `${outliers} operaciones con valor > 2x promedio. Desviación media: ${Math.round(avgDeviation * 100)}%`,
  }
}

async function scoreDocCompleteness(companyId) {
  // Check expediente completeness for recent tráficos
  const { data: recentTraficos } = await supabase.from('traficos')
    .select('trafico, pedimento')
    .eq('company_id', companyId)
    .gte('fecha_llegada', daysAgo(90))
    .limit(200)

  if (!recentTraficos || recentTraficos.length < 3) {
    return { score: 0, avg_completeness_pct: 100, late_filing_count: 0, detail: 'Insuficientes operaciones' }
  }

  // Count those without pedimento (still "open")
  const withoutPed = recentTraficos.filter(t => !t.pedimento).length
  const withoutPedRate = withoutPed / recentTraficos.length

  // Check for overdue docs
  const { count: overdueCount } = await supabase.from('documento_solicitudes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'solicitado')
    .lt('solicitado_at', daysAgo(5))

  let score = 0
  if (withoutPedRate > 0.3) score += 12
  else if (withoutPedRate > 0.15) score += 6
  if ((overdueCount || 0) >= 5) score += 8
  else if ((overdueCount || 0) >= 2) score += 4
  score = Math.min(20, score)

  return {
    score,
    avg_completeness_pct: Math.round((1 - withoutPedRate) * 100),
    late_filing_count: overdueCount || 0,
    detail: `${Math.round((1 - withoutPedRate) * 100)}% con pedimento asignado. ${overdueCount || 0} docs vencidos.`,
  }
}

async function scoreMVECompliance(companyId) {
  // Check MVE deadlines
  const { data: deadlines } = await supabase.from('deadlines')
    .select('deadline_date, status, type')
    .eq('company_id', companyId)
    .eq('type', 'mve')
    .order('deadline_date', { ascending: false })
    .limit(10)

  const missed = (deadlines || []).filter(d => d.status === 'missed' || d.status === 'overdue').length
  const upcoming = (deadlines || []).filter(d => {
    const dDate = new Date(d.deadline_date)
    return dDate > new Date() && dDate < new Date(Date.now() + 30 * 86400000)
  }).length

  let score = 0
  if (missed >= 2) score = 20
  else if (missed >= 1) score = 12
  if (upcoming >= 1 && score < 20) score = Math.min(20, score + 4)

  // If no MVE data, neutral score
  if (!deadlines || deadlines.length === 0) {
    return { score: 2, mve_status: 'sin datos', gaps_count: 0, detail: 'Sin datos de MVE — verificar manualmente' }
  }

  return {
    score,
    mve_status: missed > 0 ? 'con gaps' : 'al corriente',
    gaps_count: missed,
    upcoming_30d: upcoming,
    detail: missed > 0
      ? `${missed} plazo(s) MVE vencido(s). ${upcoming} próximo(s) en 30d.`
      : `MVE al corriente. ${upcoming} plazo(s) próximo(s) en 30d.`,
  }
}

async function scoreNetworkSignals(companyId) {
  // Check anomaly_log for industry patterns
  const { data: anomalies } = await supabase.from('anomaly_log')
    .select('metric, severity')
    .gte('created_at', daysAgo(30))
    .eq('severity', 'critical')
    .limit(50)

  const criticalCount = (anomalies || []).length

  // Check exception_diagnoses for this company
  const { count: openExceptions } = await supabase.from('exception_diagnoses')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'open')

  // Fracción concentration risk
  const { data: fracciones } = await supabase.from('traficos')
    .select('descripcion_mercancia')
    .eq('company_id', companyId)
    .gte('fecha_llegada', daysAgo(180))
    .not('descripcion_mercancia', 'is', null)
    .limit(500)

  const descCounts = {}
  for (const t of (fracciones || [])) {
    const key = (t.descripcion_mercancia || '').substring(0, 30).toLowerCase()
    if (key) descCounts[key] = (descCounts[key] || 0) + 1
  }
  const totalFracs = (fracciones || []).length
  const topProduct = Object.entries(descCounts).sort((a, b) => b[1] - a[1])[0]
  const concentrationPct = topProduct && totalFracs > 0 ? Math.round((topProduct[1] / totalFracs) * 100) : 0

  let score = 0
  if (criticalCount >= 5) score += 6
  else if (criticalCount >= 2) score += 3
  if ((openExceptions || 0) >= 3) score += 6
  else if ((openExceptions || 0) >= 1) score += 2
  if (concentrationPct > 60) score += 8
  else if (concentrationPct > 40) score += 4
  score = Math.min(20, score)

  return {
    score,
    industry_anomalies_30d: criticalCount,
    open_exceptions: openExceptions || 0,
    top_product_concentration_pct: concentrationPct,
    top_product: topProduct ? topProduct[0] : null,
    detail: `${criticalCount} anomalías industria. ${openExceptions || 0} excepciones abiertas. Concentración: ${concentrationPct}% en producto principal.`,
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`🛡️ Compliance Precog — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const startTime = Date.now()
  const today = new Date()
  const assessmentDate = today.toISOString().split('T')[0]

  // Multi-client
  const { data: companies } = await supabase.from('companies')
    .select('company_id')
    .eq('active', true)

  const companyIds = (companies || []).map(c => c.company_id)
  if (companyIds.length === 0) { companyIds.push('evco'); console.warn('  ⚠️  No active companies found — falling back to evco') }

  for (const companyId of companyIds) {
    console.log(`\n  Analizando: ${companyId}`)

    // Score all 5 factors
    const [f1, f2, f3, f4, f5] = await Promise.all([
      scoreReconocimiento(companyId),
      scoreValueAnomalies(companyId),
      scoreDocCompleteness(companyId),
      scoreMVECompliance(companyId),
      scoreNetworkSignals(companyId),
    ])

    const totalScore = f1.score + f2.score + f3.score + f4.score + f5.score
    const riskLevel = totalScore >= 60 ? 'high' : totalScore >= 40 ? 'elevated' : totalScore >= 20 ? 'moderate' : 'low'

    // Trend: compare with last assessment
    const { data: lastAssessment } = await supabase.from('audit_risk_assessments')
      .select('risk_score')
      .eq('company_id', companyId)
      .order('assessment_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastScore = lastAssessment?.risk_score ?? totalScore
    const trend = totalScore > lastScore + 5 ? 'worsening' : totalScore < lastScore - 5 ? 'improving' : 'stable'

    // Audit probability estimate
    const auditProb = Math.min(95, Math.round(totalScore * 0.8 + (trend === 'worsening' ? 10 : 0)))

    // Penalty range (rough estimate based on risk level)
    const penaltyLow = riskLevel === 'high' ? 50000 : riskLevel === 'elevated' ? 15000 : 0
    const penaltyHigh = riskLevel === 'high' ? 200000 : riskLevel === 'elevated' ? 50000 : riskLevel === 'moderate' ? 15000 : 0

    // Predicted audit window
    const quarter = Math.ceil((today.getMonth() + 1) / 3)
    const quarterLabel = `Q${quarter} ${today.getFullYear()}`
    const predictedWindow = totalScore >= 60
      ? `Posible en ${MONTHS_ES[today.getMonth()]} - ${MONTHS_ES[(today.getMonth() + 1) % 12]}`
      : totalScore >= 40
      ? `Riesgo moderado en ${quarterLabel}`
      : `Improbable en ${quarterLabel}`

    // Top risk fracciones
    const topFracciones = []
    if (f5.top_product) {
      topFracciones.push({
        product: f5.top_product,
        concentration_pct: f5.top_product_concentration_pct,
      })
    }

    // Recommendations
    const recommendations = []
    if (f1.score >= 10) {
      recommendations.push({
        priority: 1,
        action: 'Revisar todas las operaciones con reconocimiento reciente',
        rationale: f1.detail,
      })
    }
    if (f2.score >= 10) {
      recommendations.push({
        priority: 2,
        action: 'Documentar justificación de valores atípicos',
        rationale: f2.detail,
      })
    }
    if (f3.score >= 10) {
      recommendations.push({
        priority: 3,
        action: 'Completar expedientes pendientes y documentos vencidos',
        rationale: f3.detail,
      })
    }
    if (f4.score >= 10) {
      recommendations.push({
        priority: 4,
        action: 'Regularizar cumplimiento MVE de inmediato',
        rationale: f4.detail,
      })
    }
    if (f5.top_product_concentration_pct > 50) {
      recommendations.push({
        priority: 5,
        action: `Preparar documentación robusta para ${f5.top_product?.substring(0, 30)} (${f5.top_product_concentration_pct}% de importaciones)`,
        rationale: 'Alta concentración en un producto atrae escrutinio SAT',
      })
    }
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 1,
        action: 'Mantener estándares actuales — bajo riesgo',
        rationale: 'Todos los indicadores dentro de parámetros normales',
      })
    }

    // Save
    const assessment = {
      company_id: companyId,
      assessment_date: assessmentDate,
      risk_score: totalScore,
      risk_level: riskLevel,
      risk_trend: trend,
      factor_reconocimiento: f1,
      factor_value_anomalies: f2,
      factor_doc_completeness: f3,
      factor_mve_compliance: f4,
      factor_network_signals: f5,
      estimated_audit_probability: auditProb,
      estimated_penalty_range_low: penaltyLow,
      estimated_penalty_range_high: penaltyHigh,
      predicted_audit_window: predictedWindow,
      recommendations,
      top_risk_fracciones: topFracciones,
    }

    if (!DRY_RUN) {
      await supabase.from('audit_risk_assessments').upsert(assessment, {
        onConflict: 'company_id,assessment_date',
      }).catch(err => console.error(`  ⚠ Upsert failed: ${err.message}`))
    }

    const icon = riskLevel === 'high' ? '🔴' : riskLevel === 'elevated' ? '🟠' : riskLevel === 'moderate' ? '🟡' : '🟢'
    console.log(`  ${icon} ${companyId}: ${totalScore}/100 (${riskLevel}) · tendencia: ${trend}`)
    console.log(`    Reconocimiento: ${f1.score}/20 · Valores: ${f2.score}/20 · Docs: ${f3.score}/20 · MVE: ${f4.score}/20 · Red: ${f5.score}/20`)
    console.log(`    Probabilidad auditoría: ${auditProb}% · Ventana: ${predictedWindow}`)

    // Telegram for elevated+
    if (riskLevel === 'high' || riskLevel === 'elevated') {
      await tg(
        `${icon} <b>Riesgo Auditoría: ${companyId.toUpperCase()}</b>\n\n` +
        `Score: ${totalScore}/100 (${riskLevel})\n` +
        `Tendencia: ${trend}\n` +
        `Prob. auditoría: ${auditProb}%\n` +
        `Ventana: ${predictedWindow}\n\n` +
        `Factores:\n` +
        `  Reconocimientos: ${f1.score}/20\n` +
        `  Valores atípicos: ${f2.score}/20\n` +
        `  Documentación: ${f3.score}/20\n` +
        `  MVE: ${f4.score}/20\n` +
        `  Señales red: ${f5.score}/20\n\n` +
        `Top recomendación: ${recommendations[0]?.action || '—'}\n\n` +
        `— CRUZ 🛡️`
      )
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  await tg(
    `🛡️ <b>Compliance Precog — Resumen</b>\n\n` +
    `${companyIds.length} empresa(s) evaluadas\n` +
    `Duración: ${elapsed}s\n\n` +
    `— CRUZ 🛡️`
  )

  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME,
      status: 'success',
      details: { companies: companyIds.length, elapsed_s: parseFloat(elapsed) },
    }).catch(() => {})
  }

  console.log(`\n✅ ${companyIds.length} empresas evaluadas · ${elapsed}s`)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  process.exit(1)
})
