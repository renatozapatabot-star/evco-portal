#!/usr/bin/env node
/**
 * CRUZ Concierge Engine
 * Generates proactive intelligence alerts
 * Runs every 2 hours during business days
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
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function checkOptimalCrossingWindow() {
  const { data: bridge } = await supabase
    .from('bridge_intelligence')
    .select('bridge_name, crossing_hours')
    .eq('day_of_week', new Date().getDay())
    .eq('hour_of_day', new Date().getHours())
    .limit(10)

  if (!bridge?.length) return null

  const best = bridge.sort((a, b) => a.crossing_hours - b.crossing_hours)[0]
  if (best.crossing_hours < 0.5) { // Under 30 min
    const { count } = await supabase
      .from('traficos')
      .select('*', { count: 'exact', head: true })
      .neq('estatus', 'Cruzado')
      .not('pedimento', 'is', null)

    if ((count || 0) > 0) {
      return {
        type: 'optimal_crossing',
        priority: 'high',
        title: `Ventana óptima: ${best.bridge_name} ${Math.round(best.crossing_hours * 60)}min`,
        body: `${count} tráficos listos para cruzar. Ventana corta detectada.`,
        action_url: '/traficos'
      }
    }
  }
  return null
}

async function checkUnusualValues() {
  const alerts = []
  const { data: recent } = await supabase
    .from('globalpc_facturas')
    .select('cve_trafico, valor, cve_proveedor, company_id')
    .order('fecha', { ascending: false })
    .limit(100)

  if (!recent?.length) return alerts

  // Group by supplier and check for outliers
  const bySupplier = {}
  recent.forEach(f => {
    if (!f.cve_proveedor || !f.valor) return
    if (!bySupplier[f.cve_proveedor]) bySupplier[f.cve_proveedor] = []
    bySupplier[f.cve_proveedor].push(f.valor)
  })

  for (const [supplier, values] of Object.entries(bySupplier)) {
    if (values.length < 3) continue
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const std = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length)
    const latest = values[0]
    if (std > 0 && Math.abs(latest - avg) > 2 * std) {
      alerts.push({
        type: 'unusual_value',
        priority: 'medium',
        title: `Valor inusual: proveedor ${supplier}`,
        body: `Último: $${latest.toLocaleString()} vs promedio $${Math.round(avg).toLocaleString()}`,
        action_url: '/pedimentos'
      })
    }
  }
  return alerts.slice(0, 3)
}

async function checkSeasonalPrep() {
  const { data: memories } = await supabase
    .from('cruz_memory')
    .select('company_id, pattern_value')
    .eq('pattern_key', 'peak_month')
    .eq('actionable', true)

  if (!memories?.length) return null

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const currentMonth = new Date().getMonth()
  const nextMonth = (currentMonth + 1) % 12
  const in2Months = (currentMonth + 2) % 12

  for (const m of memories) {
    const peakIdx = months.indexOf(m.pattern_value)
    if (peakIdx === nextMonth || peakIdx === in2Months) {
      return {
        type: 'seasonal_prep',
        priority: 'medium',
        title: `Pico de ${m.pattern_value} se acerca`,
        body: `Preparar documentación adicional para volumen esperado`,
        action_url: '/reportes'
      }
    }
  }
  return null
}

async function run() {
  console.log('\n🤖 CONCIERGE ENGINE')
  console.log('═'.repeat(40))

  const alerts = []

  const crossing = await checkOptimalCrossingWindow()
  if (crossing) alerts.push(crossing)

  const valueAlerts = await checkUnusualValues()
  alerts.push(...valueAlerts)

  const seasonal = await checkSeasonalPrep()
  if (seasonal) alerts.push(seasonal)

  // MVE check (critical until March 31)
  const daysToMVE = Math.ceil((new Date('2026-03-31').getTime() - Date.now()) / 86400000)
  if (daysToMVE > 0 && daysToMVE <= 7) {
    const { count } = await supabase
      .from('traficos')
      .select('*', { count: 'exact', head: true })
      .neq('estatus', 'Cruzado')
      .is('mve_folio', null)
    if ((count || 0) > 0) {
      alerts.push({
        type: 'mve_critical',
        priority: 'critical',
        title: `MVE: ${daysToMVE} días · ${count} sin folio`,
        body: `Multa potencial: $${((count || 0) * 5990).toLocaleString()} MXN`,
        action_url: '/mve'
      })
    }
  }

  console.log(`Generated ${alerts.length} alerts`)
  alerts.forEach(a => console.log(`  ${a.priority === 'critical' ? '🚨' : a.priority === 'high' ? '🟡' : '💡'} ${a.title}`))

  // Send critical/high alerts to Telegram
  const urgent = alerts.filter(a => a.priority === 'critical' || a.priority === 'high')
  if (urgent.length > 0) {
    await tg(
      `🤖 <b>CRUZ Concierge</b>\n` +
      urgent.map(a => `${a.priority === 'critical' ? '🚨' : '🟡'} ${a.title}\n   ${a.body}`).join('\n\n') +
      `\n\n— CRUZ 🦀`
    )
  }
}

run().catch(console.error)
