#!/usr/bin/env node
// scripts/sync-entradas-linkage.js
// ============================================================================
// CRUZ Entradas Linkage — links entradas to traficos via MySQL 3-way join
//
// Pass 1: MySQL cb_trafico.sReferenciaCliente → split on '-' → cb_entrada_bodega
//         → match Supabase entradas.cve_entrada (primary, most accurate)
// Pass 2: MySQL sNumPedido join fallback (handles comma-separated POs)
// Idempotent — safe to run multiple times.
// Multi-client: use --client=mafesa or --clave=4598 to target a specific client.
// Default: runs for all active clients in the companies table.
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')
const { withSyncLog } = require('./lib/sync-log')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'public' }, global: { headers: { 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY } } }
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function sendTG(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

function getMySQLConfig() {
  return {
    host: process.env.GLOBALPC_DB_HOST,
    port: Number(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38',
    connectTimeout: 15000,
  }
}

const PAGE = 1000
const BATCH = 100

// Parse --client=<company_id> or --clave=<clave> from CLI args
function parseClientArg() {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--client=')) return { field: 'company_id', value: arg.split('=')[1] }
    if (arg.startsWith('--clave=')) return { field: 'clave', value: arg.split('=')[1] }
  }
  return null
}

async function getClients() {
  const clientArg = parseClientArg()
  const { data: companies } = await supabase
    .from('companies').select('company_id, clave_cliente').eq('active', true)

  if (!companies?.length) {
    console.error('No active companies found')
    process.exit(1)
  }

  if (clientArg) {
    const match = companies.find(c =>
      clientArg.field === 'company_id' ? c.company_id === clientArg.value : c.clave_cliente === clientArg.value
    )
    if (!match) {
      console.error(`Client not found: ${clientArg.value}`)
      process.exit(1)
    }
    return [match]
  }
  return companies
}

async function linkClient(client) {
  const t0 = Date.now()
  const clave = client.clave_cliente
  const companyId = client.company_id
  console.log(`\n── ${companyId.toUpperCase()} (clave: ${clave}) ──`)

  // ── Pass 1: MySQL 3-way join via sReferenciaCliente ─────────────────────
  console.log('   Pass 1: MySQL sReferenciaCliente → entradas...')

  let pass1Updated = 0
  let pass1Errors = 0

  let mysqlConn
  try {
    mysqlConn = await mysql.createConnection(getMySQLConfig())

    const [traficos] = await mysqlConn.execute(`
      SELECT sCveTrafico, sReferenciaCliente
      FROM cb_trafico
      WHERE sCveCliente = ?
        AND sReferenciaCliente IS NOT NULL
        AND sReferenciaCliente != ''
    `, [clave])

    console.log(`   ${traficos.length} MySQL tráficos con sReferenciaCliente`)

    // Step 2: Split sReferenciaCliente on '-' to get individual entrada IDs
    // e.g. "910586-910562" → ["910586", "910562"]
    // Build map: entrada_id → sCveTrafico
    const refToTrafico = new Map()
    for (const t of traficos) {
      const refs = String(t.sReferenciaCliente).trim().split('-')
      for (const ref of refs) {
        const trimmed = ref.trim()
        if (trimmed) refToTrafico.set(trimmed, t.sCveTrafico)
      }
    }

    console.log(`   ${refToTrafico.size} unique entrada IDs extracted from references`)

    // Step 3: Query cb_entrada_bodega for those IDs to get sCveEntradaBodega
    // We query all EVCO entradas and match in JS to avoid huge IN clause
    const [mysqlEntradas] = await mysqlConn.execute(`
      SELECT sCveEntradaBodega
      FROM cb_entrada_bodega
      WHERE sCveCliente = ?
    `, [clave])

    console.log(`   ${mysqlEntradas.length} MySQL entradas found`)

    // Build set of valid sCveEntradaBodega values
    const validEntradaIds = new Set(
      mysqlEntradas.map(e => String(e.sCveEntradaBodega).trim())
    )

    // Step 4: Build final linkage map: cve_entrada → trafico
    // Only include entries where the entrada ID exists in cb_entrada_bodega
    const linkMap = new Map()
    for (const [entradaId, trafico] of refToTrafico) {
      if (validEntradaIds.has(entradaId)) {
        linkMap.set(entradaId, trafico)
      }
    }

    console.log(`   ${linkMap.size} validated entrada→tráfico links`)

    // Step 5: Fetch unlinked entradas from Supabase and match (filtered by client)
    const allEntradas = []
    let ePage = 0
    while (true) {
      const { data, error } = await supabase
        .from('entradas')
        .select('id, cve_entrada')
        .eq('company_id', companyId)
        .is('trafico', null)
        .range(ePage * PAGE, (ePage + 1) * PAGE - 1)
      if (error) {
        console.error('❌ Failed to fetch entradas:', error.message)
        await sendTG(`🔴 <b>Entradas Linkage</b> · Failed: ${error.message}`)
        process.exit(1)
      }
      allEntradas.push(...data)
      if (data.length < PAGE) break
      ePage++
    }

    console.log(`   ${allEntradas.length} Supabase entradas sin tráfico`)

    // Match: Supabase entradas.cve_entrada against validated linkMap
    const toLink = []
    for (const e of allEntradas) {
      const trafico = linkMap.get(String(e.cve_entrada))
      if (trafico) {
        toLink.push({ id: e.id, cve_entrada: e.cve_entrada, trafico })
      }
    }

    console.log(`   ${toLink.length} matches found\n`)

    // Update in batches
    for (let i = 0; i < toLink.length; i += BATCH) {
      const batch = toLink.slice(i, i + BATCH)
      const results = await Promise.allSettled(
        batch.map(({ id, trafico }) =>
          supabase.from('entradas').update({ trafico }).eq('id', id)
        )
      )
      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        if (r.status === 'fulfilled' && !r.value.error) {
          pass1Updated++
        } else {
          pass1Errors++
          const msg = r.status === 'rejected' ? r.reason?.message : r.value?.error?.message
          if (pass1Errors <= 5) console.error(`   ❌ ${batch[j].cve_entrada}: ${msg}`)
        }
      }
      if ((i + BATCH) % 500 === 0 || i + BATCH >= toLink.length) {
        console.log(`   Progress: ${Math.min(i + BATCH, toLink.length)}/${toLink.length} (${pass1Updated} linked, ${pass1Errors} errors)`)
      }
    }

    console.log(`\n   Pass 1 done: ${pass1Updated} linked via sReferenciaCliente\n`)
  } catch (err) {
    console.error('   ⚠️  Pass 1 (MySQL sReferenciaCliente) failed:', err.message)
    console.error('   Continuing to Pass 2...')
  }

  // ── Pass 2: MySQL sNumPedido fallback ─────────────────────────────────
  console.log('   Pass 2: MySQL sNumPedido join...')

  let pass2Updated = 0
  let pass2Errors = 0

  try {
    // Reuse connection if still open, otherwise reconnect
    if (!mysqlConn || mysqlConn.connection._closing) {
      mysqlConn = await mysql.createConnection(getMySQLConfig())
    }

    // Get MySQL matches: entradas → traficos via PO number
    // Handles comma-separated POs in cb_trafico.sNumPedido
    const [mysqlMatches] = await mysqlConn.execute(`
      SELECT
        e.sCveEntradaBodega as cve_entrada,
        e.sNumPedido as po_number,
        t.sCveTrafico as trafico_id
      FROM cb_entrada_bodega e
      INNER JOIN cb_trafico t
        ON (
          e.sNumPedido = t.sNumPedido
          OR FIND_IN_SET(e.sNumPedido, REPLACE(t.sNumPedido, ' ', '')) > 0
        )
      WHERE e.sCveCliente = ?
        AND t.sCveCliente = ?
        AND e.sNumPedido IS NOT NULL
        AND e.sNumPedido != ''
    `, [clave, clave])
    await mysqlConn.end()

    console.log(`   ${mysqlMatches.length} MySQL PO matches found`)

    // Build lookup: cve_entrada → trafico (from MySQL)
    const mysqlMap = new Map()
    for (const m of mysqlMatches) {
      const key = String(m.cve_entrada)
      if (!mysqlMap.has(key)) mysqlMap.set(key, m.trafico_id)
    }

    // Re-fetch still-unlinked entradas (filtered by client)
    const stillUnlinked = []
    let p2Page = 0
    while (true) {
      const { data, error } = await supabase
        .from('entradas')
        .select('id, cve_entrada')
        .eq('company_id', companyId)
        .is('trafico', null)
        .range(p2Page * PAGE, (p2Page + 1) * PAGE - 1)
      if (error) break
      stillUnlinked.push(...data)
      if (data.length < PAGE) break
      p2Page++
    }

    console.log(`   ${stillUnlinked.length} entradas still unlinked`)

    // Match via MySQL PO lookup
    const pass2Links = []
    for (const e of stillUnlinked) {
      const trafico = mysqlMap.get(String(e.cve_entrada))
      if (trafico) pass2Links.push({ id: e.id, trafico })
    }

    console.log(`   ${pass2Links.length} new matches from PO join\n`)

    // Update in batches
    for (let i = 0; i < pass2Links.length; i += BATCH) {
      const batch = pass2Links.slice(i, i + BATCH)
      const results = await Promise.allSettled(
        batch.map(({ id, trafico }) =>
          supabase.from('entradas').update({ trafico }).eq('id', id)
        )
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && !r.value.error) pass2Updated++
        else pass2Errors++
      }
      if ((i + BATCH) % 500 === 0 || i + BATCH >= pass2Links.length) {
        console.log(`   Pass 2 progress: ${Math.min(i + BATCH, pass2Links.length)}/${pass2Links.length} (${pass2Updated} linked)`)
      }
    }
  } catch (err) {
    console.error('   ⚠️  Pass 2 (MySQL PO) failed:', err.message)
    console.error('   Continuing with Pass 1 results only')
  }

  const totalUpdated = pass1Updated + pass2Updated
  const totalErrors = pass1Errors + pass2Errors
  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n── ${companyId}: ${sec}s · P1:${pass1Updated} · P2:${pass2Updated} · Total:${totalUpdated} · Errors:${totalErrors} ──\n`)

  return { companyId, pass1Updated, pass2Updated, totalUpdated, totalErrors, sec }
}

async function run() {
  const t0 = Date.now()
  console.log('\n🔗 CRUZ Entradas Linkage (multi-client)')
  console.log(`   ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}`)
  console.log('   Patente 3596 · Aduana 240\n')

  const clients = await getClients()
  console.log(`   Clients: ${clients.map(c => c.company_id).join(', ')}`)

  let grandTotal = 0
  let grandErrors = 0

  for (const client of clients) {
    const result = await linkClient(client)
    grandTotal += result.totalUpdated
    grandErrors += result.totalErrors
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1)

  // Log to heartbeat
  await supabase.from('heartbeat_log').insert({
    script: 'sync-entradas-linkage',
    status: grandErrors > 0 ? 'partial' : 'success',
    details: { total: grandTotal, errors: grandErrors, clients: clients.length, elapsed_s: parseFloat(sec) },
  }).then(() => {}, () => {})

  if (grandErrors > 0) {
    await sendTG(`🟡 <b>Entradas Linkage</b> · ${grandTotal} vinculadas · ${grandErrors} error(es) · ${clients.length} clientes · ${sec}s`)
  } else {
    await sendTG(`✅ <b>Entradas Linkage</b> · ${grandTotal} vinculadas · ${clients.length} clientes · ${sec}s`)
  }
}

withSyncLog(supabase, { sync_type: 'entradas_linkage', company_id: null }, run).catch(async err => {
  console.error('❌ Fatal:', err.message)
  await sendTG(`🔴 <b>Entradas Linkage FAILED</b>\n${err.message}`)
  process.exit(1)
})
