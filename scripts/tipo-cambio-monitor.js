const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const BANXICO_TOKEN = process.env.BANXICO_TOKEN
const CLAVE = '9254'

function fmt4(n) { return Number(n).toFixed(4) }
function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function getBanxicoRate() {
  // Method 1: Banxico API (requires free token from banxico.org.mx/SieAPIRest)
  if (BANXICO_TOKEN) {
    try {
      const url = 'https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno'
      const res = await fetch(url, { headers: { 'Bmx-Token': BANXICO_TOKEN } })
      const data = await res.json()
      const rate = parseFloat(data?.bmx?.series?.[0]?.datos?.[0]?.dato)
      const date = data?.bmx?.series?.[0]?.datos?.[0]?.fecha
      if (rate && !isNaN(rate)) return { rate, date, source: 'Banxico API' }
    } catch (e) {
      console.log('Banxico API failed, trying fallback:', e.message)
    }
  }

  // Method 2: Fallback — use average of recent pedimentos as proxy
  console.log('⚠️  No BANXICO_TOKEN in .env.local — using pedimento average as proxy')
  const { data } = await supabase
    .from('aduanet_facturas')
    .select('tipo_cambio, fecha_pago')
    .eq('clave_cliente', CLAVE)
    .not('tipo_cambio', 'is', null)
    .gte('fecha_pago', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
    .order('fecha_pago', { ascending: false })
    .limit(20)

  const rates = (data || []).map(r => r.tipo_cambio).filter(Boolean)
  if (rates.length === 0) throw new Error('No tipo_cambio data available')
  const avg = rates.reduce((s, r) => s + r, 0) / rates.length
  return { rate: avg, date: new Date().toISOString().split('T')[0], source: 'Pedimento average (proxy)' }
}

async function runTipoCambioMonitor() {
  console.log('💱 Running Tipo de Cambio Monitor...')

  const { rate: banxicoRate, date: rateDate, source } = await getBanxicoRate()
  console.log(`📊 Rate: $${fmt4(banxicoRate)} MXN/USD (${source} · ${rateDate})`)

  // Get this week's pedimentos
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  weekStart.setHours(0, 0, 0, 0)

  const { data: facturas } = await supabase
    .from('aduanet_facturas')
    .select('referencia, pedimento, tipo_cambio, fecha_pago, valor_usd, proveedor')
    .eq('clave_cliente', CLAVE)
    .not('tipo_cambio', 'is', null)
    .gte('fecha_pago', weekStart.toISOString().split('T')[0])
    .order('fecha_pago', { ascending: false })

  const rows = facturas || []
  console.log(`📋 Checking ${rows.length} pedimentos this week`)

  // Flag deviations > 1%
  const flags = rows.filter(f => {
    const deviation = Math.abs(f.tipo_cambio - banxicoRate) / banxicoRate
    return deviation > 0.01
  }).map(f => ({
    ...f,
    deviation_pct: ((Math.abs(f.tipo_cambio - banxicoRate) / banxicoRate) * 100).toFixed(2)
  }))

  // Save rate to Supabase (create table if needed)
  await supabase.from('tipo_cambio_history').upsert({
    date: rateDate,
    tc_fix: banxicoRate,
    source
  }, { onConflict: 'date' }).then(({ error }) => {
    if (error && error.code === '42P01') {
      console.log('⚠️  tipo_cambio_history table not yet created — skipping save')
    }
  })

  if (flags.length === 0) {
    console.log('✅ All tipo_cambio values within 1% of Banxico rate')
  } else {
    console.log(`⚠️  ${flags.length} pedimento(s) with deviation > 1%:`)
    flags.forEach(f => console.log(`  ${f.referencia}: $${fmt4(f.tipo_cambio)} (${f.deviation_pct}% off)`))

    await sendTelegram([
      `⚠️ <b>TIPO DE CAMBIO — DESVIACIÓN</b>`,
      `${nowCST()}`,
      `Banxico FIX: $${fmt4(banxicoRate)} MXN/USD`,
      ``,
      `<b>Pedimentos con desviación > 1%:</b>`,
      ...flags.map(f => `• ${f.referencia || f.pedimento}: $${fmt4(f.tipo_cambio)} (${f.deviation_pct}% off)`),
      ``,
      `Acción: Revisar antes de transmisión SAAI`,
      `Patente 3596 · Aduana 240`,
      `— CRUZ 🦀`
    ].join('\n'))
  }
}

runTipoCambioMonitor().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
