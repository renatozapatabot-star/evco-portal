#!/usr/bin/env node
/**
 * agent-actions-reaper — sweep abandoned `proposed` agent_actions.
 *
 * Cron: `0 3 * * *` (03:00 CST, after the main nightly batch at 01:00
 *       and pipeline-postmortem at 02:00 — this is bookkeeping, not
 *       load-bearing, so it runs when the host is quiet).
 *
 * Problem this solves
 * -------------------
 * `agent_actions` encodes the 5-second cancel window via
 * `commit_deadline_at`. In the happy path, the UI fires
 * `POST /api/cruz-ai/actions/commit` when the deadline passes without
 * a Cancel click. But if the user closes the tab, loses network, or
 * reloads mid-countdown, the row can sit at `status='proposed'`
 * forever — no terminal state, no audit close.
 *
 * Policy (why cancel, not commit)
 * --------------------------------
 * CLAUDE.md: "CRUZ proposes. Humans authorize. This boundary is
 * permanent." `committed` semantically means "user authorized". A
 * row the user never explicitly approved — or allowed to pass the
 * 5-second window while the UI was visible — must NOT be upgraded
 * to committed by a nightly sweep. That would silently cross the
 * approval gate.
 *
 * Correct reap policy: flip abandoned rows to `cancelled` with a
 * machine reason so the audit trail reflects reality (user walked
 * away, not "broker cancelled on user's behalf"). Downstream effect
 * executors (future cron that reads `committed` rows) never see these.
 *
 * Grace window
 * ------------
 * The live commit path explicitly tolerates late commits:
 *   > Deadline: commit accepts transition even after the deadline has
 *   > passed — a user with slow network should not lose their work.
 * So the reaper only sweeps rows where the deadline is past by
 * GRACE_MINUTES (default 10 min). Anything more recent could still
 * be a slow-network user mid-commit. 10 min > 5-sec window by 120×.
 *
 * Output
 * ------
 *   - heartbeat_log row (success even on zero-reap — silence is not OK)
 *   - Telegram alert when rows reaped > REAP_TELEGRAM_THRESHOLD (20),
 *     quiet on normal sweeps to avoid noise
 *   - Hard Telegram alert + exit 1 on query/update failure
 *
 * Flags
 *   --dry-run  print the plan, do not update
 *   --verbose  log every reaped row id
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { sendTelegram } = require('./lib/telegram')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')
const SCRIPT_NAME = 'agent-actions-reaper'

const GRACE_MINUTES = 10
const REAP_TELEGRAM_THRESHOLD = 20
const CANCEL_REASON_ES = 'Ventana de confirmación expirada — acción abandonada.'

async function main() {
  const startedAt = new Date()
  const cutoffIso = new Date(startedAt.getTime() - GRACE_MINUTES * 60_000).toISOString()
  console.log(
    `🪓 ${SCRIPT_NAME} — ${DRY_RUN ? 'DRY RUN' : 'LIVE'} @ ${startedAt.toISOString()}\n` +
    `   cutoff (deadline before): ${cutoffIso} (grace ${GRACE_MINUTES} min)`,
  )

  const { data: candidates, error: readErr } = await supabase
    .from('agent_actions')
    .select('id, company_id, kind, summary_es, commit_deadline_at, created_at')
    .eq('status', 'proposed')
    .lt('commit_deadline_at', cutoffIso)
    .order('commit_deadline_at', { ascending: true })
    .limit(5000)

  if (readErr) {
    const msg = `🔴 <b>${SCRIPT_NAME}</b> query failed: ${readErr.message}`
    console.error(msg)
    await sendTelegram(msg)
    process.exit(1)
  }

  const rows = candidates || []
  const byKind = {}
  const byCompany = {}
  for (const r of rows) {
    byKind[r.kind] = (byKind[r.kind] || 0) + 1
    byCompany[r.company_id] = (byCompany[r.company_id] || 0) + 1
  }

  console.log(`   candidates: ${rows.length}`)
  if (VERBOSE && rows.length > 0) {
    console.log('   --- rows ---')
    for (const r of rows) {
      console.log(
        `   • ${r.id}  kind=${r.kind.padEnd(28)} company=${String(r.company_id).padEnd(16)} ` +
        `deadline=${r.commit_deadline_at}`,
      )
    }
  }

  if (rows.length === 0) {
    if (!DRY_RUN) {
      await supabase.from('heartbeat_log').insert({
        script: SCRIPT_NAME,
        status: 'success',
        details: { reaped: 0, cutoff_iso: cutoffIso, grace_minutes: GRACE_MINUTES },
      }).catch((e) => {
        console.warn(`[heartbeat skip] ${e?.message || e}`)
      })
    }
    console.log('✅ nothing to reap.')
    return
  }

  if (DRY_RUN) {
    console.log('🟡 dry-run — no rows updated.')
    console.log(`   by kind:    ${JSON.stringify(byKind)}`)
    console.log(`   by company: ${JSON.stringify(byCompany)}`)
    return
  }

  // Single bulk update — filter on status='proposed' defends against a
  // racing late-commit landing between our read and write (the row's
  // status flipped; our update becomes a no-op for that id).
  const { data: updated, error: updateErr } = await supabase
    .from('agent_actions')
    .update({
      status: 'cancelled',
      cancelled_at: startedAt.toISOString(),
      cancel_reason_es: CANCEL_REASON_ES,
    })
    .eq('status', 'proposed')
    .lt('commit_deadline_at', cutoffIso)
    .select('id')

  if (updateErr) {
    const msg = `🔴 <b>${SCRIPT_NAME}</b> update failed: ${updateErr.message}`
    console.error(msg)
    await sendTelegram(msg)
    process.exit(1)
  }

  const reapedCount = (updated || []).length
  console.log(`✅ reaped ${reapedCount} row(s).`)
  console.log(`   by kind:    ${JSON.stringify(byKind)}`)
  console.log(`   by company: ${JSON.stringify(byCompany)}`)

  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: {
      reaped: reapedCount,
      candidates: rows.length,
      cutoff_iso: cutoffIso,
      grace_minutes: GRACE_MINUTES,
      by_kind: byKind,
      by_company: byCompany,
    },
  }).catch((e) => {
    console.warn(`[heartbeat skip] ${e?.message || e}`)
  })

  // Quiet on normal sweeps. Loud when the backlog spikes — signals
  // either a UI regression (commit endpoint not firing) or a network
  // outage during heavy CRUZ AI usage.
  if (reapedCount >= REAP_TELEGRAM_THRESHOLD) {
    const kindSummary = Object.entries(byKind)
      .map(([k, n]) => `${k}=${n}`)
      .join(', ')
    await sendTelegram(
      `🟡 <b>${SCRIPT_NAME}</b> reaped ${reapedCount} abandoned acciones.\n` +
      `Cutoff: ${cutoffIso}\n` +
      `Por tipo: <code>${kindSummary}</code>\n` +
      `<i>Si este número crece, revisar /api/cruz-ai/actions/commit en el cliente.</i>`,
    )
  }
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME}</b> fatal: ${err.message}`)
  process.exit(1)
})
