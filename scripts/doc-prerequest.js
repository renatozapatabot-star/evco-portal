#!/usr/bin/env node
/**
 * CRUZ Doc Pre-Request (Pre-solicitud matutina)
 * Runs daily at 6 AM via pm2
 *
 * Purpose:
 *   1. Links unlinked entradas to open tráficos by supplier name similarity
 *   2. Creates document requests for linked tráficos missing docs
 *
 * Logic:
 *   - Query entrada_lifecycle WHERE trafico_id IS NULL, 2h–48h old
 *   - Match to open tráficos by supplier name containment
 *   - For linked tráficos with < 3 docs and > 1 day old → insert documento_solicitudes
 *   - Log to heartbeat_log + Telegram summary
 *
 * On failure: red Telegram alert with error
 *
 * — CRUZ 🦀
 */

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'doc-prerequest.js'
const COMPANY_ID = 'evco' // Scripts are exempt from hardcode rule per CLAUDE.md
const MIN_DOCS = 3        // Minimum expected docs per tráfico
const TRAFICO_AGE_HOURS = 24 // Tráfico must be > 1 day old to trigger solicitud

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', message.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
    })
  } catch (e) {
    console.error('Telegram send error:', e.message)
  }
}

/**
 * Normalize supplier name for comparison:
 * lowercase, trim, strip common suffixes (S.A., de C.V., S. de R.L., etc.)
 */
function normalizeSupplier(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, '')
    .replace(/\b(sa|sa de cv|s de rl|s de rl de cv|de cv|sapi|sapi de cv|inc|llc|ltd|corp)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if supplier names match by containment:
 * either a contains b or b contains a (after normalization)
 */
function supplierMatch(entradaSupplier, traficoSupplier) {
  const a = normalizeSupplier(entradaSupplier)
  const b = normalizeSupplier(traficoSupplier)
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

async function run() {
  const timestamp = nowCST()
  console.log(`📋 CRUZ Doc Pre-Request — ${timestamp}`)

  const now = new Date()
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

  // Step 1: Fetch unlinked entradas (2h–48h old)
  const { data: unlinked, error: entradaErr } = await supabase
    .from('entrada_lifecycle')
    .select('id, entrada_number, supplier, created_at')
    .eq('company_id', COMPANY_ID)
    .is('trafico_id', null)
    .gte('created_at', fortyEightHoursAgo)
    .lt('created_at', twoHoursAgo)

  if (entradaErr) throw new Error(`Failed to query entrada_lifecycle: ${entradaErr.message}`)

  console.log(`  Unlinked entradas (2h–48h): ${unlinked?.length || 0}`)

  let linkedCount = 0

  if (unlinked && unlinked.length > 0) {
    // Fetch open tráficos for matching
    const oldestEntrada = unlinked.reduce((min, e) =>
      e.created_at < min ? e.created_at : min, unlinked[0].created_at
    )
    const matchWindow = new Date(new Date(oldestEntrada).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: openTraficos, error: traficoErr } = await supabase
      .from('traficos')
      .select('id, trafico, proveedores, fecha_llegada')
      .eq('company_id', COMPANY_ID)
      .neq('estatus', 'Cruzado')
      .gte('fecha_llegada', matchWindow)
      .not('proveedores', 'is', null)

    if (traficoErr) throw new Error(`Failed to query traficos: ${traficoErr.message}`)

    console.log(`  Open tráficos in window: ${openTraficos?.length || 0}`)

    // Step 2: Match unlinked entradas to tráficos by supplier similarity
    for (const entrada of unlinked) {
      if (!entrada.supplier) continue

      const match = (openTraficos || []).find(t => supplierMatch(entrada.supplier, t.proveedores))
      if (!match) continue

      // Update entrada with trafico link
      const { error: updateErr } = await supabase
        .from('entrada_lifecycle')
        .update({
          trafico_id: match.trafico,
          trafico_assigned_at: now.toISOString()
        })
        .eq('id', entrada.id)

      if (updateErr) {
        console.warn(`  ⚠️  Failed to link entrada ${entrada.entrada_number}: ${updateErr.message}`)
        continue
      }

      // Insert notification
      await supabase.from('notifications').insert({
        company_id: COMPANY_ID,
        type: 'entrada_linked',
        severity: 'info',
        title: `Entrada ${entrada.entrada_number} vinculada automáticamente`,
        description: `Entrada ${entrada.entrada_number} vinculada a tráfico ${match.trafico} por coincidencia de proveedores (${entrada.supplier})`
      })

      linkedCount++
      console.log(`  ✅ Linked: ${entrada.entrada_number} → ${match.trafico} (${entrada.supplier})`)
    }
  }

  // Step 3: Find linked entradas with tráficos missing docs
  const oneDayAgo = new Date(now.getTime() - TRAFICO_AGE_HOURS * 60 * 60 * 1000).toISOString()

  const { data: linkedEntradas, error: linkedErr } = await supabase
    .from('entrada_lifecycle')
    .select('id, trafico_id')
    .eq('company_id', COMPANY_ID)
    .not('trafico_id', 'is', null)
    .lt('created_at', oneDayAgo)

  if (linkedErr) throw new Error(`Failed to query linked entradas: ${linkedErr.message}`)

  let solicitudesCreated = 0
  const processedTraficos = new Set()

  for (const entrada of (linkedEntradas || [])) {
    if (processedTraficos.has(entrada.trafico_id)) continue
    processedTraficos.add(entrada.trafico_id)

    // Count docs for this tráfico
    const { count, error: countErr } = await supabase
      .from('expediente_documentos')
      .select('id', { count: 'exact', head: true })
      .eq('trafico_id', entrada.trafico_id)

    if (countErr) {
      console.warn(`  ⚠️  Failed to count docs for ${entrada.trafico_id}: ${countErr.message}`)
      continue
    }

    if ((count || 0) < MIN_DOCS) {
      // Check if solicitud already exists to avoid duplicate
      const { data: existing } = await supabase
        .from('documento_solicitudes')
        .select('id')
        .eq('trafico_id', entrada.trafico_id)
        .eq('doc_type', 'DOCUMENTOS_PENDIENTES')
        .maybeSingle()

      if (existing) continue

      const { error: insertErr } = await supabase
        .from('documento_solicitudes')
        .insert({
          trafico_id: entrada.trafico_id,
          company_id: COMPANY_ID,
          doc_type: 'DOCUMENTOS_PENDIENTES',
          status: 'solicitado',
          solicitado_at: now.toISOString()
        })

      if (insertErr) {
        console.warn(`  ⚠️  Failed to create solicitud for ${entrada.trafico_id}: ${insertErr.message}`)
        continue
      }

      solicitudesCreated++
      console.log(`  📄 Solicitud created: ${entrada.trafico_id} (${count || 0} docs)`)
    }
  }

  // Step 4: Log to heartbeat_log
  await supabase.from('heartbeat_log').insert({
    all_ok: true,
    details: {
      script: SCRIPT_NAME,
      entradas_checked: unlinked?.length || 0,
      entradas_linked: linkedCount,
      solicitudes_created: solicitudesCreated,
      timestamp
    }
  })

  // Step 5: Telegram summary
  const dateStr = now.toLocaleDateString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short', year: 'numeric'
  })

  const msg = [
    `📋 <b>Pre-solicitud matutina — ${dateStr}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Entradas vinculadas: <b>${linkedCount}</b>`,
    `Solicitudes creadas: <b>${solicitudesCreated}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `— CRUZ 🦀`
  ].join('\n')

  await sendTelegram(msg)

  console.log(`\n✅ ${SCRIPT_NAME} complete — linked: ${linkedCount}, solicitudes: ${solicitudesCreated}`)
  process.exit(0)
}

run().catch(async (err) => {
  console.error(`Fatal ${SCRIPT_NAME} error:`, err)
  try {
    await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>\n${err.message}\n— CRUZ 🦀`)
    await supabase.from('heartbeat_log').insert({
      all_ok: false,
      details: { script: SCRIPT_NAME, fatal: err.message }
    })
  } catch (_) { /* best effort */ }
  process.exit(1)
})
