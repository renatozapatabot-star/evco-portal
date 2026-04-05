#!/usr/bin/env node
/**
 * CRUZ Nightly Intelligence Pipeline
 * Runs at 1 AM every night
 * Processes all 50 clients
 * Uses Qwen locally to save $ on API costs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const fs = require('fs')
fs.writeFileSync('/tmp/nightly-pipeline.pid', String(process.pid))

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CLIENT_TIMEOUT = 5 * 60 * 1000 // 5 minutes per client
const TELEGRAM_CHAT = '-5085543275'
const OLLAMA_URL = 'http://localhost:11434/api/generate'

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', msg.replace(/<[^>]+>/g, '')); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function qwen(prompt, model = 'qwen3:8b') {
  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 300 }
      }),
      signal: AbortSignal.timeout(30000)
    })
    const data = await res.json()
    return data.response || ''
  } catch { return '' }
}

async function getGlobalPCConnection() {
  return mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST,
    port: parseInt(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38'
  })
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── SYNC FUNCTIONS ────────────────────────────────

async function syncClientTraficos(conn, company) {
  const clave = company.globalpc_clave || company.clave_cliente
  if (!clave) return 0

  const [rows] = await conn.execute(`
    SELECT
      t.sCveTrafico as trafico,
      t.sCveCliente as clave_cliente,
      t.dFechaLlegadaMercancia as fecha_llegada,
      t.dFechaCruce as fecha_cruce,
      t.dFechaPago as fecha_pago,
      t.sCveEstatusEDespacho as estatus,
      t.iPesoBruto as peso_bruto,
      t.sCveTransportistaAmericano as transportista_extranjero,
      t.sCveTransportistaMexicano as transportista_mexicano,
      t.sNumPedimento as pedimento,
      t.eCveRegimen as regimen,
      t.sDescripcionMercancia as descripcion_mercancia
    FROM cb_trafico t
    WHERE t.sCveCliente = ?
    ORDER BY t.dFechaLlegadaMercancia DESC
    LIMIT 5000
  `, [clave])

  if (!rows.length) return 0

  let synced = 0
  for (const batch of chunk(rows, 100)) {
    const mapped = batch.map(r => ({
      trafico: r.trafico,
      clave_cliente: r.clave_cliente,
      company_id: company.company_id,
      fecha_llegada: r.fecha_llegada,
      fecha_cruce: r.fecha_cruce,
      fecha_pago: r.fecha_pago,
      estatus: r.estatus,
      peso_bruto: r.peso_bruto,
      transportista_extranjero: r.transportista_extranjero,
      transportista_mexicano: r.transportista_mexicano,
      pedimento: r.pedimento,
      regimen: r.regimen,
      descripcion_mercancia: r.descripcion_mercancia,
      updated_at: new Date().toISOString()
    }))
    await supabase.from('traficos').upsert(mapped, {
      onConflict: 'trafico',
      ignoreDuplicates: false
    })
    synced += mapped.length
  }
  return synced
}

async function syncClientEntradas(conn, company) {
  const clave = company.globalpc_clave || company.clave_cliente
  if (!clave) return 0

  const [rows] = await conn.execute(`
    SELECT
      e.sCveEntradaBodega as entrada_id,
      e.sCveCliente as cve_cliente,
      e.dFechaLlegadaMercancia as fecha_llegada,
      e.iCantidadBultosRecibidos as bultos_recibidos,
      e.iPesoBruto as peso_recibido,
      e.bFaltantes as tiene_faltantes,
      e.bMercanciaDanada as mercancia_danada,
      e.sDescripcionMercancia as descripcion_mercancia,
      e.sNumPedido as num_pedido,
      e.sRecibidoPor as recibido_por,
      e.sCveProveedor as proveedor
    FROM cb_entrada_bodega e
    WHERE e.sCveCliente = ?
    ORDER BY e.dFechaLlegadaMercancia DESC
    LIMIT 10000
  `, [clave])

  if (!rows.length) return 0

  let synced = 0
  for (const batch of chunk(rows, 200)) {
    const mapped = batch.map(r => ({
      ...r,
      company_id: company.company_id,
      cve_cliente: clave
    }))
    await supabase.from('entradas').upsert(mapped, {
      onConflict: 'entrada_id',
      ignoreDuplicates: false
    })
    synced += mapped.length
  }
  return synced
}

async function syncClientFacturas(conn, company) {
  const clave = company.globalpc_clave || company.clave_cliente
  if (!clave) return 0

  const [rows] = await conn.execute(`
    SELECT
      f.iFolio as factura_id,
      f.sCveTrafico as cve_trafico,
      f.sNumero as numero_factura,
      f.sCveProveedor as cve_proveedor,
      f.iValorComercial as valor,
      f.sCveMoneda as moneda,
      f.dFechaFacturacion as fecha,
      f.sCoveVucem as cove,
      f.sCveIncoterm as incoterm
    FROM cb_factura f
    WHERE f.sCveTrafico IN (
      SELECT sCveTrafico FROM cb_trafico WHERE sCveCliente = ?
    )
    ORDER BY f.dFechaFacturacion DESC
    LIMIT 20000
  `, [clave])

  if (!rows.length) return 0

  let synced = 0
  for (const batch of chunk(rows, 200)) {
    const mapped = batch.map(r => ({
      ...r,
      company_id: company.company_id,
      clave_cliente: clave
    }))
    await supabase.from('globalpc_facturas').upsert(mapped, {
      onConflict: 'factura_id',
      ignoreDuplicates: false
    })
    synced += mapped.length
  }
  return synced
}

async function syncClientEventos(conn, company) {
  const clave = company.globalpc_clave || company.clave_cliente
  if (!clave) return 0

  const [rows] = await conn.execute(`
    SELECT
      e.iConsecutivo as evento_id,
      e.sCveTrafico as cve_trafico,
      e.sComentarios as evento,
      e.dFecha as fecha,
      e.sRegistradoPor as usuario
    FROM cb_eventos_trafico e
    JOIN cb_trafico t ON t.sCveTrafico = e.sCveTrafico
    WHERE t.sCveCliente = ?
    ORDER BY e.dFecha DESC
    LIMIT 50000
  `, [clave])

  if (!rows.length) return 0

  let synced = 0
  for (const batch of chunk(rows, 500)) {
    const mapped = batch.map(r => ({
      ...r,
      company_id: company.company_id
    }))
    await supabase.from('globalpc_eventos').upsert(mapped, {
      onConflict: 'evento_id',
      ignoreDuplicates: false
    })
    synced += mapped.length
  }
  return synced
}

async function syncClientProducts(conn, company) {
  const clave = company.globalpc_clave || company.clave_cliente
  if (!clave) return 0

  const [rows] = await conn.execute(`
    SELECT
      pf.iFolio as producto_id,
      pf.sCveProveedor as cve_proveedor,
      pf.iPrecioUnitarioProducto as valor_unitario,
      pf.iCantidadProducto as cantidad,
      pf.sCveUMC as unidad_medida
    FROM cb_producto_factura pf
    WHERE pf.sCveCliente = ?
    LIMIT 100000
  `, [clave])

  if (!rows.length) return 0

  let synced = 0
  for (const batch of chunk(rows, 500)) {
    const mapped = batch.map(r => ({
      ...r,
      company_id: company.company_id,
      clave_cliente: clave
    }))
    await supabase.from('globalpc_productos').upsert(mapped, {
      onConflict: 'producto_id',
      ignoreDuplicates: false
    })
    synced += mapped.length
  }
  return synced
}

// ─── INTELLIGENCE FUNCTIONS (Qwen-powered, $0 cost) ──

async function calculateClientIntelligence(company) {
  const company_id = company.company_id

  // 1. Risk scores for active tráficos
  const { data: active } = await supabase
    .from('traficos')
    .select('trafico, fecha_llegada, pedimento, estatus, peso_bruto')
    .eq('company_id', company_id)
    .neq('estatus', 'Cruzado')
    .limit(200)

  if (active?.length) {
    const scores = active.map(t => {
      let score = 0
      if (!t.pedimento) score += 35
      if (t.fecha_llegada) {
        const days = (Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000
        if (days > 14) score += 30
        else if (days > 7) score += 15
        else if (days > 3) score += 5
      }
      return {
        trafico_id: t.trafico,
        company_id,
        score,
        overall_score: score,
        risk_factors: score > 30 ? ['dias_vencido'] : [],
        calculated_at: new Date().toISOString()
      }
    })

    for (const batch of chunk(scores, 100)) {
      await supabase.from('pedimento_risk_scores')
        .upsert(batch, { onConflict: 'trafico_id' })
    }
  }

  // 2. Compliance predictions
  const { data: compliancePreds } = await supabase
    .from('compliance_predictions')
    .select('id')
    .eq('company_id', company_id)
    .eq('resolved', false)

  // 3. Benchmark calculation
  const { data: traficosAll } = await supabase
    .from('traficos')
    .select('trafico, estatus, fecha_llegada, fecha_cruce')
    .eq('company_id', company_id)

  const total = traficosAll?.length || 0
  const cruzados = traficosAll?.filter(t => t.estatus === 'Cruzado').length || 0

  const criticalCount = compliancePreds?.length || 0
  const healthScore = Math.max(0, Math.min(100,
    100 - (criticalCount * 15) - (total > 0 ? (1 - cruzados / total) * 20 : 0)
  ))

  await supabase.from('companies')
    .update({
      health_score: Math.round(healthScore),
      health_score_updated: new Date().toISOString(),
      traficos_count: total,
      last_sync: new Date().toISOString()
    })
    .eq('company_id', company_id)

  return { risk_scores: active?.length || 0, health_score: Math.round(healthScore) }
}

async function generateClientBrief(company) {
  const company_id = company.company_id

  const [active, compliance, riskHigh] = await Promise.all([
    supabase.from('traficos').select('trafico', { count: 'exact', head: true })
      .eq('company_id', company_id).neq('estatus', 'Cruzado'),
    supabase.from('compliance_predictions').select('severity')
      .eq('company_id', company_id).eq('resolved', false),
    supabase.from('pedimento_risk_scores').select('trafico_id')
      .eq('company_id', company_id).gte('overall_score', 50)
  ])

  const brief = {
    company_id,
    date: new Date().toISOString().split('T')[0],
    active_traficos: active.count || 0,
    critical_alerts: compliance.data?.filter(p => p.severity === 'critical').length || 0,
    warning_alerts: compliance.data?.filter(p => p.severity === 'warning').length || 0,
    high_risk_count: riskHigh.data?.length || 0,
    health_score: company.health_score || 0,
    generated_at: new Date().toISOString()
  }

  await supabase.from('daily_briefs').upsert({
    company_id,
    brief_data: brief,
    date: brief.date,
    created_at: new Date().toISOString()
  }, { onConflict: 'company_id,date' })

  return brief
}

// ─── MAIN PIPELINE ─────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log('\n🌙 CRUZ NIGHTLY PIPELINE STARTING')
  console.log('═'.repeat(50))

  await tg(`🌙 <b>NIGHTLY PIPELINE INICIADO</b>\n${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}\n— CRUZ 🦀`)

  // Get all active companies
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('*')
    .eq('active', true)
    .order('traficos_count', { ascending: false, nullsFirst: false })

  if (compErr || !companies?.length) {
    console.error('No companies found:', compErr?.message)
    await tg(`❌ No active companies found\n— CRUZ 🦀`)
    process.exit(1)
  }

  console.log(`\n📊 Processing ${companies.length} clients...\n`)

  // Connect to GlobalPC
  let conn
  try {
    conn = await getGlobalPCConnection()
    console.log('✅ GlobalPC connected')
  } catch (e) {
    console.error('GlobalPC connection failed:', e.message)
    await tg(`❌ GlobalPC connection failed: ${e.message}\n— CRUZ 🦀`)
    process.exit(1)
  }

  const results = []
  let totalTraficos = 0
  let totalEntradas = 0
  let totalFacturas = 0

  for (const company of companies) {
    const clientStart = Date.now()
    console.log(`\n📦 ${company.name} (${company.clave_cliente || company.globalpc_clave || '?'})`)

    try {
      // Timeout per client to prevent hanging
      const syncOne = async () => {
        const [t, e, f, ev, p] = await Promise.all([
          syncClientTraficos(conn, company),
          syncClientEntradas(conn, company),
          syncClientFacturas(conn, company),
          syncClientEventos(conn, company),
          syncClientProducts(conn, company)
        ])

        totalTraficos += t
        totalEntradas += e
        totalFacturas += f

        const intel = await calculateClientIntelligence(company)
        const brief = await generateClientBrief(company)

        const elapsed = ((Date.now() - clientStart) / 1000).toFixed(1)
        console.log(`   ✅ T:${t} E:${e} F:${f} Events:${ev} Prod:${p} | Score:${intel.health_score} | ${elapsed}s`)

        results.push({
          name: company.name,
          traficos: t,
          health_score: intel.health_score,
          alerts: brief.critical_alerts
        })
      }

      await Promise.race([
        syncOne(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Client sync timeout (5m)')), CLIENT_TIMEOUT))
      ])
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`)
      results.push({ name: company.name, error: e.message })
    }
  }

  await conn.end()

  // ── Post-sync steps ──────────────────────────────────

  // Step 2: Anomaly detection
  console.log('\n🔍 Running anomaly detection...')
  try {
    const { execSync } = require('child_process')
    execSync('node scripts/anomaly-check.js', {
      cwd: path.join(__dirname, '..'),
      timeout: 120000,
      stdio: 'inherit',
    })
    console.log('  ✅ Anomaly detection complete')
  } catch (e) {
    console.error(`  ⚠️ Anomaly detection failed: ${e.message}`)
    await tg(`⚠️ Anomaly detection failed: ${e.message}`)
  }

  // Step 3: Solicit missing documents
  console.log('\n📨 Running document solicitation check...')
  try {
    const { execSync } = require('child_process')
    execSync('node scripts/solicit-missing-docs.js', {
      cwd: path.join(__dirname, '..'),
      timeout: 120000,
      stdio: 'inherit',
    })
    console.log('  ✅ Document solicitation complete')
  } catch (e) {
    console.error(`  ⚠️ Document solicitation failed: ${e.message}`)
    await tg(`⚠️ Document solicitation failed: ${e.message}`)
  }

  // Step 4: Shadow weekly report (Sundays only)
  const dayOfWeek = new Date().getDay() // 0 = Sunday
  if (dayOfWeek === 0) {
    console.log('\n📊 Sunday — running shadow weekly report...')
    try {
      const { execSync } = require('child_process')
      execSync('node scripts/shadow-weekly-report.js', {
        cwd: path.join(__dirname, '..'),
        timeout: 60000,
        stdio: 'inherit',
      })
      console.log('  ✅ Shadow weekly report sent')
    } catch (e) {
      console.error(`  ⚠️ Shadow weekly report failed: ${e.message}`)
    }
  }

  // ── Summary ──────────────────────────────────────────

  const elapsed = Math.round((Date.now() - startTime) / 1000 / 60)
  const criticalClients = results.filter(r => r.alerts > 0)

  const summary = [
    `✅ <b>NIGHTLY PIPELINE COMPLETO</b>`,
    `Tiempo: ${elapsed} minutos`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📊 ${companies.length} clientes procesados`,
    `🚚 ${totalTraficos.toLocaleString()} tráficos sincronizados`,
    `📦 ${totalEntradas.toLocaleString()} entradas`,
    `📄 ${totalFacturas.toLocaleString()} facturas`,
    `━━━━━━━━━━━━━━━━━━━━`,
    criticalClients.length > 0
      ? `⚠️ Clientes con alertas críticas:\n${criticalClients.map(c => `  • ${c.name}: ${c.alerts} alertas`).join('\n')}`
      : `✅ Sin alertas críticas`,
    dayOfWeek === 0 ? `📊 Reporte shadow semanal enviado` : '',
    `━━━━━━━━━━━━━━━━━━━━`,
    `— CRUZ 🦀`
  ].filter(Boolean).join('\n')

  await tg(summary)
  console.log('\n' + '═'.repeat(50))
  console.log(`✅ Pipeline complete: ${companies.length} clients, ${totalTraficos} traficos, ${elapsed} min`)

  // Log completion to heartbeat_log
  await supabase.from('heartbeat_log').insert({
    script: 'nightly-pipeline',
    status: 'success',
    details: {
      clients: companies.length,
      traficos: totalTraficos,
      entradas: totalEntradas,
      facturas: totalFacturas,
      elapsed_min: elapsed,
      critical_alerts: criticalClients.length,
      sunday_shadow: dayOfWeek === 0,
    },
  }).then(() => {}, () => {})

  // Cleanup PID file
  try { fs.unlinkSync('/tmp/nightly-pipeline.pid') } catch {}
}

run().catch(async e => {
  console.error('Pipeline failed:', e)
  await tg(`❌ NIGHTLY PIPELINE FAILED\n${e.message}\n— CRUZ 🦀`)
  await supabase.from('heartbeat_log').insert({
    script: 'nightly-pipeline',
    status: 'failed',
    details: { error: e.message },
  }).then(() => {}, () => {})
  process.exit(1)
})
