#!/usr/bin/env node
/**
 * CRUZ Historical Data Sync
 * One-time run to pull complete history for all 50 clients
 * Uses Qwen locally for classification ($0 cost)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')
const fs = require('fs')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CHECKPOINT_FILE = '/tmp/historical-sync-checkpoint.json'
const OLLAMA_URL = 'http://localhost:11434/api/generate'

function loadCheckpoint() {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'))
  } catch { return { completed: [], last_company: null, last_offset: 0 } }
}

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2))
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function qwenClassify(description) {
  if (!description?.trim()) return null
  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:8b',
        prompt: `You are a Mexican customs expert. Classify this product under the TIGIE tariff schedule.
Product: "${description}"
Return ONLY the 8-digit HTS code in format XXXX.XX.XX and nothing else.
If unsure, return the most likely 4-digit chapter code.`,
        stream: false,
        options: { temperature: 0.1, num_predict: 20 }
      }),
      signal: AbortSignal.timeout(15000)
    })
    const data = await res.json()
    const match = (data.response || '').match(/\d{4}[\.\d]{0,7}/)
    return match ? match[0] : null
  } catch { return null }
}

async function syncAllHistoricalData() {
  const checkpoint = loadCheckpoint()
  console.log('\n📚 CRUZ HISTORICAL SYNC')
  console.log('═'.repeat(50))
  console.log('Pulling complete history for all clients...\n')

  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST,
    port: parseInt(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38'
  })

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .eq('active', true)

  console.log(`${companies?.length || 0} active companies\n`)

  for (const company of (companies || [])) {
    if (checkpoint.completed.includes(company.company_id)) {
      console.log(`⏭️  Skipping ${company.name} (already synced)`)
      continue
    }

    const clave = company.globalpc_clave || company.clave_cliente
    if (!clave) { console.log(`⏭️  Skipping ${company.name} (no clave)`); continue }
    console.log(`\n📦 ${company.name} (${clave})`)

    try {
      // Pull ALL tráficos
      const [traficos] = await conn.execute(
        'SELECT * FROM cb_trafico WHERE sCveCliente = ? ORDER BY dFechaLlegadaMercancia DESC',
        [clave]
      )
      console.log(`   Tráficos: ${traficos.length}`)

      for (let i = 0; i < traficos.length; i += 100) {
        const batch = traficos.slice(i, i + 100).map(t => ({
          trafico: t.sCveTrafico,
          clave_cliente: t.sCveCliente,
          company_id: company.company_id,
          fecha_llegada: t.dFechaLlegadaMercancia,
          fecha_cruce: t.dFechaCruce,
          fecha_pago: t.dFechaPago,
          estatus: t.sCveEstatusEDespacho,
          peso_bruto: t.iPesoBruto,
          transportista_extranjero: t.sCveTransportistaAmericano,
          transportista_mexicano: t.sCveTransportistaMexicano,
          pedimento: t.sNumPedimento,
          regimen: t.eCveRegimen,
          descripcion_mercancia: t.sDescripcionMercancia,
          updated_at: new Date().toISOString()
        }))
        await supabase.from('traficos').upsert(batch, { onConflict: 'trafico' })
        process.stdout.write(`\r   Syncing tráficos: ${Math.min(i + 100, traficos.length)}/${traficos.length}`)
      }
      console.log('')

      // Pull ALL facturas
      const [facturas] = await conn.execute(`
        SELECT f.iFolio, f.sCveTrafico, f.sNumero, f.sCveProveedor,
               f.iValorComercial, f.sCveMoneda, f.dFechaFacturacion,
               f.sCoveVucem, f.sCveIncoterm
        FROM cb_factura f
        WHERE f.sCveTrafico IN (
          SELECT sCveTrafico FROM cb_trafico WHERE sCveCliente = ?
        )
      `, [clave])
      console.log(`   Facturas: ${facturas.length}`)

      for (let i = 0; i < facturas.length; i += 200) {
        const batch = facturas.slice(i, i + 200).map(f => ({
          factura_id: f.iFolio,
          cve_trafico: f.sCveTrafico,
          numero_factura: f.sNumero,
          cve_proveedor: f.sCveProveedor,
          valor: f.iValorComercial,
          moneda: f.sCveMoneda,
          fecha: f.dFechaFacturacion,
          cove: f.sCoveVucem,
          incoterm: f.sCveIncoterm,
          company_id: company.company_id,
          clave_cliente: clave
        }))
        await supabase.from('globalpc_facturas').upsert(batch, { onConflict: 'factura_id' })
        process.stdout.write(`\r   Syncing facturas: ${Math.min(i + 200, facturas.length)}/${facturas.length}`)
      }
      console.log('')

      // Pull ALL products and classify with Qwen
      const [products] = await conn.execute(`
        SELECT pf.iFolio, pf.sCveCliente, pf.sCveProveedor,
               pf.iPrecioUnitarioProducto as valor_unitario,
               pf.iCantidadProducto as cantidad,
               pf.sCveUMC as unidad_medida
        FROM cb_producto_factura pf
        WHERE pf.sCveCliente = ?
      `, [clave])
      console.log(`   Products: ${products.length}`)

      for (let i = 0; i < products.length; i += 500) {
        const batch = products.slice(i, i + 500).map(p => ({
          producto_id: p.iFolio,
          cve_proveedor: p.sCveProveedor,
          valor_unitario: p.valor_unitario,
          cantidad: p.cantidad,
          unidad_medida: p.unidad_medida,
          company_id: company.company_id,
          clave_cliente: clave
        }))
        await supabase.from('globalpc_productos').upsert(batch, { onConflict: 'producto_id' })
        process.stdout.write(`\r   Syncing products: ${Math.min(i + 500, products.length)}/${products.length}`)
      }
      console.log('')

      // Pull ALL crossing events
      const [eventos] = await conn.execute(`
        SELECT e.iConsecutivo, e.sCveTrafico, e.sComentarios, e.dFecha, e.sRegistradoPor
        FROM cb_eventos_trafico e
        JOIN cb_trafico t ON t.sCveTrafico = e.sCveTrafico
        WHERE t.sCveCliente = ?
        ORDER BY e.dFecha DESC
      `, [clave])
      console.log(`   Events: ${eventos.length}`)

      for (let i = 0; i < eventos.length; i += 500) {
        const batch = eventos.slice(i, i + 500).map(e => ({
          evento_id: e.iConsecutivo,
          cve_trafico: e.sCveTrafico,
          evento: e.sComentarios,
          fecha: e.dFecha,
          usuario: e.sRegistradoPor,
          company_id: company.company_id
        }))
        await supabase.from('globalpc_eventos').upsert(batch, { onConflict: 'evento_id' })
        process.stdout.write(`\r   Syncing events: ${Math.min(i + 500, eventos.length)}/${eventos.length}`)
      }
      console.log('')

      checkpoint.completed.push(company.company_id)
      saveCheckpoint(checkpoint)

      console.log(`   ✅ ${company.name} complete`)
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`)
    }
  }

  await conn.end()

  const completedCount = checkpoint.completed.length
  const totalCompanies = companies?.length || 0
  const successRate = Math.round(completedCount / totalCompanies * 100)

  console.log('\n✅ Historical sync complete!')
  console.log(`Completed: ${completedCount}/${totalCompanies} clients (${successRate}%)`)

  // Telegram notification
  if (process.env.TELEGRAM_BOT_TOKEN) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: '-5085543275',
        text: `✅ HISTORICAL SYNC COMPLETE\n${completedCount}/${totalCompanies} clientes (${successRate}%)\nCheckpoint: ${CHECKPOINT_FILE}\n— CRUZ 🦀`
      })
    }).catch(() => {})
  }
}

syncAllHistoricalData().catch(console.error)
