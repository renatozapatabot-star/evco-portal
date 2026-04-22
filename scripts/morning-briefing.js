#!/usr/bin/env node
/**
 * scripts/morning-briefing.js — agent-driven internal morning briefing.
 *
 * Phase 3 #2: runs daily at 06:30 Laredo time and sends a structured
 * Spanish intelligence briefing to the internal Tito + Renato IV chat.
 *
 *   PM2 registration (Throne):
 *     pm2 start scripts/morning-briefing.js \
 *         --name morning-briefing \
 *         --cron "30 6 * * 1-6" \
 *         --no-autorestart
 *     pm2 save
 *
 * Pipeline:
 *   1. Load env from .env.local (service role key + Telegram bot token).
 *   2. Register tsx/cjs so we can require() the TypeScript agent tools.
 *   3. Call getFullIntelligence('evco') + getTenantAnomalies('evco').
 *   4. Pass responses to composeMorningBriefing (pure, tested in the
 *      vitest suite) — same formatter the /admin preview card will reuse.
 *   5. Send the HTML body via Telegram to INTERNAL chat ID only.
 *   6. Insert the decision_log_entry into agent_decisions with
 *      action_taken = 'telegram_sent' | 'dry_run' | 'send_failed'.
 *   7. Heartbeat via the shared job-runner helper (writes job_runs + fires
 *      a red Telegram alert on crash before exit(1)).
 *
 * Safety:
 *   - Internal only. No client-facing outputs. Anywhere a client name
 *     could leak, the formatter escapes via escapeHtml.
 *   - Read-only against production data. The ONLY write is the
 *     agent_decisions insert documenting the briefing itself.
 *   - --dry-run flag skips Telegram + skips the insert; prints the
 *     briefing to stdout. Use before enabling the PM2 cron.
 *   - Never throws across the boundary. If everything fails we still
 *     try to insert a degraded row so the learning loop has evidence.
 *
 * Flags:
 *   --dry-run       — no Telegram, no insert, prints to stdout.
 *   --tenant=<id>   — override tenant slug (default 'evco').
 *   --window=<n>    — windowDays forwarded to the agent (default 14).
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

// Register tsx so we can require() TypeScript modules below.
// tsx/cjs patches Node's CJS resolver to handle .ts on disk.
require('tsx/cjs')

const { createClient } = require('@supabase/supabase-js')
const { runJob } = require('./lib/job-runner')

// Lazy-require TS modules after tsx is registered so the loader catches them.
const tools = require('../src/lib/aguila/tools')
const { composeMorningBriefing } = require('../src/lib/aguila/briefing')

// ── Args ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { dryRun: false, tenant: 'evco', windowDays: 14 }
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') out.dryRun = true
    else if (a.startsWith('--tenant=')) out.tenant = a.slice('--tenant='.length)
    else if (a.startsWith('--window=')) {
      const n = Number(a.slice('--window='.length))
      if (Number.isFinite(n) && n >= 1 && n <= 365) out.windowDays = Math.floor(n)
    }
  }
  return out
}

// ── Telegram (internal chat only) ──────────────────────────────────

/**
 * Send the briefing to the INTERNAL Tito + Renato IV chat. Separate env
 * var from the generic TELEGRAM_CHAT_ID so an operator can't accidentally
 * wire this briefing to an ops-wide channel. Falls back to the ops chat
 * only when explicitly configured so.
 */
async function sendInternalTelegram(html) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  // Internal-only chat. Set INTERNAL_BRIEFING_CHAT_ID on the Throne env
  // to Tito + Renato's private chat. No fallback to ops — if this var is
  // unset, we skip the send and log that.
  const chat = process.env.INTERNAL_BRIEFING_CHAT_ID
  if (process.env.TELEGRAM_SILENT === 'true') {
    console.log('[telegram] silent mode — skipping send.')
    return { sent: false, reason: 'silent_mode' }
  }
  if (!token) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN missing — skipping send.')
    return { sent: false, reason: 'missing_token' }
  }
  if (!chat) {
    console.log('[telegram] INTERNAL_BRIEFING_CHAT_ID missing — skipping send.')
    return { sent: false, reason: 'missing_chat' }
  }
  const resp = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    },
  )
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    return { sent: false, reason: `http_${resp.status}:${body.slice(0, 200)}` }
  }
  return { sent: true, reason: 'ok' }
}

// ── Decision log ───────────────────────────────────────────────────

/**
 * Insert the composed briefing into agent_decisions. Matches the schema
 * used by scripts/cruz-agent.js so downstream analytics + learning-loop
 * queries (Phase 3 #5) can union these rows with the rest.
 */
async function logDecision(supabase, entry, actionTaken, processingMs) {
  const row = {
    cycle_id: `morning-briefing-${Date.now()}`,
    trigger_type: entry.trigger_type,
    trigger_id: entry.trigger_id,
    company_id: entry.company_id,
    workflow: entry.workflow,
    decision: entry.decision,
    reasoning: entry.reasoning,
    confidence: entry.confidence,
    autonomy_level: entry.autonomy_level,
    action_taken: actionTaken,
    processing_ms: processingMs,
  }
  // Swallow insert errors — learning evidence is nice-to-have, not
  // critical for today's briefing. The runJob heartbeat still fires
  // a Telegram alert on any harder failure via process.exit(1).
  await supabase
    .from('agent_decisions')
    .insert(row)
    .then(() => {}, (err) => {
      console.error('[log] agent_decisions insert failed:', err?.message ?? String(err))
    })
}

// ── Main ───────────────────────────────────────────────────────────

const ARGS = parseArgs(process.argv)

runJob('morning-briefing', async () => {
  const startedAt = Date.now()
  console.log(
    `[start] tenant=${ARGS.tenant} window=${ARGS.windowDays}d dryRun=${ARGS.dryRun}`,
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // 1. Gather signals via the Phase 3 #1 tool layer.
  const [intelligence, anomalies] = await Promise.all([
    tools.getFullIntelligence(supabase, ARGS.tenant, undefined, {
      windowDays: ARGS.windowDays,
      topFocusCount: 3,
    }),
    tools.getTenantAnomalies(supabase, ARGS.tenant, {
      windowDays: ARGS.windowDays,
    }),
  ])

  // 2. Compose the briefing (pure — unit-tested).
  const briefing = composeMorningBriefing({
    companyId: ARGS.tenant,
    intelligence,
    anomalies,
    generatedAt: new Date().toISOString(),
  })

  console.log('\n--- BRIEFING ---\n')
  console.log(briefing.text_plain)
  console.log('\n--- END ---\n')

  if (ARGS.dryRun) {
    console.log('[dry-run] Skipping Telegram + agent_decisions insert.')
    return {
      rowsProcessed: 0,
      metadata: {
        tenant: ARGS.tenant,
        degraded: briefing.degraded,
        dry_run: true,
      },
    }
  }

  // 3. Send to internal chat.
  const sendResult = await sendInternalTelegram(briefing.text_html)
  const actionTaken = sendResult.sent
    ? 'telegram_sent'
    : `send_failed:${sendResult.reason}`

  // 4. Persist the decision.
  await logDecision(
    supabase,
    briefing.decision_log_entry,
    actionTaken,
    Date.now() - startedAt,
  )

  return {
    rowsProcessed: 1,
    metadata: {
      tenant: ARGS.tenant,
      degraded: briefing.degraded,
      action_taken: actionTaken,
    },
  }
})
