#!/usr/bin/env node
/**
 * CRUZ Touch Monitor — Shadow-Touch Detection + Snapshot
 * ============================================================================
 * Runs every 60 seconds for pilot shipments.
 * Snapshots tráfico state, detects unauthorized field changes,
 * alerts on touch budget exceeded.
 *
 * Layer 4 of the One-Touch Verification Framework.
 *
 * Cron: * * * * * (every minute, only during active pilots)
 * PM2: cruz-touch-monitor
 *
 * Patente 3596 · Aduana 240
 * ============================================================================
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'touch-monitor'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sendTelegram(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG skip]', msg.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

// Fields to monitor for shadow touches
const MONITORED_FIELDS = [
  'estatus', 'pedimento', 'semaforo', 'fecha_cruce', 'fecha_pago',
  'importe_total', 'fraccion_arancelaria', 'regimen', 'transportista_mexicano',
  'touch_count',
]

async function run() {
  // Find active pilot shipments
  const { data: pilots, error } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, pedimento, semaforo, fecha_cruce, fecha_pago, importe_total, fraccion_arancelaria, regimen, transportista_mexicano, touch_count')
    .eq('is_pilot', true)
    .not('estatus', 'ilike', '%entreg%')
    .limit(20)

  if (error || !pilots || pilots.length === 0) return // No active pilots

  for (const pilot of pilots) {
    const currentSnapshot = {}
    for (const field of MONITORED_FIELDS) {
      currentSnapshot[field] = pilot[field]
    }

    // Get last snapshot
    const { data: lastSnap } = await supabase
      .from('trafico_snapshots')
      .select('snapshot')
      .eq('trafico_id', pilot.trafico)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastSnap) {
      // Compare fields
      const prev = lastSnap.snapshot || {}
      const changes = []

      for (const field of MONITORED_FIELDS) {
        const oldVal = JSON.stringify(prev[field])
        const newVal = JSON.stringify(currentSnapshot[field])
        if (oldVal !== newVal) {
          changes.push({ field, from: prev[field], to: currentSnapshot[field] })
        }
      }

      if (changes.length > 0) {
        // Check if changes are traceable to workflow_events or approval gate
        const oneMinAgo = new Date(Date.now() - 60000).toISOString()

        const { data: recentEvents } = await supabase
          .from('workflow_events')
          .select('event_type, payload')
          .eq('trigger_id', pilot.trafico)
          .gte('created_at', oneMinAgo)
          .limit(10)

        const { data: recentApprovals } = await supabase
          .from('audit_log')
          .select('action, details')
          .or(`entity_id.eq.${pilot.trafico},details->>trafico_id.eq.${pilot.trafico}`)
          .gte('created_at', oneMinAgo)
          .limit(10)

        const traceable = (recentEvents?.length || 0) + (recentApprovals?.length || 0)

        if (traceable === 0 && changes.some(c => c.field !== 'touch_count')) {
          // SHADOW TOUCH DETECTED
          const changeStr = changes.map(c => `${c.field}: ${c.from} -> ${c.to}`).join(', ')
          await sendTelegram(
            `🔴 <b>SHADOW TOUCH DETECTED</b>\n` +
            `Trafico: <code>${pilot.trafico}</code>\n` +
            `Changes: ${changeStr}\n` +
            `No matching workflow_event or approval found.\n` +
            `— CRUZ Touch Monitor`
          )

          // Log to audit
          await supabase.from('audit_log').insert({
            action: 'shadow_touch_detected',
            entity_type: 'trafico',
            entity_id: pilot.trafico,
            details: { changes, traceable_events: 0 },
          }).then(() => {}, () => {})
        }
      }
    }

    // Save current snapshot
    await supabase.from('trafico_snapshots').insert({
      trafico_id: pilot.trafico,
      snapshot: currentSnapshot,
    }).then(() => {}, () => {})

    // Check touch budget
    if (pilot.touch_count > 5) {
      await sendTelegram(
        `🔴 <b>TOUCH BUDGET EXCEEDED</b>\n` +
        `Trafico: <code>${pilot.trafico}</code>\n` +
        `Touches: ${pilot.touch_count}/5\n` +
        `Pilot shipment has exceeded the 5-touch limit.\n` +
        `— CRUZ Touch Monitor`
      )
    }
  }
}

// Daemon mode — run every 60 seconds
// Matches the original cron: * * * * * (every minute)
// Converted from one-shot to daemon to prevent PM2 crash loop (was 529+ restarts)
async function tick() {
  try {
    await run()
  } catch (err) {
    console.error('Touch monitor error:', err.message)
    await supabase.from('operational_decisions').insert({
      decision_type: 'script_failed',
      script_name: 'touch-monitor',
      details: { status: 'error', error: err.message },
      created_at: new Date().toISOString()
    }).then(() => {}, () => {})
  }
}

// Initial run + interval
tick()
setInterval(tick, 60_000)
console.log('Touch monitor daemon started — polling every 60s')
