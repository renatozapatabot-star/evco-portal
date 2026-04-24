#!/usr/bin/env node
/**
 * CRUZ GlobalPC Delta Sync
 * Runs every 15 minutes during business hours
 * Only pulls records changed since last sync
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')
const { withSyncLog } = require('./lib/sync-log')
const { safeUpsert } = require('./lib/safe-write')
const { runPostSyncVerification } = require('./lib/post-sync-verify')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)


const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function getLastSyncTime() {
  const { data } = await supabase
    .from('scrape_runs')
    .select('completed_at')
    .eq('source', 'globalpc_delta')
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1)

  if (!data?.[0]?.completed_at) {
    return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  }
  return new Date(data[0].completed_at)
}

async function run() {
  const startedAt = new Date().toISOString()
  const lastSync = await getLastSyncTime()
  const lastSyncStr = lastSync.toISOString().replace('T', ' ').substring(0, 19)

  console.log(`\n⚡ GLOBALPC DELTA SYNC — Changes since ${lastSyncStr}`)

  let conn
  try {
    conn = await mysql.createConnection({
      host: process.env.GLOBALPC_DB_HOST,
      port: parseInt(process.env.GLOBALPC_DB_PORT),
      user: process.env.GLOBALPC_DB_USER,
      password: process.env.GLOBALPC_DB_PASS,
      database: 'bd_demo_38',
      connectTimeout: 10000
    })
  } catch (e) {
    console.error('GlobalPC connection failed:', e.message)
    await supabase.from('scrape_runs').insert({
      source: 'globalpc_delta', started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: 'error', error_message: e.message
    })
    await tg(`🔴 <b>Delta sync FAILED</b>\nGlobalPC connection: ${e.message}\n— CRUZ 🦀`)
    return
  }

  // FIX 2026-04-16: traficos has NOT NULL tenant_id (broker-level UUID,
  // Patente 3596). Source it from an existing row rather than hardcoding.
  const { data: tenantSample } = await supabase.from('traficos').select('tenant_id').not('tenant_id','is',null).limit(1).maybeSingle()
  const BROKER_TENANT_ID = tenantSample?.tenant_id
  if (!BROKER_TENANT_ID) {
    await tg(`🔴 <b>Delta sync ABORTED</b>\nCannot determine broker tenant_id from traficos.\n— ZAPATA AI 🦅`)
    await conn.end()
    return
  }

  const { data: companies, error: companiesErr } = await supabase
    .from('companies').select('company_id, clave_cliente').eq('active', true)
  if (companiesErr || !companies || companies.length === 0) {
    const reason = companiesErr?.message || 'companies query returned empty'
    console.error('Sync aborted — cannot load claveMap:', reason)
    await supabase.from('scrape_runs').insert({
      source: 'globalpc_delta', started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: 'error', error_message: `claveMap unavailable: ${reason}`
    }).throwOnError().then(() => {}, () => {})
    await tg(`🔴 <b>Delta sync ABORTED</b>\nclaveMap unavailable: ${reason}\nRefusing to skip tenants silently.\n— CRUZ 🦀`)
    await conn.end()
    return
  }
  const claveMap = {}
  companies.forEach(c => { if (c.clave_cliente) claveMap[c.clave_cliente] = c.company_id })

  let totalFound = 0, totalNew = 0, totalUpdated = 0, statusChanges = 0
  // Build 12 — accumulators for post-sync read-back verification.
  const writtenTraficos = []
  const writtenEntradas = []
  const validCompanyIds = new Set(Object.values(claveMap))

  try {
    // Delta tráficos
    const [trafRows] = await conn.execute(`
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
      WHERE t.dFechaActualizacion >= ?
      ORDER BY t.dFechaActualizacion DESC
      LIMIT 5000
    `, [lastSyncStr])

    const skippedClaves = new Set()
    if (trafRows.length > 0) {
      // Get existing for comparison
      const ids = trafRows.map(r => r.trafico)
      const { data: existing } = await supabase
        .from('traficos')
        .select('trafico, estatus')
        .in('trafico', ids)
      const existMap = {}
      ;(existing || []).forEach(t => { existMap[t.trafico] = t })

      const changes = []
      for (let i = 0; i < trafRows.length; i += 100) {
        const batch = trafRows.slice(i, i + 100).filter(r => {
          if (!claveMap[r.clave_cliente]) {
            skippedClaves.add(r.clave_cliente)
            return false
          }
          return true
        }).map(r => {
          const prev = existMap[r.trafico]
          if (prev && prev.estatus !== r.estatus) {
            changes.push({ trafico: r.trafico, from: prev.estatus, to: r.estatus })
          }
          if (!prev) totalNew++; else totalUpdated++
          // FIX 2026-04-16: traficos has no `clave_cliente` column — canonical FK is
          // `company_id` (invariant #14). Including clave_cliente made PGRST204 fail
          // every upsert silently; the script has been reporting success since the
          // schema drift while zero rows were written. Discovered during overnight
          // Phase 1 sync audit.
          const company_id = claveMap[r.clave_cliente]
          return {
            trafico: r.trafico,
            company_id,
            tenant_id: BROKER_TENANT_ID,
            tenant_slug: company_id,
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
          }
        })
        // safeUpsert: throws on error (same as before) + catches the
        // zero-write-drift pattern that caused the 2026-04-16 incident
        // (33h of "654 updated" while writing zero rows). Telegram-alerts
        // both cases.
        await safeUpsert(supabase, 'traficos', batch, {
          onConflict: 'trafico',
          ignoreDuplicates: false,
          scriptName: 'globalpc-delta-sync',
        })
        for (const row of batch) writtenTraficos.push(row.trafico)
      }

      totalFound = trafRows.length
      statusChanges = changes.length

      // Status change alerts handled by status-flow-engine.js (no per-change spam here)
      if (changes.length > 0) {
        console.log(`  Status changes: ${changes.length} (${changes.slice(0, 3).map(c => `${c.trafico}: ${c.from}→${c.to}`).join(', ')}${changes.length > 3 ? '...' : ''})`)
      }
    }

    // Delta entradas
    const [entRows] = await conn.execute(`
      SELECT
        e.sCveEntradaBodega as cve_entrada,
        e.sCveCliente as cve_cliente,
        e.dFechaLlegadaMercancia as fecha_llegada_mercancia,
        e.iCantidadBultosRecibidos as cantidad_bultos,
        e.iPesoBruto as peso_bruto,
        e.bFaltantes as tiene_faltantes,
        e.bMercanciaDanada as mercancia_danada,
        e.sDescripcionMercancia as descripcion_mercancia,
        e.sRecibidoPor as recibido_por,
        e.sCveProveedor as cve_proveedor,
        e.sNumTalon as num_talon,
        e.sNumCajaTrailer as num_caja_trailer
      FROM cb_entrada_bodega e
      WHERE e.dFechaActualizacion >= ?
      ORDER BY e.dFechaActualizacion DESC
      LIMIT 2000
    `, [lastSyncStr])

    if (entRows.length > 0) {
      for (let i = 0; i < entRows.length; i += 200) {
        const batch = entRows.slice(i, i + 200).filter(r => {
          if (!claveMap[r.cve_cliente]) {
            skippedClaves.add(r.cve_cliente)
            return false
          }
          return true
        }).map(r => ({
          cve_entrada: r.cve_entrada,
          cve_cliente: r.cve_cliente,
          company_id: claveMap[r.cve_cliente],
          tenant_id: BROKER_TENANT_ID,
          tenant_slug: claveMap[r.cve_cliente],
          fecha_llegada_mercancia: r.fecha_llegada_mercancia,
          cantidad_bultos: r.cantidad_bultos,
          peso_bruto: r.peso_bruto,
          tiene_faltantes: r.tiene_faltantes === '1' || r.tiene_faltantes === 1,
          mercancia_danada: r.mercancia_danada === '1' || r.mercancia_danada === 1,
          descripcion_mercancia: r.descripcion_mercancia,
          recibido_por: r.recibido_por,
          cve_proveedor: r.cve_proveedor,
          num_talon: r.num_talon || null,
          num_caja_trailer: r.num_caja_trailer || null,
          updated_at: new Date().toISOString()
        }))
        await safeUpsert(supabase, 'entradas', batch, {
          onConflict: 'cve_entrada',
          ignoreDuplicates: false,
          scriptName: 'globalpc-delta-sync',
        })
        for (const row of batch) writtenEntradas.push(row.cve_entrada)
      }
      totalFound += entRows.length
    }

    console.log(`✅ Tráficos: ${trafRows.length} (${totalNew} new, ${totalUpdated} updated, ${statusChanges} status changes)`)
    console.log(`✅ Entradas: ${entRows.length}`)

    if (skippedClaves.size > 0) {
      const claveList = [...skippedClaves].join(', ')
      console.warn(`⚠️ Skipped unmapped claves: ${claveList}`)
      await tg(`⚠️ <b>Delta sync</b>\nClaves sin registrar en companies: ${claveList}\nRegistra en tabla companies para sincronizar.\n— CRUZ 🦀`)
    }

    if (totalNew > 50) {
      await tg(`⚡ <b>Delta sync</b>\n${totalNew} nuevos · ${totalUpdated} actualizados · ${statusChanges} cambios estado\n— CRUZ 🦀`)
    }
  } catch (e) {
    console.error('Sync error:', e.message)
    await supabase.from('scrape_runs').insert({
      source: 'globalpc_delta', started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: 'error', error_message: e.message
    })
    await conn.end()
    return
  }

  await conn.end()

  // Build 12 — Data Integrity Guard. Read back every PK we just wrote and
  // verify: row exists, company_id is non-null + in the active allowlist,
  // tenant_id present, pedimento format intact. Any drift fires Telegram
  // and degrades scrape_runs.status from success → degraded.
  let integrity = { verdict: 'green', summary: { integrity_pct: 100 } }
  if (writtenTraficos.length > 0 || writtenEntradas.length > 0) {
    integrity = await runPostSyncVerification(supabase, {
      syncType: 'globalpc_delta',
      batches: [
        ...(writtenTraficos.length > 0 ? [{
          table: 'traficos',
          pkColumn: 'trafico',
          expectedPks: writtenTraficos,
        }] : []),
        ...(writtenEntradas.length > 0 ? [{
          table: 'entradas',
          pkColumn: 'cve_entrada',
          expectedPks: writtenEntradas,
        }] : []),
      ],
      scriptName: 'globalpc-delta-sync',
      companyIds: validCompanyIds,
    })
    console.log(`🔎 Integrity ${integrity.verdict.toUpperCase()} · ${integrity.summary.integrity_pct}% (expected ${integrity.summary.expected}, found ${integrity.summary.found}, missing ${integrity.summary.missing}, violations ${integrity.summary.violation_rows})`)
  }

  await supabase.from('scrape_runs').insert({
    source: 'globalpc_delta', started_at: startedAt,
    completed_at: new Date().toISOString(),
    records_found: totalFound, records_new: totalNew,
    records_updated: totalUpdated,
    status: integrity.verdict === 'red' ? 'degraded' : 'success',
    metadata: { statusChanges, integrity_verdict: integrity.verdict, integrity_pct: integrity.summary.integrity_pct }
  })
}

withSyncLog(supabase, { sync_type: 'globalpc_delta', company_id: null }, run).catch(console.error)
