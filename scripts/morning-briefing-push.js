#!/usr/bin/env node
// scripts/morning-briefing-push.js
// ============================================================================
// CRUZ Morning Briefing Push Notification
//
// Sends "Tu día está listo" push notification to portal users at 8 AM.
// Counts pending actions and estimates total time needed.
//
// Cron: 0 8 * * 1-6  (8 AM Mon-Sat CST)
// Separate from morning-report.js (6:55 AM Telegram for Tito).
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const { sendPushToCompany } = require('./lib/push-sender')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'morning-briefing-push'
const DRY_RUN = process.argv.includes('--dry-run')

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

// Time estimates per action type (minutes)
const TIME_PER_ACTION = {
  pending_draft: 3,
  missing_doc: 5,
  approaching_deadline: 4,
}

async function countActions(companyId) {
  const [draftsRes, docsRes] = await Promise.all([
    // Pending drafts awaiting approval
    supabase
      .from('pedimento_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['draft', 'pending']),

    // Missing/overdue documents
    supabase
      .from('documento_solicitudes')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'solicitado'),
  ])

  const pendingDrafts = draftsRes.count ?? 0
  const missingDocs = docsRes.count ?? 0
  const totalActions = pendingDrafts + missingDocs
  const totalMinutes = (pendingDrafts * TIME_PER_ACTION.pending_draft) +
    (missingDocs * TIME_PER_ACTION.missing_doc)

  return { totalActions, totalMinutes, pendingDrafts, missingDocs }
}

async function main() {
  console.log(`[start] Morning briefing push${DRY_RUN ? ' (dry run)' : ''}`)

  // Get all companies with push subscriptions
  const { data: companies } = await supabase
    .from('push_subscriptions')
    .select('company_id')
    .limit(100)

  if (!companies?.length) {
    console.log('[skip] No push subscriptions found')
    return
  }

  // Deduplicate company IDs
  const companyIds = [...new Set(companies.map(c => c.company_id))]

  for (const companyId of companyIds) {
    const { totalActions, totalMinutes } = await countActions(companyId)

    if (totalActions === 0) {
      console.log(`[skip] ${companyId}: no pending actions`)
      continue
    }

    const payload = {
      title: 'CRUZ — Tu día está listo',
      body: `${totalActions} accion${totalActions !== 1 ? 'es' : ''} (~${totalMinutes} minutos).`,
      url: '/inicio',
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${companyId}:`, JSON.stringify(payload))
      continue
    }

    await sendPushToCompany(companyId, payload)
    console.log(`[sent] ${companyId}: ${totalActions} actions, ~${totalMinutes} min`)
  }

  console.log('[done] Morning briefing complete')
}

main().catch(async (err) => {
  console.error(`[fatal] ${SCRIPT_NAME}: ${err.message}`)
  await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${err.message}`)
  process.exit(1)
})
