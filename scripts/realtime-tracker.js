#!/usr/bin/env node

// ============================================================
// CRUZ Realtime Tracker — polls GlobalPC for active tráficos
// Only polls "En Proceso" tráficos (not completed — saves resources).
// Detects status changes and pushes to Supabase immediately.
// Cron: */15 6-22 * * 1-6 (every 15 min, business hours)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function main() {
  const start = Date.now()

  // Get all active (non-crossed) tráficos
  const { data: activeTraficos } = await supabase
    .from('traficos')
    .select('id, trafico, estatus, company_id, pedimento, fecha_cruce')
    .neq('estatus', 'Cruzado')
    .gte('fecha_llegada', '2024-01-01')
    .limit(500)

  const active = activeTraficos || []
  if (active.length === 0) {
    process.exit(0)
  }

  // Check GlobalPC for status updates via the sync tables
  // Since we can't directly query GlobalPC MySQL in this context,
  // we compare against globalpc_eventos for status changes
  const { data: recentEvents } = await supabase
    .from('globalpc_eventos')
    .select('cve_trafico, evento, fecha_evento')
    .gte('fecha_evento', new Date(Date.now() - 30 * 60000).toISOString()) // Last 30 min
    .limit(100)

  const eventMap = new Map()
  for (const e of (recentEvents || [])) {
    if (!eventMap.has(e.cve_trafico)) eventMap.set(e.cve_trafico, [])
    eventMap.get(e.cve_trafico).push(e)
  }

  let statusChanges = 0

  for (const t of active) {
    const events = eventMap.get(t.trafico) || []
    if (events.length === 0) continue

    // Check for crossing event
    const crossingEvent = events.find(e =>
      (e.evento || '').toLowerCase().includes('cruce') ||
      (e.evento || '').toLowerCase().includes('despacho') ||
      (e.evento || '').toLowerCase().includes('liberado')
    )

    if (crossingEvent && t.estatus !== 'Cruzado') {
      if (!DRY_RUN) {
        await supabase.from('traficos').update({
          estatus: 'Cruzado',
          fecha_cruce: crossingEvent.fecha_evento || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', t.id)

        // Log to timeline
        await supabase.from('trafico_timeline').insert({
          trafico_id: t.trafico,
          event_type: 'crossed',
          content_es: `Tráfico cruzó — evento detectado en tiempo real`,
          source: 'realtime_tracker',
          created_at: new Date().toISOString(),
        }).then(() => {}, () => {})
      }

      statusChanges++
      console.log(`  ✅ ${t.trafico} → Cruzado (${t.company_id})`)

      await sendTelegram(
        `✅ <b>${t.trafico}</b> acaba de cruzar\n` +
        `Cliente: ${t.company_id}\n— CRUZ 🦀`
      )
    }

    // Check for pedimento event
    const pedEvent = events.find(e =>
      (e.evento || '').toLowerCase().includes('pedimento') ||
      (e.evento || '').toLowerCase().includes('transmit')
    )

    if (pedEvent && !t.pedimento) {
      if (!DRY_RUN) {
        await supabase.from('trafico_timeline').insert({
          trafico_id: t.trafico,
          event_type: 'pedimento',
          content_es: `Actividad de pedimento detectada`,
          source: 'realtime_tracker',
          created_at: new Date().toISOString(),
        }).then(() => {}, () => {})
      }
      statusChanges++
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  if (statusChanges > 0) {
    console.log(`\n✅ ${statusChanges} status change(s) detected · ${active.length} active · ${elapsed}s`)
  }

  // Heartbeat (only log if changes detected or every hour)
  const minute = new Date().getMinutes()
  if (statusChanges > 0 || minute < 15) {
    await supabase.from('heartbeat_log').insert({
      script: 'realtime-tracker',
      status: 'success',
      details: { active: active.length, changes: statusChanges, elapsed_s: parseFloat(elapsed) },
    }).then(() => {}, () => {})
  }

  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
