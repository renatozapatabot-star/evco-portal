#!/usr/bin/env node
/**
 * CRUZ GlobalPC Delta Sync
 * Runs every 15 minutes during business hours
 * Only pulls records changed since last sync
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
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
    return new Date(Date.now() - 30 * 60 * 1000)
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
    return
  }

  const { data: companies } = await supabase
    .from('companies').select('company_id, clave_cliente').eq('active', true)
  const claveMap = {}
  ;(companies || []).forEach(c => { claveMap[c.clave_cliente] = c.company_id })

  let totalFound = 0, totalNew = 0, totalUpdated = 0, statusChanges = 0

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
        const batch = trafRows.slice(i, i + 100).map(r => {
          const prev = existMap[r.trafico]
          if (prev && prev.estatus !== r.estatus) {
            changes.push({ trafico: r.trafico, from: prev.estatus, to: r.estatus })
          }
          if (!prev) totalNew++; else totalUpdated++
          return {
            trafico: r.trafico,
            clave_cliente: r.clave_cliente,
            company_id: claveMap[r.clave_cliente] || r.clave_cliente,
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
        await supabase.from('traficos').upsert(batch, { onConflict: 'trafico', ignoreDuplicates: false })
      }

      totalFound = trafRows.length
      statusChanges = changes.length

      // Alert on critical status changes
      const critical = changes.filter(c =>
        c.to === 'Cruzado' || c.to === 'Detenido' || (c.to || '').includes('Rojo')
      )
      for (const ch of critical.slice(0, 5)) {
        const emoji = (ch.to || '').includes('Cruz') ? '✅' : (ch.to || '').includes('Rojo') ? '🔴' : '⚠️'
        await tg(`${emoji} <b>${ch.trafico}</b>\n${ch.from} → ${ch.to}\n— CRUZ 🦀`)
      }
    }

    // Delta entradas
    const [entRows] = await conn.execute(`
      SELECT
        e.sCveEntradaBodega as entrada_id,
        e.sCveCliente as cve_cliente,
        e.dFechaLlegadaMercancia as fecha_llegada,
        e.iCantidadBultosRecibidos as bultos_recibidos,
        e.iPesoBruto as peso_recibido,
        e.bFaltantes as tiene_faltantes,
        e.bMercanciaDanada as mercancia_danada,
        e.sDescripcionMercancia as descripcion_mercancia,
        e.sRecibidoPor as recibido_por,
        e.sCveProveedor as proveedor
      FROM cb_entrada_bodega e
      WHERE e.dFechaActualizacion >= ?
      ORDER BY e.dFechaActualizacion DESC
      LIMIT 2000
    `, [lastSyncStr])

    if (entRows.length > 0) {
      for (let i = 0; i < entRows.length; i += 200) {
        const batch = entRows.slice(i, i + 200).map(r => ({
          entrada_id: r.entrada_id,
          cve_cliente: r.cve_cliente,
          company_id: claveMap[r.cve_cliente] || r.cve_cliente,
          fecha_llegada: r.fecha_llegada,
          bultos_recibidos: r.bultos_recibidos,
          peso_recibido: r.peso_recibido,
          tiene_faltantes: r.tiene_faltantes === '1' || r.tiene_faltantes === 1,
          mercancia_danada: r.mercancia_danada === '1' || r.mercancia_danada === 1,
          descripcion_mercancia: r.descripcion_mercancia,
          recibido_por: r.recibido_por,
          proveedor: r.proveedor,
          updated_at: new Date().toISOString()
        }))
        await supabase.from('entradas').upsert(batch, { onConflict: 'entrada_id', ignoreDuplicates: false })
      }
      totalFound += entRows.length
    }

    console.log(`✅ Tráficos: ${trafRows.length} (${totalNew} new, ${totalUpdated} updated, ${statusChanges} status changes)`)
    console.log(`✅ Entradas: ${entRows.length}`)

    if (totalNew > 0 || statusChanges > 0) {
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
  await supabase.from('scrape_runs').insert({
    source: 'globalpc_delta', started_at: startedAt,
    completed_at: new Date().toISOString(),
    records_found: totalFound, records_new: totalNew,
    records_updated: totalUpdated, status: 'success',
    metadata: { statusChanges }
  })
}

run().catch(console.error)
