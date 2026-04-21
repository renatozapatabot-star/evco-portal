#!/usr/bin/env node

// ============================================================
// CRUZ Retention Intelligence — detect churn before it happens
// Combines business signals (volume, value) with engagement
// signals (logins, AI usage, response time) into a single
// retention score per client.
// Cron: 0 4 * * 1 (Monday 4 AM — after client profiles)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { buildAcuseRecibo } = require('./lib/email-templates')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function scoreRetention(company) {
  const { company_id, name } = company
  let score = 100
  const signals = []

  // ── BUSINESS SIGNALS ──

  // 1. Volume trend from client_profiles
  const { data: profile } = await supabase
    .from('client_profiles')
    .select('profile_data')
    .eq('company_id', company_id)
    .single()

  const pd = profile?.profile_data || {}
  const volumeTrend = pd.operational?.volume_trend_pct || 0
  const avgMonthly = pd.operational?.avg_monthly || 0

  if (volumeTrend < -30) { score -= 30; signals.push('🔴 Volumen -' + Math.abs(volumeTrend) + '% vs trimestre anterior') }
  else if (volumeTrend < -15) { score -= 15; signals.push('🟡 Volumen -' + Math.abs(volumeTrend) + '%') }
  else if (volumeTrend > 10) { signals.push('🟢 Volumen +' + volumeTrend + '% (creciendo)') }

  // 2. Recent activity (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const { count: recentTraficos } = await supabase
    .from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)
    .gte('fecha_llegada', thirtyDaysAgo)

  if ((recentTraficos || 0) === 0 && avgMonthly > 1) {
    score -= 20; signals.push('🔴 Sin tráficos en 30 días (promedio: ' + avgMonthly + '/mes)')
  }

  // 3. Value trend
  const totalValue = pd.operational?.total_value_usd || 0
  if (totalValue === 0) { score -= 10; signals.push('🟡 Sin valor registrado') }

  // ── ENGAGEMENT SIGNALS ──

  // 4. CRUZ AI usage (conversations in last 30 days)
  const { count: aiUsage } = await supabase
    .from('cruz_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)
    .gte('created_at', thirtyDaysAgo)

  if ((aiUsage || 0) > 5) { signals.push('🟢 Activo en CRUZ AI (' + aiUsage + ' consultas)') }
  else if ((aiUsage || 0) === 0) { score -= 5; signals.push('🟡 Sin uso de CRUZ AI') }

  // 5. Document response time
  const { data: sols } = await supabase
    .from('documento_solicitudes')
    .select('status, solicitado_at')
    .eq('company_id', company_id)
    .eq('status', 'solicitado')
    .gte('solicitado_at', thirtyDaysAgo)

  const pendingSols = (sols || []).length
  if (pendingSols > 3) { score -= 10; signals.push('🔴 ' + pendingSols + ' solicitudes sin respuesta') }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  const level = score >= 80 ? 'healthy' : score >= 60 ? 'watch' : score >= 40 ? 'at_risk' : 'critical'
  const label = score >= 80 ? 'Saludable' : score >= 60 ? 'Monitorear' : score >= 40 ? 'En riesgo' : 'Crítico'

  return { company_id, name, score, level, label, signals, avgMonthly, volumeTrend }
}

async function main() {
  console.log(`🎯 CRUZ Retention Intelligence — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, name')
    .not('portal_password', 'is', null)
    .eq('active', true)

  const results = []
  const atRisk = []

  for (const company of (companies || [])) {
    const result = await scoreRetention(company)
    results.push(result)

    const icon = result.level === 'healthy' ? '🟢' : result.level === 'watch' ? '🟡' : result.level === 'at_risk' ? '🔴' : '⚫'
    console.log(`  ${icon} ${result.score.toString().padStart(3)} ${result.name.substring(0, 30)}`)

    if (result.level === 'at_risk' || result.level === 'critical') {
      atRisk.push(result)
    }

    if (!DRY_RUN) {
      await supabase.from('client_profiles').upsert({
        company_id: result.company_id,
        churn_risk: result.level,
        profile_data: {
          ...(await supabase.from('client_profiles').select('profile_data').eq('company_id', result.company_id).single()).data?.profile_data || {},
          retention: { score: result.score, level: result.level, signals: result.signals, scored_at: new Date().toISOString() },
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id' }).then(() => {}, () => {})
    }
  }

  // Auto-draft re-engagement for at-risk clients
  if (!DRY_RUN) {
    for (const r of atRisk) {
      await supabase.from('pedimento_drafts').insert({
        trafico_id: null,
        draft_data: {
          type: 'retention_email',
          to: r.name,
          company_id: r.company_id,
          subject: `${r.name} — Revisión de operaciones`,
          body: `Estimado cliente,\n\nQuisiera programar una breve llamada para revisar sus operaciones y asegurar que nuestro servicio cumple con sus expectativas.\n\nQuedo a sus órdenes.\n\nRenato Zapata III\nDirector General · Patente 3596`,
          retention_score: r.score,
          signals: r.signals,
        },
        status: 'pending_approval',
        created_by: 'CRUZ',
      }).then(() => {}, () => {})
    }
  }

  // Telegram
  if (atRisk.length > 0) {
    const lines = [
      `🎯 <b>Retención — ${atRisk.length} cliente(s) en riesgo</b>`,
      ``,
      ...atRisk.map(r => {
        const icon = r.level === 'critical' ? '⚫' : '🔴'
        return `${icon} <b>${r.name}</b>: ${r.score}/100\n   ${r.signals.slice(0, 2).join(' · ')}`
      }),
      ``,
      atRisk.length > 0 ? `📧 ${atRisk.length} email(s) de re-engagement listos — <b>/aprobar</b>` : '',
      `— CRUZ 🦀`,
    ].filter(Boolean)
    await sendTelegram(lines.join('\n'))
  }

  const healthy = results.filter(r => r.level === 'healthy').length
  const watch = results.filter(r => r.level === 'watch').length
  console.log(`\n✅ ${results.length} scored · ${healthy} healthy · ${watch} watch · ${atRisk.length} at risk`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
