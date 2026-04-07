#!/usr/bin/env node
/**
 * CRUZ End-of-Day Robot — Build 218
 * ============================================================================
 * Daily summary at 5 PM CST. Tells each operator what was accomplished,
 * what's left, and what tomorrow looks like.
 *
 * Cron: 0 22 * * 1-5 (5 PM CST = 22:00 UTC, weekdays)
 *
 * Patente 3596 · Aduana 240
 * ============================================================================
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'end-of-day-engine'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function todayCST() {
  // Today in America/Chicago
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function tomorrowCST() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

// ── Gather today's stats ─────────────────────────────────────────────────────

async function getTodayStats(companyId) {
  const today = todayCST()

  // Launchpad completions today
  const { data: completions } = await supabase
    .from('launchpad_completions')
    .select('source_table, status')
    .eq('company_id', companyId)
    .eq('action_date', today)

  const completed = (completions || []).filter(c => c.status === 'completed').length
  const postponed = (completions || []).filter(c => c.status === 'postponed').length

  // Workflow events completed today
  const { data: events } = await supabase
    .from('workflow_events')
    .select('workflow, event_type, status')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('completed_at', `${today}T00:00:00`)
    .lte('completed_at', `${today}T23:59:59`)

  const eventsByWorkflow = {}
  for (const e of (events || [])) {
    eventsByWorkflow[e.workflow] = (eventsByWorkflow[e.workflow] || 0) + 1
  }

  // Drafts created today
  const { count: draftsCreated } = await supabase
    .from('pedimento_drafts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00`)

  // Documents received today (status changed to recibido)
  const { count: docsReceived } = await supabase
    .from('documento_solicitudes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'recibido')
    .gte('recibido_at', `${today}T00:00:00`)

  // Tráficos that crossed today
  const { count: cruces } = await supabase
    .from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('fecha_cruce', `${today}T00:00:00`)

  // CRUZ auto-actions today (time saved)
  const { data: autoActions } = await supabase
    .from('workflow_events')
    .select('payload')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('completed_at', `${today}T00:00:00`)

  let timeSavedMin = 0
  const TIME_PER_ACTION = { intake: 5, classify: 3, docs: 8, pedimento: 15, crossing: 2 }
  for (const e of (events || [])) {
    timeSavedMin += TIME_PER_ACTION[e.workflow] || 3
  }

  return {
    launchpad: { completed, postponed },
    workflows: eventsByWorkflow,
    draftsCreated: draftsCreated || 0,
    docsReceived: docsReceived || 0,
    cruces: cruces || 0,
    timeSavedMin,
    totalEvents: (events || []).length,
  }
}

// ── Gather tomorrow's preview ────────────────────────────────────────────────

async function getTomorrowPreview(companyId) {
  const tomorrow = tomorrowCST()

  // Tráficos expected to arrive tomorrow
  const { data: arriving } = await supabase
    .from('traficos')
    .select('trafico, proveedor')
    .eq('company_id', companyId)
    .gte('fecha_llegada', `${tomorrow}T00:00:00`)
    .lte('fecha_llegada', `${tomorrow}T23:59:59`)
    .limit(10)

  // Tráficos scheduled to cross tomorrow
  const { data: crossing } = await supabase
    .from('traficos')
    .select('trafico, proveedor')
    .eq('company_id', companyId)
    .eq('estatus', 'Pedimento Pagado')
    .limit(10)

  // Pending drafts awaiting approval
  const { count: pendingDrafts } = await supabase
    .from('pedimento_drafts')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'draft'])

  // Pending document requests
  const { count: pendingDocs } = await supabase
    .from('documento_solicitudes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'solicitado')

  return {
    arriving: arriving || [],
    crossing: crossing || [],
    pendingDrafts: pendingDrafts || 0,
    pendingDocs: pendingDocs || 0,
  }
}

// ── Compose message ──────────────────────────────────────────────────────────

function composeDaySummary(stats, preview) {
  const lines = []

  lines.push('🦀 <b>Día completo.</b>')
  lines.push('')

  // Today's accomplishments
  if (stats.totalEvents > 0 || stats.launchpad.completed > 0) {
    if (stats.launchpad.completed > 0) lines.push(`✓ ${stats.launchpad.completed} acciones completadas en Launchpad`)
    if (stats.draftsCreated > 0) lines.push(`✓ ${stats.draftsCreated} borradores creados`)
    if (stats.docsReceived > 0) lines.push(`✓ ${stats.docsReceived} documentos recibidos`)
    if (stats.cruces > 0) lines.push(`✓ ${stats.cruces} cruces confirmados`)
    if (stats.workflows.intake) lines.push(`✓ ${stats.workflows.intake} correos procesados`)
    if (stats.workflows.classify) lines.push(`✓ ${stats.workflows.classify} clasificaciones`)
    if (stats.workflows.docs) lines.push(`✓ ${stats.workflows.docs} solicitudes procesadas`)
  } else {
    lines.push('Día tranquilo — sin operaciones nuevas.')
  }

  if (stats.timeSavedMin > 0) {
    const hours = Math.floor(stats.timeSavedMin / 60)
    const mins = stats.timeSavedMin % 60
    const timeStr = hours > 0 ? `${hours}h ${mins}min` : `${mins} minutos`
    lines.push(`\n⏱ CRUZ ahorró ~${timeStr} hoy`)
  }

  // Tomorrow preview
  lines.push('')
  lines.push('<b>Mañana:</b>')

  if (preview.arriving.length > 0) {
    const suppliers = [...new Set(preview.arriving.map(t => t.proveedor).filter(Boolean))]
    lines.push(`- ${preview.arriving.length} embarques esperados (${suppliers.slice(0, 3).join(', ')})`)
  }
  if (preview.crossing.length > 0) {
    lines.push(`- ${preview.crossing.length} cruces programados`)
  }
  if (preview.pendingDrafts > 0) {
    lines.push(`- ${preview.pendingDrafts} aprobaciones pendientes`)
  }
  if (preview.pendingDocs > 0) {
    lines.push(`- ${preview.pendingDocs} documentos por recibir`)
  }

  if (preview.arriving.length === 0 && preview.crossing.length === 0 && preview.pendingDrafts === 0) {
    lines.push('- Sin operaciones previstas. Día ligero.')
  }

  lines.push('')
  lines.push('Que tenga buena tarde. 🌅')
  lines.push('— CRUZ')

  return lines.join('\n')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nCRUZ End-of-Day Engine`)
  console.log(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}\n`)

  const companyId = process.env.DEFAULT_COMPANY_ID || 'evco'

  const stats = await getTodayStats(companyId)
  console.log('Today stats:', JSON.stringify(stats, null, 2))

  const preview = await getTomorrowPreview(companyId)
  console.log('Tomorrow preview:', JSON.stringify(preview, null, 2))

  const message = composeDaySummary(stats, preview)
  console.log('\n--- Message ---')
  console.log(message.replace(/<[^>]+>/g, ''))
  console.log('--- End ---\n')

  await sendTelegram(message)

  // Log to heartbeat
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: { stats, preview_counts: { arriving: preview.arriving.length, crossing: preview.crossing.length } },
  }).then(() => {}, () => {})

  // Log to pipeline_log
  await supabase.from('pipeline_log').insert({
    step: SCRIPT_NAME,
    status: 'completed',
    input_summary: `${todayCST()} summary`,
    output_summary: `${stats.totalEvents} events, ${stats.timeSavedMin}min saved`,
  }).then(() => {}, () => {})

  console.log('End-of-day message sent ✅')
}

run().catch(async err => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}`)
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME, status: 'failed',
    details: { error: err.message },
  }).then(() => {}, () => {})
  process.exit(1)
})
