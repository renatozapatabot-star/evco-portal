const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

function fmtNum(n) { return Number(n || 0).toLocaleString('es-MX') }

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function run() {
  console.log('🚦 Red Light Predictor — Starting...\n')

  let conn
  try {
    conn = await mysql.createConnection({
      host: process.env.GLOBALPC_DB_HOST,
      port: Number(process.env.GLOBALPC_DB_PORT),
      user: process.env.GLOBALPC_DB_USER,
      password: process.env.GLOBALPC_DB_PASS,
      database: 'bd_demo_38',
      connectTimeout: 15000,
    })
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message)
    return
  }

  try {
    // Extract red light history from events
    const [rows] = await conn.query(`
      SELECT
        e.cve_trafico,
        MAX(CASE WHEN LOWER(e.evento) LIKE '%rojo%' OR
          LOWER(e.evento) LIKE '%reconocimiento%' OR
          LOWER(e.evento) LIKE '%inspecci%' THEN 1 ELSE 0 END) as got_red_light,
        t.transportista_mexicano,
        t.transportista_extranjero,
        DAYOFWEEK(t.fecha_llegada) as day_of_week,
        t.peso_bruto
      FROM cb_eventos_trafico e
      JOIN cb_trafico t ON t.cve_trafico = e.cve_trafico
      WHERE t.fecha_llegada IS NOT NULL
      GROUP BY e.cve_trafico, t.transportista_mexicano,
        t.transportista_extranjero, t.fecha_llegada, t.peso_bruto
    `)

    console.log(`📊 Analyzed ${fmtNum(rows.length)} tráficos for red light history\n`)

    const totalOps = rows.length
    const totalRed = rows.filter(r => r.got_red_light).length
    const baseRate = totalOps > 0 ? totalRed / totalOps : 0.1

    console.log(`🚦 Base red light rate: ${(baseRate * 100).toFixed(1)}% (${totalRed}/${totalOps})`)

    // By carrier
    const carrierStats = {}
    rows.forEach(r => {
      const carrier = r.transportista_mexicano || r.transportista_extranjero || 'Unknown'
      if (!carrierStats[carrier]) carrierStats[carrier] = { total: 0, red: 0 }
      carrierStats[carrier].total++
      if (r.got_red_light) carrierStats[carrier].red++
    })

    // By day of week
    const dayStats = {}
    rows.forEach(r => {
      const day = r.day_of_week || 0
      if (!dayStats[day]) dayStats[day] = { total: 0, red: 0 }
      dayStats[day].total++
      if (r.got_red_light) dayStats[day].red++
    })

    // By weight range
    const weightRanges = { light: { max: 5000, total: 0, red: 0 }, medium: { max: 20000, total: 0, red: 0 }, heavy: { max: Infinity, total: 0, red: 0 } }
    rows.forEach(r => {
      const w = Number(r.peso_bruto) || 0
      const range = w < 5000 ? 'light' : w < 20000 ? 'medium' : 'heavy'
      weightRanges[range].total++
      if (r.got_red_light) weightRanges[range].red++
    })

    console.log('\n📊 Red light rates by day:')
    const dayNames = ['', 'Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
    Object.entries(dayStats).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([day, s]) => {
      const rate = s.total > 0 ? (s.red / s.total * 100).toFixed(1) : '0.0'
      console.log(`  ${dayNames[Number(day)] || day}: ${rate}% (${s.red}/${s.total})`)
    })

    console.log('\n📊 Red light rates by weight:')
    Object.entries(weightRanges).forEach(([range, s]) => {
      const rate = s.total > 0 ? (s.red / s.total * 100).toFixed(1) : '0.0'
      console.log(`  ${range}: ${rate}% (${s.red}/${s.total})`)
    })

    // Now calculate predictions for active tráficos
    const { data: activeTraficos } = await supabase
      .from('traficos')
      .select('trafico, transportista_mexicano, transportista_extranjero, fecha_llegada, peso_bruto')
      .eq('company_id', COMPANY_ID)
      .in('estatus', ['En Proceso', 'En Transito', 'Pendiente'])

    const active = activeTraficos || []
    console.log(`\n🔮 Calculating predictions for ${active.length} active tráficos...`)

    const predictions = active.map(t => {
      const carrier = t.transportista_mexicano || t.transportista_extranjero || 'Unknown'
      const cs = carrierStats[carrier]
      const carrierRate = cs && cs.total >= 5 ? cs.red / cs.total : baseRate
      const carrierFactor = baseRate > 0 ? carrierRate / baseRate : 1

      const day = t.fecha_llegada ? new Date(t.fecha_llegada).getDay() + 1 : 0
      const ds = dayStats[day]
      const dayRate = ds && ds.total >= 10 ? ds.red / ds.total : baseRate
      const dayFactor = baseRate > 0 ? dayRate / baseRate : 1

      const weight = Number(t.peso_bruto) || 0
      const wRange = weight < 5000 ? 'light' : weight < 20000 ? 'medium' : 'heavy'
      const ws = weightRanges[wRange]
      const weightRate = ws.total >= 10 ? ws.red / ws.total : baseRate
      const weightFactor = baseRate > 0 ? weightRate / baseRate : 1

      let probability = baseRate * carrierFactor * dayFactor * weightFactor
      probability = Math.min(0.95, Math.max(0.05, probability))
      probability = Math.round(probability * 100) / 100

      const factors = []
      if (carrierFactor > 1.2) factors.push(`Carrier ${(carrierFactor).toFixed(1)}x`)
      if (dayFactor > 1.2) factors.push(`Día ${dayNames[day] || ''} ${(dayFactor).toFixed(1)}x`)
      if (weightFactor > 1.2) factors.push(`Peso ${(weightFactor).toFixed(1)}x`)

      return {
        trafico_id: t.trafico,
        probability,
        factors,
        carrier,
      }
    })

    // Save to pedimento_risk_scores
    let updated = 0
    for (const pred of predictions) {
      const { error } = await supabase
        .from('pedimento_risk_scores')
        .upsert({
          trafico_id: pred.trafico_id,
          red_light_probability: pred.probability,
          company_id: COMPANY_ID,
          calculated_at: new Date().toISOString(),
        }, { onConflict: 'trafico_id' })
      if (!error) updated++
    }

    console.log(`\n✅ Updated ${updated} red light predictions`)

    // Alert for high-probability tráficos
    const highRisk = predictions.filter(p => p.probability > 0.3)
    if (highRisk.length > 0) {
      const alerts = highRisk.slice(0, 5).map(p =>
        `🚦 ${p.trafico_id}: ${Math.round(p.probability * 100)}% — ${p.factors.join(', ') || 'factores base'}`
      ).join('\n')

      await sendTelegram(
        `🚦 <b>Red Light Predictor</b>\n\n` +
        `Base rate: ${(baseRate * 100).toFixed(1)}%\n` +
        `Active tráficos: ${active.length}\n` +
        `High risk (>30%): ${highRisk.length}\n\n` +
        `<b>Alertas:</b>\n${alerts}\n\n` +
        `CRUZ 🦀`
      )
    }

    console.log('\n✅ Red Light Predictor — Complete')
  } catch (err) {
    console.error('❌ Error:', err.message)
    await sendTelegram(`❌ Red Light Predictor failed: ${err.message}`)
  } finally {
    if (conn) await conn.end()
  }
}

run()
