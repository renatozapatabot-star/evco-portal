#!/usr/bin/env node
/**
 * CRUZ · Backfill supplier RFC via the SAT resolver.
 *
 * For every globalpc_proveedores row with rfc IS NULL, calls
 * lookupRfcByName() which (a) cache-checks `proveedor_rfc_cache`,
 * (b) optionally hits SAT_RFC_API_URL when env is set, and
 * (c) writes the result back. The script itself stays cron-friendly:
 * idempotent, rate-limited, logs to sync_log.
 *
 * Env:
 *   SAT_RFC_API_URL   optional — live lookup endpoint
 *   SAT_RFC_API_KEY   optional — bearer token for the endpoint
 *
 * When either is unset, the script still runs but only resolves cache
 * hits — useful as a dry-run to surface how many proveedores are
 * unresolved without actually calling SAT.
 *
 * Schedule: PM2 weekly, Sunday 03:00 CST.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

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

/** Bare-minimum inline version of src/lib/sat/rfc-lookup.ts — Node doesn't
 *  import the TS directly. Kept in sync by the ingest test suite. */
const CACHE_FRESH_DAYS = 180
function normalize(name) {
  return (name || '').trim().toUpperCase().replace(/[,.]/g, '').replace(/\s+/g, ' ')
}
async function lookupRfc(supplierName) {
  if (!supplierName?.trim()) return null
  const key = normalize(supplierName)
  const { data: cached } = await supabase
    .from('proveedor_rfc_cache')
    .select('name_normalized, display_name, rfc, source, last_lookup_at')
    .eq('name_normalized', key)
    .maybeSingle()
  if (cached?.rfc) return cached.rfc
  if (cached && !cached.rfc) {
    const age = Date.now() - new Date(cached.last_lookup_at).getTime()
    if (age < CACHE_FRESH_DAYS * 86_400_000) return null
  }

  let rfc = null
  if (process.env.SAT_RFC_API_URL && process.env.SAT_RFC_API_KEY) {
    try {
      const res = await fetch(process.env.SAT_RFC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SAT_RFC_API_KEY}`,
        },
        body: JSON.stringify({ name: supplierName }),
      })
      if (res.ok) {
        const body = await res.json()
        if (typeof body?.rfc === 'string' && body.rfc.trim()) rfc = body.rfc.trim()
      }
    } catch {}
  }

  await supabase.from('proveedor_rfc_cache').upsert({
    name_normalized: key,
    display_name: supplierName.trim(),
    rfc,
    source: rfc ? 'sat_consulta' : 'unknown',
    last_lookup_at: new Date().toISOString(),
  }, { onConflict: 'name_normalized' })
  return rfc
}

async function main() {
  const started = Date.now()
  console.log('[backfill-rfc] start')

  // Open sync_log.
  const { data: logRow } = await supabase
    .from('sync_log')
    .insert({
      sync_type: 'backfill_proveedor_rfc',
      started_at: new Date().toISOString(),
      status: 'running',
    })
    .select('id')
    .single()

  let resolved = 0
  let skipped = 0
  let errors = 0

  try {
    // Fetch proveedores without RFC, chunked.
    const { data: proveedores, error } = await supabase
      .from('globalpc_proveedores')
      .select('cve_proveedor, nombre, rfc')
      .is('rfc', null)
      .not('nombre', 'is', null)
      .limit(5000)
    if (error) throw new Error(`proveedores fetch: ${error.message}`)

    const rows = proveedores || []
    console.log(`[backfill-rfc] ${rows.length} proveedores sin RFC`)

    for (let i = 0; i < rows.length; i++) {
      const p = rows[i]
      try {
        const rfc = await lookupRfc(p.nombre)
        if (rfc) {
          // Write back to globalpc_proveedores.
          await supabase
            .from('globalpc_proveedores')
            .update({ rfc })
            .eq('cve_proveedor', p.cve_proveedor)
          resolved++
        } else {
          skipped++
        }
      } catch (e) {
        errors++
        console.error(`[backfill-rfc] error on ${p.cve_proveedor}:`, e.message)
      }
      // Rate-limit: 2 req/sec to be polite to SAT.
      if (i % 2 === 1) await new Promise((r) => setTimeout(r, 1000))
    }

    if (logRow?.id) {
      await supabase
        .from('sync_log')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          rows_synced: resolved,
        })
        .eq('id', logRow.id)
    }

    const elapsedMin = ((Date.now() - started) / 60000).toFixed(1)
    console.log(`[backfill-rfc] done · resolved=${resolved} skipped=${skipped} errors=${errors} · ${elapsedMin}m`)
    if (resolved > 0 || errors > 0) {
      await notify(
        `🧾 *Backfill RFC*\n` +
        `Resueltos: ${resolved}\n` +
        `Pendientes: ${skipped}\n` +
        `Errores: ${errors}\n` +
        `Duración: ${elapsedMin}m`,
      )
    }
    process.exit(0)
  } catch (e) {
    console.error('[backfill-rfc] FATAL:', e.message)
    if (logRow?.id) {
      await supabase
        .from('sync_log')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: e.message,
        })
        .eq('id', logRow.id)
    }
    await notify(`🔴 *Backfill RFC falló*\n${e.message}`)
    process.exit(1)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
