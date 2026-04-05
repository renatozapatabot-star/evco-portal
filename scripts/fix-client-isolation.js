#!/usr/bin/env node
/**
 * CRUZ — Fix Client Isolation
 *
 * Re-maps traficos that are incorrectly assigned to company_id='evco'
 * when they actually belong to other companies (based on sCveCliente in GlobalPC).
 *
 * Creates company records for new clients if they don't exist.
 * Then backfills: fecha_cruce, regimen, aduana, pais_procedencia from GlobalPC.
 *
 * Usage:
 *   node scripts/fix-client-isolation.js --dry-run     # Preview
 *   node scripts/fix-client-isolation.js               # Execute
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const mysql = require('mysql2/promise')
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'fix-client-isolation'
const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sendTelegram(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

// Map sCveCliente to a slug-based company_id
function claveToCompanyId(clave, name) {
  // Known mappings
  const known = {
    '9254': 'evco',
    '4598': 'mafesa',
  }
  if (known[clave]) return known[clave]

  // Generate slug from company name or clave
  if (name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30)
  }
  return `client-${clave}`
}

async function run() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  console.log(`\n🔒 ${prefix}CRUZ — Fix Client Isolation`)
  console.log('═'.repeat(60))

  // Connect to GlobalPC
  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST,
    port: Number(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38',
    connectTimeout: 15000,
  })
  console.log('   MySQL connected')

  // Get all traficos with their real client from GlobalPC
  const [gpcRows] = await conn.execute(
    'SELECT t.sCveTrafico, t.sCveCliente, t.dFechaCruce, t.eCveRegimen, t.sCveAduana, t.sCvePaisDestino, ' +
    'c.sRazonSocial FROM cb_trafico t LEFT JOIN cu_cliente c ON t.sCveCliente = c.sCveCliente'
  )
  console.log(`   GlobalPC traficos: ${gpcRows.length}`)

  // Build lookup: trafico_id → { real_clave, real_company_id, name, backfill fields }
  const gpcMap = new Map()
  const clientNames = new Map()
  for (const r of gpcRows) {
    const companyId = claveToCompanyId(r.sCveCliente, r.sRazonSocial)
    gpcMap.set(r.sCveTrafico, {
      clave: r.sCveCliente,
      company_id: companyId,
      fecha_cruce: r.dFechaCruce || null,
      regimen: r.eCveRegimen || null,
      aduana: r.sCveAduana || null,
      pais_procedencia: r.sCvePaisDestino || null,
    })
    if (!clientNames.has(r.sCveCliente)) {
      clientNames.set(r.sCveCliente, { name: r.sRazonSocial, company_id: companyId })
    }
  }

  await conn.end()

  // Get ALL Supabase traficos
  let allTraficos = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('traficos')
      .select('id, trafico, company_id, fecha_cruce, regimen, aduana, pais_procedencia')
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    allTraficos = allTraficos.concat(data)
    offset += data.length
    if (data.length < 1000) break
  }
  console.log(`   Supabase traficos: ${allTraficos.length}`)

  // Find mis-mapped traficos and collect backfill data
  let remapped = 0
  let backfilled = 0
  const newCompanies = new Map()
  const byClient = {}

  for (const t of allTraficos) {
    const gpc = gpcMap.get(t.trafico)
    if (!gpc) continue // Not in GlobalPC

    const update = {}
    let needsUpdate = false

    // Check if company_id is wrong
    if (t.company_id !== gpc.company_id) {
      update.company_id = gpc.company_id
      needsUpdate = true
      remapped++

      // Track new companies we need to create
      if (!newCompanies.has(gpc.clave)) {
        const info = clientNames.get(gpc.clave)
        newCompanies.set(gpc.clave, info)
      }

      byClient[gpc.company_id] = (byClient[gpc.company_id] || 0) + 1
    }

    // Backfill missing fields
    if (!t.fecha_cruce && gpc.fecha_cruce) { update.fecha_cruce = gpc.fecha_cruce; update.estatus = 'Cruzado'; needsUpdate = true; backfilled++ }
    if (!t.regimen && gpc.regimen) { update.regimen = gpc.regimen; needsUpdate = true; backfilled++ }
    if (!t.aduana && gpc.aduana) { update.aduana = gpc.aduana; needsUpdate = true; backfilled++ }
    if (!t.pais_procedencia && gpc.pais_procedencia) { update.pais_procedencia = gpc.pais_procedencia; needsUpdate = true; backfilled++ }

    if (needsUpdate) {
      update.updated_at = new Date().toISOString()
      if (!DRY_RUN) {
        await supabase.from('traficos').update(update).eq('id', t.id)
      }
    }
  }

  // Create company records for new companies
  console.log(`\n── New companies to create: ${newCompanies.size}`)
  for (const [clave, info] of newCompanies) {
    console.log(`   ${clave}: ${info.name} → company_id: ${info.company_id}`)
    if (!DRY_RUN) {
      await supabase.from('companies').upsert({
        company_id: info.company_id,
        name: info.name,
        clave_cliente: clave,
        active: false, // Not onboarded yet
        patente: '3596',
        aduana: '240',
      }, { onConflict: 'company_id' }).then(() => {}, () => {})
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60))
  console.log(`📊 ${prefix}RESULTS`)
  console.log(`   Traficos re-mapped: ${remapped}`)
  console.log(`   Fields backfilled: ${backfilled}`)
  console.log(`   New companies: ${newCompanies.size}`)
  if (Object.keys(byClient).length > 0) {
    console.log('\n   Re-mapped by company:')
    Object.entries(byClient).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`     ${c}: ${n}`))
  }

  if (remapped > 0 || backfilled > 0) {
    await sendTelegram(
      `🔒 <b>FIX CLIENT ISOLATION</b>\n` +
      `${remapped} traficos re-mapped to correct company\n` +
      `${backfilled} fields backfilled\n` +
      `${newCompanies.size} new company records\n` +
      `— CRUZ 🦀`
    )
  }

  await supabase.from('pipeline_log').insert({
    step: `${SCRIPT_NAME}:complete`,
    status: remapped > 0 ? 'success' : 'noop',
    input_summary: JSON.stringify({ remapped, backfilled, new_companies: newCompanies.size, by_client: byClient }),
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
