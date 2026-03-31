#!/usr/bin/env node
/**
 * CRUZ Status Watcher
 * Polls traficos for status changes and inserts notification_events rows.
 *
 * Watermark approach: stores last_checked timestamp in a local checkpoint file.
 * Each poll queries traficos WHERE updated_at > last_checked, compares estatus
 * against a local cache, and inserts a notification when estatus differs.
 *
 * SHADOW_MODE (default true): inserts with status='shadow' so
 * send-notifications.js ignores them. Set SHADOW_MODE=false to go live.
 *
 * Runs continuously via pm2 with 60-second poll interval.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'status-watcher'
const SHADOW_MODE = process.env.SHADOW_MODE !== 'false'
const POLL_INTERVAL_MS = 60_000
const CHECKPOINT_PATH = path.join(__dirname, '..', '.status-watcher-checkpoint.json')
const PORTAL_URL = 'https://portal.renatozapata.com'

// ── Status → template mapping ──

const STATUS_MAP = {
  'En Proceso':      { template_key: 'entrada_created',  event_type: 'entrada_created' },
  'Documentacion':   { template_key: 'entrada_created',  event_type: 'entrada_created' },
  'En Aduana':       { template_key: 'pedimento_filed',  event_type: 'pedimento_filed' },
  'Cruzado':         { template_key: 'cleared',          event_type: 'cleared' },
  'Detenido':        { template_key: 'hold_placed',      event_type: 'hold_placed' },
  'Liberado':        { template_key: 'cleared',          event_type: 'cleared' },
  'Entregado':       { template_key: 'cleared',          event_type: 'cleared' },
}

// ── Helpers ──

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

function loadCheckpoint() {
  try {
    const raw = fs.readFileSync(CHECKPOINT_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      last_checked: parsed.last_checked || null,
      known_statuses: parsed.known_statuses || {},
    }
  } catch {
    return { last_checked: null, known_statuses: {} }
  }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2))
}

// ── Notification prefs cache ──

let prefsCache = null
let prefsCacheAge = 0
const PREFS_TTL_MS = 5 * 60_000 // refresh every 5 min

async function getPrefs() {
  if (prefsCache && Date.now() - prefsCacheAge < PREFS_TTL_MS) return prefsCache
  const { data, error } = await supabase
    .from('client_notification_prefs')
    .select('client_code, primary_email, notify_entrada_created, notify_pedimento_filed, notify_cleared, notify_hold')
  if (error) {
    console.error(`[${SCRIPT_NAME}] Failed to load prefs:`, error.message)
    return prefsCache || {}
  }
  // Index by client_code
  prefsCache = {}
  for (const row of data) {
    prefsCache[row.client_code] = row
  }
  prefsCacheAge = Date.now()
  return prefsCache
}

// Check if client wants this notification type
function clientWantsNotification(pref, eventType) {
  if (!pref) return false
  const flagMap = {
    entrada_created: 'notify_entrada_created',
    pedimento_filed: 'notify_pedimento_filed',
    cleared: 'notify_cleared',
    hold_placed: 'notify_hold',
  }
  const flag = flagMap[eventType]
  return flag ? pref[flag] !== false : true
}

// ── Subject builder (matches send-notifications templates) ──

function buildSubject(eventType, trafico) {
  switch (eventType) {
    case 'entrada_created': return `Solicitud Recibida \u2014 ${trafico}`
    case 'pedimento_filed': return `Pedimento Presentado \u2014 ${trafico}`
    case 'cleared':         return `\u2713 Mercanc\u00EDa Liberada \u2014 ${trafico}`
    case 'hold_placed':     return `\u26A0\uFE0F Retenci\u00F3n \u2014 ${trafico}`
    default:                return `Actualizaci\u00F3n \u2014 ${trafico}`
  }
}

// ── Poll cycle ──

async function poll() {
  const cp = loadCheckpoint()
  const now = new Date().toISOString()

  // First run: seed known_statuses without triggering notifications
  if (!cp.last_checked) {
    console.log(`[${SCRIPT_NAME}] First run — seeding known statuses (no notifications)`)
    const { data, error } = await supabase
      .from('traficos')
      .select('trafico, estatus, company_id')
      .limit(5000)
    if (error) {
      console.error(`[${SCRIPT_NAME}] Seed fetch error:`, error.message)
      return
    }
    const known = {}
    for (const row of data) {
      known[row.trafico] = row.estatus
    }
    saveCheckpoint({ last_checked: now, known_statuses: known })
    console.log(`[${SCRIPT_NAME}] Seeded ${Object.keys(known).length} traficos`)
    return
  }

  // Fetch traficos updated since last check
  const { data: updated, error } = await supabase
    .from('traficos')
    .select('trafico, estatus, company_id, descripcion_mercancia, pedimento, updated_at')
    .gt('updated_at', cp.last_checked)
    .order('updated_at', { ascending: true })
    .limit(500)

  if (error) {
    console.error(`[${SCRIPT_NAME}] Poll error:`, error.message)
    return
  }

  if (!updated || updated.length === 0) {
    cp.last_checked = now
    saveCheckpoint(cp)
    return
  }

  const prefs = await getPrefs()
  let inserted = 0
  let skippedNoMap = 0
  let skippedNoPrefs = 0
  let skippedOptOut = 0
  let unchanged = 0

  for (const row of updated) {
    const prevStatus = cp.known_statuses[row.trafico]
    const curStatus = row.estatus

    // Update known status regardless
    cp.known_statuses[row.trafico] = curStatus

    // Skip if status hasn't actually changed
    if (prevStatus === curStatus) {
      unchanged++
      continue
    }

    // Skip if new status isn't in our mapping
    const mapping = STATUS_MAP[curStatus]
    if (!mapping) {
      skippedNoMap++
      console.log(`  [SKIP] ${row.trafico}: ${prevStatus || '(new)'} → ${curStatus} (no template mapping)`)
      continue
    }

    // Look up client prefs
    const pref = prefs[row.company_id]
    if (!pref || !pref.primary_email) {
      skippedNoPrefs++
      console.log(`  [SKIP] ${row.trafico}: no notification prefs for client "${row.company_id}"`)
      continue
    }

    // Check opt-in
    if (!clientWantsNotification(pref, mapping.event_type)) {
      skippedOptOut++
      console.log(`  [SKIP] ${row.trafico}: client "${row.company_id}" opted out of ${mapping.event_type}`)
      continue
    }

    const insertStatus = SHADOW_MODE ? 'shadow' : 'pending'

    const { error: insertErr } = await supabase
      .from('notification_events')
      .insert({
        trafico_id: row.trafico,
        event_type: mapping.event_type,
        recipient_email: pref.primary_email,
        subject: buildSubject(mapping.event_type, row.trafico),
        template_key: mapping.template_key,
        template_vars: {
          trafico_number: row.trafico,
          company_id: row.company_id,
          estatus: curStatus,
          descripcion_mercancia: row.descripcion_mercancia || null,
          pedimento_number: row.pedimento || null,
          portal_url: PORTAL_URL,
        },
        status: insertStatus,
      })

    if (insertErr) {
      console.error(`  [ERR] ${row.trafico}: insert failed — ${insertErr.message}`)
      continue
    }

    const modeTag = SHADOW_MODE ? 'SHADOW' : 'QUEUED'
    console.log(`  [${modeTag}] ${row.trafico}: ${prevStatus || '(new)'} → ${curStatus} → ${mapping.template_key} → ${pref.primary_email}`)
    inserted++
  }

  cp.last_checked = now
  saveCheckpoint(cp)

  if (inserted > 0 || skippedNoMap > 0 || skippedNoPrefs > 0) {
    const mode = SHADOW_MODE ? ' (shadow)' : ''
    console.log(`[${SCRIPT_NAME}] Poll: ${updated.length} updated, ${unchanged} unchanged, ${inserted} notified${mode}, ${skippedNoMap} no-map, ${skippedNoPrefs} no-prefs, ${skippedOptOut} opted-out`)
  }
}

// ── Main loop ──

async function main() {
  console.log(`[${SCRIPT_NAME}] Starting — SHADOW_MODE=${SHADOW_MODE} — polling every ${POLL_INTERVAL_MS / 1000}s`)

  // Initial poll
  try {
    await poll()
  } catch (err) {
    console.error(`[${SCRIPT_NAME}] Initial poll error:`, err.message)
    await tg(`\uD83D\uDD34 ${SCRIPT_NAME} startup error: ${err.message}`)
  }

  // Continuous polling
  setInterval(async () => {
    try {
      await poll()
    } catch (err) {
      console.error(`[${SCRIPT_NAME}] Poll error:`, err.message)
      await tg(`\uD83D\uDD34 ${SCRIPT_NAME} poll error: ${err.message}`)
    }
  }, POLL_INTERVAL_MS)
}

main()
