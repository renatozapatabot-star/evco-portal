#!/usr/bin/env node
/**
 * CRUZ · Backfill entradas.transportista_* from trafico fallback.
 *
 * For every entrada whose transportista_americano is null, but whose
 * linked trafico has a non-null transportista_extranjero, copy the
 * value over. Same for mexicano. Idempotent: re-running produces no
 * additional writes.
 *
 * Writes sync_log + fires Telegram on completion.
 *
 * Schedule: PM2 weekly, Sunday 03:30 CST.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const { withSyncLog } = require('./lib/sync-log')

const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

async function notify(text) {
  if (!TG || process.env.TELEGRAM_SILENT === 'true') return
  try {
    await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'Markdown' }),
    })
  } catch {}
}

async function run() {
  const started = Date.now()
  console.log('[backfill-transporte] start')

  const { data: logRow } = await supabase
    .from('sync_log')
    .insert({ sync_type: 'backfill_transporte', started_at: new Date().toISOString(), status: 'running' })
    .select('id').single()

  let writes = 0
  let scanned = 0

  try {
    // 1. Fetch traficos with non-null carrier info (the source pool).
    const { data: traficos, error: tErr } = await supabase
      .from('traficos')
      .select('trafico, transportista_extranjero, transportista_mexicano')
      .or('transportista_extranjero.not.is.null,transportista_mexicano.not.is.null')
      .limit(20000)
    if (tErr) throw new Error(`traficos fetch: ${tErr.message}`)
    const carrierByTrafico = new Map()
    for (const t of traficos || []) {
      carrierByTrafico.set(t.trafico, {
        americano: t.transportista_extranjero,
        mexicano: t.transportista_mexicano,
      })
    }
    console.log(`[backfill-transporte] ${carrierByTrafico.size} traficos with carrier data`)

    // 2. Fetch entradas with NULL americano (main gap reported by user).
    const { data: entradas, error: eErr } = await supabase
      .from('entradas')
      .select('cve_entrada, trafico, transportista_americano, transportista_mexicano')
      .is('transportista_americano', null)
      .not('trafico', 'is', null)
      .limit(20000)
    if (eErr) throw new Error(`entradas fetch: ${eErr.message}`)
    scanned = (entradas || []).length
    console.log(`[backfill-transporte] ${scanned} entradas with null americano`)

    // 3. For each, check if we have a carrier on the trafico. Batch updates.
    const updates = []
    for (const e of (entradas || [])) {
      const src = carrierByTrafico.get(e.trafico)
      if (!src) continue
      const update = {}
      if (!e.transportista_americano && src.americano) update.transportista_americano = src.americano
      if (!e.transportista_mexicano && src.mexicano) update.transportista_mexicano = src.mexicano
      if (Object.keys(update).length > 0) {
        updates.push({ cve_entrada: e.cve_entrada, ...update })
      }
    }

    // 4. Apply updates.
    for (const u of updates) {
      const { cve_entrada, ...patch } = u
      const { error } = await supabase.from('entradas').update(patch).eq('cve_entrada', cve_entrada)
      if (!error) writes++
    }

    if (logRow?.id) {
      await supabase.from('sync_log').update({
        status: 'success',
        completed_at: new Date().toISOString(),
        rows_synced: writes,
      }).eq('id', logRow.id)
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(1)
    console.log(`[backfill-transporte] done · scanned=${scanned} writes=${writes} · ${elapsed}s`)
    if (writes > 0) {
      await notify(`🚚 *Backfill transporte US*\nEntradas actualizadas: ${writes}\nEscaneadas: ${scanned}\nDuración: ${elapsed}s`)
    }
    process.exit(0)
  } catch (e) {
    console.error('[backfill-transporte] FATAL:', e.message)
    if (logRow?.id) {
      await supabase.from('sync_log').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: e.message,
      }).eq('id', logRow.id)
    }
    await notify(`🔴 *Backfill transporte falló*\n${e.message}`)
    process.exit(1)
  }
}

withSyncLog(supabase, { sync_type: 'backfill_transporte', company_id: null }, run).catch((e) => { console.error(e); process.exit(1) })
