#!/usr/bin/env node
// scripts/sync-entradas-linkage.js
// ============================================================================
// CRUZ Entradas Linkage — links entradas to traficos
//
// Pass 1: Supabase referencia_cliente match (fast, ~2K matches)
// Pass 2: MySQL sNumPedido join fallback (handles comma-separated POs, ~6K+)
// Idempotent — safe to run multiple times.
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

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

async function run() {
  const t0 = Date.now()
  console.log('\n🔗 CRUZ Entradas Linkage')
  console.log(`   ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}`)
  console.log('   Patente 3596 · Aduana 240\n')

  // 1. Fetch ALL traficos that have referencia_cliente (paginated)
  const allTraficos = []
  let tPage = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('traficos')
      .select('trafico, referencia_cliente')
      .ilike('trafico', '9254-%')
      .not('referencia_cliente', 'is', null)
      .range(tPage * PAGE, (tPage + 1) * PAGE - 1)
    if (error) {
      console.error('❌ Failed to fetch traficos:', error.message)
      await sendTG(`🔴 <b>Entradas Linkage</b> · Failed: ${error.message}`)
      process.exit(1)
    }
    allTraficos.push(...data)
    if (data.length < PAGE) break
    tPage++
  }

  console.log(`   ${allTraficos.length} tráficos con referencia_cliente`)

  // Build lookup: cve_entrada → trafico number
  const linkMap = new Map()
  for (const t of allTraficos) {
    const ref = String(t.referencia_cliente).trim()
    if (ref) linkMap.set(ref, t.trafico)
  }

  // 2. Fetch ALL unlinked entradas (paginated)
  const allEntradas = []
  let ePage = 0
  while (true) {
    const { data, error } = await supabase
      .from('entradas')
      .select('id, cve_entrada')
      .eq('company_id', 'evco')
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

  console.log(`   ${allEntradas.length} entradas sin tráfico`)
  const entradas = allEntradas

  // 3. Match
  const toLink = []
  for (const e of entradas) {
    const trafico = linkMap.get(String(e.cve_entrada))
    if (trafico) {
      toLink.push({ id: e.id, cve_entrada: e.cve_entrada, trafico })
    }
  }

  console.log(`   ${toLink.length} matches found\n`)

  // 4. Update in batches
  let updated = 0
  let errors = 0
  const BATCH = 100

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
        updated++
      } else {
        errors++
        const msg = r.status === 'rejected' ? r.reason?.message : r.value?.error?.message
        if (errors <= 5) console.error(`   ❌ ${batch[j].cve_entrada}: ${msg}`)
      }
    }

    if ((i + BATCH) % 500 === 0 || i + BATCH >= toLink.length) {
      console.log(`   Progress: ${Math.min(i + BATCH, toLink.length)}/${toLink.length} (${updated} linked, ${errors} errors)`)
    }
  }

  console.log(`\n   Pass 1 done: ${updated} linked via referencia_cliente\n`)

  // ── Pass 2: MySQL sNumPedido fallback ─────────────────────────────────
  console.log('   Pass 2: MySQL sNumPedido join...')

  let pass2Updated = 0
  let pass2Errors = 0

  try {
    const mysqlConn = await mysql.createConnection({
      host: '216.251.68.5', port: 33033,
      user: 'demo_38',
      password: process.env.GLOBALPC_MYSQL_PASSWORD,
      database: 'bd_demo_38',
      connectTimeout: 10000,
    })

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
      WHERE e.sCveCliente = '9254'
        AND t.sCveCliente = '9254'
        AND e.sNumPedido IS NOT NULL
        AND e.sNumPedido != ''
    `)
    await mysqlConn.end()

    console.log(`   ${mysqlMatches.length} MySQL PO matches found`)

    // Build lookup: cve_entrada → trafico (from MySQL)
    const mysqlMap = new Map()
    for (const m of mysqlMatches) {
      const key = String(m.cve_entrada)
      if (!mysqlMap.has(key)) mysqlMap.set(key, m.trafico_id)
    }

    // Re-fetch still-unlinked entradas
    const stillUnlinked = []
    let p2Page = 0
    while (true) {
      const { data, error } = await supabase
        .from('entradas')
        .select('id, cve_entrada')
        .eq('company_id', 'evco')
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
    console.error('   ⚠️  Pass 2 (MySQL) failed:', err.message)
    console.error('   Continuing with Pass 1 results only')
  }

  const totalUpdated = updated + pass2Updated
  const totalErrors = errors + pass2Errors
  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n══ Done · ${sec}s · Pass 1: ${updated} · Pass 2: ${pass2Updated} · Total: ${totalUpdated} · Errors: ${totalErrors} ══\n`)

  // Log to heartbeat
  await supabase.from('heartbeat_log').insert({
    script: 'sync-entradas-linkage',
    status: totalErrors > 0 ? 'partial' : 'success',
    details: { pass1: updated, pass2: pass2Updated, total: totalUpdated, errors: totalErrors, elapsed_s: parseFloat(sec) },
  }).then(() => {}, () => {})

  if (totalErrors > 0) {
    await sendTG(`🟡 <b>Entradas Linkage</b> · ${totalUpdated} vinculadas (P1:${updated} P2:${pass2Updated}) · ${totalErrors} error(es) · ${sec}s`)
  } else {
    await sendTG(`✅ <b>Entradas Linkage</b> · ${totalUpdated} vinculadas (P1:${updated} P2:${pass2Updated}) · ${sec}s`)
  }
}

run().catch(async err => {
  console.error('❌ Fatal:', err.message)
  await sendTG(`🔴 <b>Entradas Linkage FAILED</b>\n${err.message}`)
  process.exit(1)
})
