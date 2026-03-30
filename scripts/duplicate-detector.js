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

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' USD' }

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function run() {
  console.log('🔎 Duplicate Invoice Detector — Starting...\n')

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
    // Check for same invoice number from same supplier
    const [sameInvoice] = await conn.query(`
      SELECT
        f1.numero_factura,
        f1.proveedor,
        COUNT(*) as count,
        SUM(f1.valor) as total_value,
        GROUP_CONCAT(DISTINCT f1.cve_trafico) as traficos
      FROM cb_factura f1
      WHERE f1.fecha >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        AND f1.numero_factura IS NOT NULL
        AND f1.numero_factura != ''
      GROUP BY f1.numero_factura, f1.proveedor
      HAVING COUNT(*) > 1
    `)

    console.log(`📋 Same invoice number duplicates: ${sameInvoice.length}`)

    // Check for same value from same supplier within 7 days
    const [sameValue] = await conn.query(`
      SELECT
        f1.cve_trafico as trafico1,
        f2.cve_trafico as trafico2,
        f1.proveedor,
        f1.valor,
        f1.fecha as fecha1,
        f2.fecha as fecha2,
        DATEDIFF(f2.fecha, f1.fecha) as days_apart
      FROM cb_factura f1
      JOIN cb_factura f2 ON
        f2.proveedor = f1.proveedor AND
        f2.valor = f1.valor AND
        f2.id > f1.id AND
        f2.cve_trafico != f1.cve_trafico AND
        f2.fecha BETWEEN f1.fecha AND DATE_ADD(f1.fecha, INTERVAL 7 DAY)
      WHERE f1.fecha >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        AND f1.valor > 100
      LIMIT 200
    `)

    console.log(`💰 Same value duplicates (within 7 days): ${sameValue.length}\n`)

    const duplicates = []

    // Process same-invoice duplicates
    sameInvoice.forEach(d => {
      const traficosArr = (d.traficos || '').split(',').filter(Boolean)
      if (traficosArr.length < 2) return
      duplicates.push({
        trafico_id_1: traficosArr[0],
        trafico_id_2: traficosArr[1],
        duplicate_type: 'same_invoice_number',
        invoice_number: d.numero_factura,
        supplier: d.proveedor,
        value: Number(d.total_value) / Number(d.count),
        confidence: 0.95,
        status: 'pending',
        company_id: COMPANY_ID,
        detected_at: new Date().toISOString(),
      })
    })

    // Process same-value duplicates
    sameValue.forEach(d => {
      duplicates.push({
        trafico_id_1: String(d.trafico1),
        trafico_id_2: String(d.trafico2),
        duplicate_type: 'same_value_same_supplier',
        invoice_number: null,
        supplier: d.proveedor,
        value: Number(d.valor),
        confidence: d.days_apart <= 1 ? 0.85 : 0.65,
        status: 'pending',
        company_id: COMPANY_ID,
        detected_at: new Date().toISOString(),
      })
    })

    console.log(`📊 Total duplicates to save: ${duplicates.length}`)

    // Save to Supabase
    if (duplicates.length > 0) {
      const BATCH = 100
      let saved = 0
      for (let i = 0; i < duplicates.length; i += BATCH) {
        const batch = duplicates.slice(i, i + BATCH)
        const { error } = await supabase.from('duplicates_detected').insert(batch)
        if (error) {
          if (error.code === '42P01') {
            console.error('❌ Table duplicates_detected does not exist. Run SQL migration.')
            break
          }
          // Try upsert if duplicates exist
          if (error.code === '23505') continue
          console.error('Save error:', error.message)
        } else {
          saved += batch.length
        }
      }
      console.log(`✅ Saved ${saved} duplicate records`)
    }

    // Alert for high-confidence duplicates
    const highConfidence = duplicates.filter(d => d.confidence >= 0.8)
    if (highConfidence.length > 0) {
      const alerts = highConfidence.slice(0, 5).map(d =>
        `⚠️ Factura ${d.invoice_number || 'N/A'} de ${(d.supplier || '').substring(0, 25)}\n` +
        `   Tráficos: ${d.trafico_id_1} y ${d.trafico_id_2}\n` +
        `   Valor: ${fmtUSD(d.value)} | Confianza: ${Math.round(d.confidence * 100)}%`
      ).join('\n\n')

      await sendTelegram(
        `🔎 <b>DUPLICADOS DETECTADOS</b>\n\n` +
        `Total encontrados: ${duplicates.length}\n` +
        `Alta confianza: ${highConfidence.length}\n\n` +
        alerts + '\n\n' +
        `<b>Acción requerida antes de transmitir</b>\n\nCRUZ 🦀`
      )
    }

    console.log('\n✅ Duplicate Detector — Complete')
  } catch (err) {
    console.error('❌ Error:', err.message)
    await sendTelegram(`❌ Duplicate Detector failed: ${err.message}`)
  } finally {
    if (conn) await conn.end()
  }
}

run()
