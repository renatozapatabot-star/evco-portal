#!/usr/bin/env node
/**
 * CRUZ Risk Radar
 * Monitors weather, regulatory, carrier, and operational risks
 * Runs every 2 hours
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
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function checkWeather() {
  try {
    const res = await fetch('https://api.weather.gov/alerts/active?point=27.5,-99.5', {
      headers: { 'User-Agent': 'CRUZ/1.0 ai@renatozapata.com' },
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.features || []).map(f => ({
      category: 'weather',
      severity: f.properties.severity === 'Extreme' ? 'critical'
        : f.properties.severity === 'Severe' ? 'high' : 'medium',
      title: f.properties.headline || 'Weather alert',
      description: (f.properties.description || '').substring(0, 200),
      source: 'NOAA',
      detected_at: new Date().toISOString()
    }))
  } catch { return [] }
}

async function checkBridgeCongestion() {
  const { data: bridge } = await supabase
    .from('bridge_intelligence')
    .select('bridge_name, crossing_hours')
    .eq('day_of_week', new Date().getDay())
    .order('crossing_hours', { ascending: false })
    .limit(10)

  const alerts = []
  for (const b of (bridge || [])) {
    if (b.crossing_hours > 3) {
      alerts.push({
        category: 'carrier',
        severity: b.crossing_hours > 5 ? 'high' : 'medium',
        title: `${b.bridge_name}: ${b.crossing_hours.toFixed(1)}h espera`,
        description: 'Considerar puente alternativo',
        source: 'bridge_intelligence',
        detected_at: new Date().toISOString()
      })
    }
  }
  return alerts
}

async function checkCarrierRisk() {
  // Carriers with multiple issues recently
  const { data: risks } = await supabase
    .from('pedimento_risk_scores')
    .select('carrier, overall_score')
    .gte('overall_score', 70)
    .limit(20)

  const carrierCounts = {}
  ;(risks || []).forEach(r => {
    if (r.carrier) carrierCounts[r.carrier] = (carrierCounts[r.carrier] || 0) + 1
  })

  return Object.entries(carrierCounts)
    .filter(([, count]) => count >= 3)
    .map(([carrier, count]) => ({
      category: 'carrier',
      severity: count >= 5 ? 'high' : 'medium',
      title: `Carrier ${carrier}: ${count} tráficos alto riesgo`,
      description: 'Posible patrón de inspecciones. Revisar documentación.',
      source: 'risk_scores',
      detected_at: new Date().toISOString()
    }))
}

async function run() {
  console.log('\n🛡️  RISK RADAR')
  console.log('═'.repeat(40))

  const [weather, bridges, carriers] = await Promise.all([
    checkWeather(),
    checkBridgeCongestion(),
    checkCarrierRisk()
  ])

  const all = [...weather, ...bridges, ...carriers]
    .sort((a, b) => {
      const sev = { critical: 0, high: 1, medium: 2, low: 3 }
      return (sev[a.severity] || 3) - (sev[b.severity] || 3)
    })

  console.log(`Signals: ${all.length} (${weather.length} weather, ${bridges.length} bridge, ${carriers.length} carrier)`)
  all.forEach(a => {
    const icon = a.severity === 'critical' ? '🔴' : a.severity === 'high' ? '🟡' : '🟢'
    console.log(`  ${icon} [${a.category}] ${a.title}`)
  })

  // Save to Supabase
  if (all.length > 0) {
    await supabase.from('risk_signals').upsert(
      all.map(a => ({
        ...a,
        id: undefined,
        active: true,
        updated_at: new Date().toISOString()
      }))
    ).catch(() => {
      // Table might not exist — insert individually
      all.forEach(a => supabase.from('risk_signals').insert(a).catch(() => {}))
    })
  }

  // Alert on critical
  const critical = all.filter(a => a.severity === 'critical' || a.severity === 'high')
  if (critical.length > 0) {
    await tg(
      `🛡️ <b>RISK RADAR</b>\n` +
      critical.map(a => `${a.severity === 'critical' ? '🔴' : '🟡'} ${a.title}\n   ${a.description}`).join('\n\n') +
      `\n\n— CRUZ 🦀`
    )
  }
}

run().catch(console.error)
