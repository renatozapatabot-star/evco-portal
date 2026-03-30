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
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

function hoursBetween(d1, d2) {
  if (!d1 || !d2) return null
  const t1 = new Date(d1).getTime()
  const t2 = new Date(d2).getTime()
  if (isNaN(t1) || isNaN(t2)) return null
  const h = (t2 - t1) / 3600000
  return h >= 0 ? Math.round(h * 100) / 100 : null
}

// ct_evento catalog codes (actual GlobalPC):
// 480 = TRAFICO (created)
// 481 = ENTRADA DE BODEGA (warehouse arrival)
// 482 = FACTURAS (invoices received)
// 483 = GENERACION FICHA CLASIFICACION
// 484 = GENERAR SOLICITUD IMPUESTOS
// 485 = GENERAR INTERFASE PEDIMENTOS
// 486 = DATOS INICIALES PEDIMENTO
// 487 = ORDEN DE CARGA Y REMISION
// 500 = GENERACIÓN DE EXPEDIENTE DIGITAL
// 505 = AVISO DE DESADUANAMIENTO DE MERCANCIA
// 506 = AVISO DE PAGO
// 507 = DESADUANAMIENTO LIBRE (green light / cleared)
// 508 = PEDIMENTO RECTIFICADO
// 509 = RECONOCIMIENTO ADUANERO (red light / inspection)
// 511 = RECONOCIMIENTO CON TOMA DE MUESTRA (inspection w/ sample)
const RED_CODES = [509, 511]        // reconocimiento = red light
const GREEN_CODES = [507]           // desaduanamiento libre = green light
const INSPECTION_CODES = [509, 511]
const DESADUANADO_CODE = 505

async function run() {
  console.log('🔍 Deep Crossing Intelligence — Starting...\n')

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
    console.log('✅ MySQL connected\n')
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message)
    return
  }

  try {
    // 1. Query crossing times directly from cb_trafico date fields
    //    dFechaLlegadaMercancia (99.99% fill) → dFechaCruce (92% fill)
    const [traficos] = await conn.query(`
      SELECT
        t.sCveTrafico AS cve_trafico,
        t.sCveTransportistaMexicano AS transportista_mexicano,
        t.sCveTransportistaAmericano AS transportista_extranjero,
        t.iConsecutivoOficina AS aduana,
        t.iPesoBruto AS peso_bruto,
        t.dFechaLlegadaMercancia AS fecha_llegada,
        t.dFechaCruce AS fecha_cruce,
        t.dFechaPago AS fecha_pago,
        t.dFechaArribo AS fecha_arribo,
        t.dFechaEntradaRecintoFiscal AS fecha_recinto,
        DAYOFWEEK(t.dFechaLlegadaMercancia) AS dia_semana
      FROM cb_trafico t
      WHERE t.dFechaLlegadaMercancia IS NOT NULL
    `)
    console.log(`📊 Fetched ${fmtNum(traficos.length)} tráficos with date data\n`)

    // 2. Query event codes from cb_eventos_trafico joined with ct_evento catalog
    //    to identify semáforo results (rojo/verde) and inspections
    const [events] = await conn.query(`
      SELECT
        e.sCveTrafico AS cve_trafico,
        e.iConsecutivoEvento AS event_code,
        e.dFecha AS fecha,
        e.sComentarios AS comentarios,
        ev.sNombre AS event_name
      FROM cb_eventos_trafico e
      JOIN ct_evento ev ON ev.iConsecutivo = e.iConsecutivoEvento
      WHERE e.iConsecutivoEvento IN (480,481,482,485,486,505,506,507,509,511)
      ORDER BY e.sCveTrafico, e.dFecha
    `)
    console.log(`📊 Fetched ${fmtNum(events.length)} semáforo/inspection/desaduanamiento events\n`)

    // Group events by tráfico
    const eventsByTrafico = {}
    events.forEach(e => {
      if (!eventsByTrafico[e.cve_trafico]) eventsByTrafico[e.cve_trafico] = []
      eventsByTrafico[e.cve_trafico].push(e)
    })

    // 3. Build crossing intelligence records
    const records = []
    let redLightCount = 0
    let greenLightCount = 0
    let inspectionCount = 0
    const bottleneckCounts = {}
    const carrierRedLights = {}
    const dayOfWeekStats = {}

    traficos.forEach(t => {
      const totalHours = hoursBetween(t.fecha_llegada, t.fecha_cruce)
      const arriboToLlegada = hoursBetween(t.fecha_arribo, t.fecha_llegada)
      const llegadaToPago = hoursBetween(t.fecha_llegada, t.fecha_pago)
      const pagoToCruce = hoursBetween(t.fecha_pago, t.fecha_cruce)

      // Skip records with no crossing or unreasonable times
      if (totalHours !== null && (totalHours < 0 || totalHours > 2160)) return // >90 days = bad data

      // Semáforo from events
      const evts = eventsByTrafico[t.cve_trafico] || []
      let semaforoValue = null
      let hadInspection = false

      evts.forEach(e => {
        const code = Number(e.event_code)
        if (RED_CODES.includes(code)) semaforoValue = 'rojo'
        else if (GREEN_CODES.includes(code) && !semaforoValue) semaforoValue = 'verde'
        if (INSPECTION_CODES.includes(code)) hadInspection = true
      })

      if (semaforoValue === 'rojo') {
        redLightCount++
        const carrier = t.transportista_mexicano || 'Unknown'
        carrierRedLights[carrier] = (carrierRedLights[carrier] || 0) + 1
      }
      if (semaforoValue === 'verde') greenLightCount++
      if (hadInspection) inspectionCount++

      // Bottleneck analysis
      const stageTimes = {
        'arribo_to_llegada': arriboToLlegada,
        'llegada_to_pago': llegadaToPago,
        'pago_to_cruce': pagoToCruce,
      }
      let bottleneck = null
      let maxTime = 0
      Object.entries(stageTimes).forEach(([stage, time]) => {
        if (time && time > 0 && time > maxTime) { maxTime = time; bottleneck = stage }
      })
      if (bottleneck) bottleneckCounts[bottleneck] = (bottleneckCounts[bottleneck] || 0) + 1

      // Day of week stats
      const dow = t.dia_semana // 1=Sun ... 7=Sat
      if (dow && totalHours !== null && totalHours > 0) {
        if (!dayOfWeekStats[dow]) dayOfWeekStats[dow] = { hours: [], count: 0 }
        dayOfWeekStats[dow].hours.push(totalHours)
        dayOfWeekStats[dow].count++
      }

      records.push({
        trafico_id: String(t.cve_trafico),
        total_hours: totalHours,
        stage_arrival_to_docs: arriboToLlegada,
        stage_docs_to_semaforo: llegadaToPago,
        stage_semaforo_to_release: pagoToCruce,
        semaforo: semaforoValue,
        had_inspection: hadInspection,
        bottleneck_stage: bottleneck,
        red_light_probability: null,
        company_id: COMPANY_ID,
        created_at: new Date().toISOString(),
      })
    })

    // 4. Red light probability per carrier
    const totalWithSemaforo = redLightCount + greenLightCount
    const baseRedRate = totalWithSemaforo > 0 ? redLightCount / totalWithSemaforo : 0.1

    // Count per carrier
    const carrierTotals = {}
    traficos.forEach(t => {
      const c = t.transportista_mexicano || 'Unknown'
      carrierTotals[c] = (carrierTotals[c] || 0) + 1
    })

    records.forEach(r => {
      const carrier = (traficos.find(t => String(t.cve_trafico) === r.trafico_id) || {}).transportista_mexicano || 'Unknown'
      const carrierTotal = carrierTotals[carrier] || 1
      const carrierReds = carrierRedLights[carrier] || 0
      const carrierRate = carrierTotal >= 5 ? carrierReds / carrierTotal : baseRedRate
      const prob = carrierTotal >= 5 ? (baseRedRate * 0.4 + carrierRate * 0.6) : baseRedRate
      r.red_light_probability = Math.max(0.01, Math.min(0.95, Math.round(prob * 100) / 100))
    })

    // 5. Stats
    const withHours = records.filter(r => r.total_hours != null && r.total_hours > 0 && r.total_hours < 720)
    const avgHours = withHours.length > 0 ? withHours.reduce((s, r) => s + r.total_hours, 0) / withHours.length : 0
    const medianIdx = Math.floor(withHours.length / 2)
    const sortedHours = withHours.map(r => r.total_hours).sort((a, b) => a - b)
    const medianHours = sortedHours[medianIdx] || 0

    console.log(`🚦 Semáforo analysis:`)
    console.log(`   Red lights: ${redLightCount}`)
    console.log(`   Green lights: ${greenLightCount}`)
    console.log(`   Red rate: ${(baseRedRate * 100).toFixed(1)}%`)
    console.log(`   Inspections: ${inspectionCount}`)

    console.log(`\n🔧 Bottleneck analysis:`)
    Object.entries(bottleneckCounts).sort((a, b) => b[1] - a[1]).forEach(([stage, count]) => {
      console.log(`   ${stage}: ${fmtNum(count)} tráficos`)
    })

    console.log(`\n⏱️  Crossing times (records with >0h):`)
    console.log(`   Count: ${fmtNum(withHours.length)}`)
    console.log(`   Average: ${avgHours.toFixed(1)} hours`)
    console.log(`   Median: ${medianHours.toFixed(1)} hours`)
    console.log(`   P10: ${sortedHours[Math.floor(sortedHours.length * 0.1)]?.toFixed(1) || '—'}h`)
    console.log(`   P90: ${sortedHours[Math.floor(sortedHours.length * 0.9)]?.toFixed(1) || '—'}h`)

    console.log(`\n📅 By day of week:`)
    const dayNames = ['', 'Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    Object.entries(dayOfWeekStats).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([day, data]) => {
      const avg = data.hours.reduce((s, h) => s + h, 0) / data.hours.length
      console.log(`   ${dayNames[Number(day)]}: ${avg.toFixed(1)}h avg (${fmtNum(data.count)} ops)`)
    })

    // 6. Save to Supabase
    const BATCH = 500
    let saved = 0
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const { error } = await supabase.from('crossing_intelligence').upsert(batch, {
        onConflict: 'trafico_id',
        ignoreDuplicates: false,
      })
      if (error) {
        console.error(`Batch ${i}-${i + BATCH} error:`, error.message)
      } else {
        saved += batch.length
      }
    }
    console.log(`\n✅ Saved ${fmtNum(saved)} crossing intelligence records`)

    // 7. Carrier red light ranking
    const carrierRanking = Object.entries(carrierRedLights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    if (carrierRanking.length > 0) {
      console.log('\n🚛 Top carriers by red lights:')
      carrierRanking.forEach(([carrier, count]) => {
        const total = carrierTotals[carrier] || 1
        const rate = ((count / total) * 100).toFixed(1)
        console.log(`   ${carrier}: ${count} reds / ${total} ops (${rate}%)`)
      })
    }

    // Only send Telegram if red lights detected
    if (redLightCount > 0) {
      await sendTelegram(
        `🔴 <b>Crossing Alert — ${redLightCount} Red Lights</b>\n\n` +
        `Tráficos: ${fmtNum(records.length)}\n` +
        `🔴 Red: ${redLightCount} (${(baseRedRate * 100).toFixed(1)}% rate)\n` +
        `Inspections: ${inspectionCount}\n\n` +
        `CRUZ 🦀`
      )
    }

    console.log('\n✅ Deep Crossing Intelligence — Complete')

  } catch (err) {
    console.error('❌ Error:', err.message)
    await sendTelegram(`❌ Deep Crossing Intelligence failed: ${err.message}`)
  } finally {
    if (conn) await conn.end()
  }
}

run()
