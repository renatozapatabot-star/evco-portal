#!/usr/bin/env node
/**
 * CRUZ Morning Brief Engine
 * Runs at 6:50 AM daily
 * Generates personalized intelligence briefs for each active client
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', msg.replace(/<[^>]+>/g, '')); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function generateBrief(company) {
  const cid = company.company_id
  const today = new Date().toISOString().split('T')[0]

  const [activeRes, complianceRes, riskRes, bridgeRes, savingsRes] = await Promise.all([
    supabase.from('traficos').select('trafico, estatus, fecha_llegada, pedimento', { count: 'exact' })
      .eq('company_id', cid).neq('estatus', 'Cruzado').limit(50),
    supabase.from('compliance_predictions').select('severity, prediction_type')
      .eq('company_id', cid).eq('resolved', false),
    supabase.from('pedimento_risk_scores').select('trafico_id, overall_score')
      .eq('company_id', cid).gte('overall_score', 50),
    supabase.from('bridge_intelligence').select('bridge_name, crossing_hours')
      .eq('day_of_week', new Date().getDay()).limit(20),
    supabase.from('financial_intelligence').select('metric_value')
      .eq('company_id', cid).eq('metric_name', 'monthly_savings').limit(1)
  ])

  const active = activeRes.data || []
  const critical = (complianceRes.data || []).filter(p => p.severity === 'critical')
  const warnings = (complianceRes.data || []).filter(p => p.severity === 'warning')
  const highRisk = riskRes.data || []

  // Best bridge
  const bridgeMap = {}
  ;(bridgeRes.data || []).forEach(b => {
    if (!bridgeMap[b.bridge_name]) bridgeMap[b.bridge_name] = []
    bridgeMap[b.bridge_name].push(b.crossing_hours)
  })
  const bestBridge = Object.entries(bridgeMap)
    .map(([name, hours]) => ({ name, avg: hours.reduce((a, b) => a + b, 0) / hours.length }))
    .sort((a, b) => a.avg - b.avg)[0]

  // Tráficos needing docs
  const noPedimento = active.filter(t => !t.pedimento).length

  const brief = {
    company_id: cid,
    date: today,
    active_traficos: activeRes.count || 0,
    critical_alerts: critical.length,
    warning_alerts: warnings.length,
    high_risk_count: highRisk.length,
    no_pedimento: noPedimento,
    best_bridge: bestBridge?.name || 'World Trade Bridge',
    best_bridge_hours: bestBridge?.avg?.toFixed(1) || '?',
    health_score: company.health_score || 0,
    generated_at: new Date().toISOString()
  }

  await supabase.from('daily_briefs').upsert({
    company_id: cid,
    brief_data: brief,
    date: today,
    created_at: new Date().toISOString()
  }, { onConflict: 'company_id,date' })

  return brief
}

async function run() {
  console.log('🌅 CRUZ Morning Brief Engine')
  console.log('═'.repeat(50))

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .eq('active', true)
    .order('traficos_count', { ascending: false, nullsFirst: false })

  if (!companies?.length) { console.log('No active companies'); return }

  let totalActive = 0
  let totalCritical = 0
  let totalWarnings = 0
  const clientSummaries = []

  for (const company of companies) {
    try {
      const brief = await generateBrief(company)
      totalActive += brief.active_traficos
      totalCritical += brief.critical_alerts
      totalWarnings += brief.warning_alerts

      if (brief.critical_alerts > 0 || brief.active_traficos > 10) {
        clientSummaries.push(`  ${company.name}: ${brief.active_traficos} activos, ${brief.critical_alerts} alertas`)
      }
      console.log(`  ✅ ${company.name}: ${brief.active_traficos} activos, score ${brief.health_score}`)
    } catch (e) {
      console.error(`  ❌ ${company.name}: ${e.message}`)
    }
  }

  // Fleet summary to Tito
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const now = new Date()
  const dateStr = `${days[now.getDay()]}, ${now.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`

  const msg = [
    `🌅 <b>BUENOS DÍAS — FLEET BRIEFING</b>`,
    `Renato Zapata & Company`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📅 ${dateStr}`,
    ``,
    `📊 <b>FLEET STATUS</b>`,
    `• ${companies.length} clientes activos`,
    `• ${totalActive.toLocaleString()} tráficos activos`,
    `• 🔴 ${totalCritical} alertas críticas`,
    `• ⚠️ ${totalWarnings} advertencias`,
    ``,
    clientSummaries.length > 0 ? `<b>CLIENTES CON ACTIVIDAD:</b>\n${clientSummaries.join('\n')}` : '✅ Sin alertas críticas',
    `━━━━━━━━━━━━━━━━━━━━`,
    `— CRUZ 🦀`
  ].join('\n')

  await tg(msg)
  console.log(`\n✅ ${companies.length} briefs generated`)
}

run().catch(console.error)
