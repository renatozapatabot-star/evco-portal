#!/usr/bin/env node
// scripts/good-news-detector.js
// ============================================================================
// CRUZ Good News Detector
//
// Runs every 30 minutes via cron. Detects positive events and emits
// celebration notifications to portal (Supabase), Telegram, and push.
//
// Events detected:
//   1. Expediente 100% complete
//   2. Clean crossing (no reconocimiento)
//   3. Document received before 48h escalation deadline
//   4. Monthly milestone (round number of completed traficos)
//
// Cron: */30 6-22 * * 1-6  (every 30 min, business hours, Mon-Sat)
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'good-news-detector'
const DRY_RUN = process.argv.includes('--dry-run')
const MAX_CELEBRATIONS_PER_DAY = 5

// ── Telegram ──

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true' || DRY_RUN) {
    console.log('[telegram]', message)
    return
  }
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  }).catch(() => {})
}

// ── Daily cap check ──

async function canEmit(companyId, eventType) {
  const today = new Date().toISOString().slice(0, 10)

  // Check total celebrations for this company today
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('severity', 'celebration')
    .gte('created_at', `${today}T00:00:00Z`)

  if ((count ?? 0) >= MAX_CELEBRATIONS_PER_DAY) {
    console.log(`[cap] ${companyId} hit daily cap (${MAX_CELEBRATIONS_PER_DAY}), skipping ${eventType}`)
    return false
  }

  // Check 24h dedup on same event type + company
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('type', eventType)
    .gte('created_at', since)

  if ((recentCount ?? 0) > 0) {
    console.log(`[dedup] ${eventType} for ${companyId} already sent in last 24h`)
    return false
  }

  return true
}

// ── Emit notification ──

async function emitNotification(notification) {
  const allowed = await canEmit(notification.company_id, notification.type)
  if (!allowed) return

  if (DRY_RUN) {
    console.log('[dry-run] Would emit:', JSON.stringify(notification, null, 2))
    return
  }

  // Insert into notifications table (triggers Realtime → portal toast)
  const { error } = await supabase.from('notifications').insert({
    type: notification.type,
    severity: 'celebration',
    title: notification.title,
    description: notification.description,
    action_url: notification.action_url,
    company_id: notification.company_id,
    read: false,
  })

  if (error) {
    console.error(`[error] Failed to insert notification:`, error.message)
    return
  }

  console.log(`[emit] ${notification.type} → ${notification.company_id}: ${notification.title}`)

  // Telegram delivery
  if (notification.channels.includes('telegram')) {
    await sendTelegram(`${notification.title}\n${notification.description}`)
  }

  // Upsert daily cap counter
  const today = new Date().toISOString().slice(0, 10)
  await supabase.from('good_news_caps').upsert({
    company_id: notification.company_id,
    event_type: notification.type,
    event_date: today,
    count: 1,
  }, { onConflict: 'company_id,event_type,event_date' }).then(() => {}, () => {})
}

// ── Detectors ──

async function getLastRunTime() {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'good_news_last_run')
    .single()

  if (data?.value?.timestamp) return data.value.timestamp

  // Default: 30 minutes ago
  return new Date(Date.now() - 30 * 60 * 1000).toISOString()
}

async function updateLastRunTime() {
  if (DRY_RUN) return
  await supabase.from('system_config').upsert({
    key: 'good_news_last_run',
    value: { timestamp: new Date().toISOString() },
    valid_from: new Date().toISOString(),
    valid_to: '2099-12-31T00:00:00Z',
  }, { onConflict: 'key' }).then(() => {}, () => {})
}

/**
 * Detect traficos that crossed cleanly (no reconocimiento / semaforo rojo)
 */
async function detectCleanCrossings(since) {
  const { data: crossings } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, semaforo, updated_at')
    .ilike('estatus', '%cruz%')
    .gte('updated_at', since)
    .neq('semaforo', 1) // 1 = rojo/reconocimiento
    .limit(20)

  if (!crossings?.length) return

  console.log(`[detect] ${crossings.length} clean crossing(s) since ${since}`)

  for (const t of crossings) {
    // Estimate time saved vs average crossing with reconocimiento (~180 min)
    const timeSavedMinutes = 180
    const hours = Math.round(timeSavedMinutes / 60 * 10) / 10
    const timeSaved = `~${hours} hrs`

    await emitNotification({
      type: 'crossing_clean',
      title: '🦀 Cruce limpio',
      description: `Tu tráfico ${t.trafico} pasó sin reconocimiento. Ahorraste ${timeSaved} vs el promedio.`,
      channels: ['portal', 'push'],
      action_url: '/traficos',
      company_id: t.company_id,
    })
  }
}

/**
 * Detect documents received before the 48h escalation deadline
 */
async function detectEarlyDocs(since) {
  const { data: earlyDocs } = await supabase
    .from('documento_solicitudes')
    .select('trafico_id, doc_type, proveedor, company_id, received_at, escalate_after')
    .eq('status', 'recibido')
    .gte('received_at', since)
    .limit(20)

  if (!earlyDocs?.length) return

  // Filter to only those received before escalation deadline
  const early = earlyDocs.filter(d => d.received_at && d.escalate_after && d.received_at < d.escalate_after)
  if (!early.length) return

  console.log(`[detect] ${early.length} early doc receipt(s)`)

  for (const d of early) {
    await emitNotification({
      type: 'doc_received_early',
      title: '🦀 Documento recibido a tiempo',
      description: `${d.proveedor || 'Proveedor'} envió ${d.doc_type} para ${d.trafico_id || 'tráfico'} antes del plazo.`,
      channels: ['portal'],
      action_url: '/documentos',
      company_id: d.company_id,
    })
  }
}

/**
 * Detect monthly milestone crossings (10, 25, 50, 100, etc.)
 */
async function detectMilestones() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthName = now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'America/Chicago' })

  // Get all companies
  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, name')
    .limit(50)

  if (!companies?.length) return

  const milestones = [10, 25, 50, 75, 100, 150, 200, 250, 500]

  for (const company of companies) {
    const { count } = await supabase
      .from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('company_id', company.company_id)
      .ilike('estatus', '%cruz%')
      .gte('fecha_cruce', monthStart)

    const completed = count ?? 0
    const milestone = milestones.find(m => m === completed)

    if (milestone) {
      await emitNotification({
        type: 'milestone_reached',
        title: '🦀 Hito alcanzado',
        description: `${milestone} tráficos completados en ${monthName}. ¡Bien hecho!`,
        channels: ['portal', 'push'],
        action_url: '/reportes',
        company_id: company.company_id,
      })
    }
  }
}

// ── Main ──

async function main() {
  const since = await getLastRunTime()
  console.log(`[start] Good news detector — scanning since ${since}${DRY_RUN ? ' (dry run)' : ''}`)

  await Promise.all([
    detectCleanCrossings(since),
    detectEarlyDocs(since),
    detectMilestones(),
  ])

  await updateLastRunTime()
  console.log(`[done] Good news scan complete`)
}

main().catch(async (err) => {
  console.error(`[fatal] ${SCRIPT_NAME}: ${err.message}`)
  await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${err.message}`)
  process.exit(1)
})
