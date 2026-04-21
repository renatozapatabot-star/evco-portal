#!/usr/bin/env node

// ============================================================
// CRUZ Daily Performance Aggregation
// Computes per-company daily metrics and streaks.
// Upserts into daily_performance table for dashboard cards.
// Run: node scripts/daily-performance.js [--dry-run]
// Cron: 0 3 * * * (daily at 3 AM CT)
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'daily-performance'
const DRY_RUN = process.argv.includes('--dry-run')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5085543275'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function sendTelegram(message) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[Telegram suppressed]', message)
    return
  }
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
      }
    )
    if (!resp.ok) console.error(`Telegram HTTP ${resp.status}`)
  } catch (err) {
    console.error('Telegram failed:', err.message)
  }
}

async function getCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('company_id, name')
  if (error) throw new Error(`Failed to fetch companies: ${error.message}`)
  return data || []
}

async function computeForCompany(companyId, today) {
  // Count actions completed today (traficos updated/created today)
  const { count: actionsCompleted } = await supabase
    .from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('updated_at', `${today}T00:00:00`)
    .lt('updated_at', `${today}T23:59:59`)

  // Last action timestamp
  const { data: lastAction } = await supabase
    .from('traficos')
    .select('updated_at')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  // Crossings today (status contains 'cruz')
  const { count: crossingsToday } = await supabase
    .from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .ilike('estatus', '%cruz%')
    .gte('fecha_cruce', `${today}T00:00:00`)
    .lt('fecha_cruce', `${today}T23:59:59`)

  // Docs processed today
  const { count: docsProcessed } = await supabase
    .from('expediente_documentos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`)

  // Compute streak: consecutive days with at least 1 action
  const { data: recentDays } = await supabase
    .from('daily_performance')
    .select('date, actions_completed')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .limit(90)

  let streakDays = 0
  if (recentDays && recentDays.length > 0) {
    // Walk backwards from yesterday
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    let checkDate = yesterday.toISOString().split('T')[0]

    for (const row of recentDays) {
      if (row.date === checkDate && row.actions_completed > 0) {
        streakDays++
        const prev = new Date(checkDate)
        prev.setDate(prev.getDate() - 1)
        checkDate = prev.toISOString().split('T')[0]
      } else {
        break
      }
    }
  }
  // If today has actions, add today to the streak
  if ((actionsCompleted || 0) > 0) {
    streakDays++
  }

  // Get previous streak record
  const { data: prevRecord } = await supabase
    .from('daily_performance')
    .select('streak_record')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  const prevStreakRecord = prevRecord?.streak_record || 0
  const streakRecord = Math.max(streakDays, prevStreakRecord)

  return {
    company_id: companyId,
    date: today,
    actions_completed: actionsCompleted || 0,
    last_action_at: lastAction?.updated_at || null,
    streak_days: streakDays,
    streak_record: streakRecord,
    crossings_today: crossingsToday || 0,
    docs_processed: docsProcessed || 0,
    avg_action_minutes: null, // future: compute from action timestamps
    computed_at: new Date().toISOString(),
  }
}

async function main() {
  console.log(`\n🔥 CRUZ Daily Performance ${DRY_RUN ? '(DRY RUN)' : ''}\n`)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  console.log(`Date: ${today}\n`)

  const companies = await getCompanies()
  console.log(`Companies: ${companies.length}\n`)

  const results = []

  for (const company of companies) {
    try {
      const metrics = await computeForCompany(company.company_id, today)
      results.push(metrics)

      console.log(`  ${company.name} (${company.company_id}):`)
      console.log(`    Actions: ${metrics.actions_completed}`)
      console.log(`    Crossings: ${metrics.crossings_today}`)
      console.log(`    Docs: ${metrics.docs_processed}`)
      console.log(`    Streak: ${metrics.streak_days}d (record: ${metrics.streak_record}d)`)
      console.log()
    } catch (err) {
      console.error(`  ❌ ${company.name}: ${err.message}`)
    }
  }

  if (DRY_RUN) {
    console.log('DRY RUN — no data written.\n')
    return
  }

  // Upsert all results
  const { error } = await supabase
    .from('daily_performance')
    .upsert(results, { onConflict: 'company_id,date' })

  if (error) {
    await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${error.message}`)
    throw new Error(`Upsert failed: ${error.message}`)
  }

  const summary = results.map(r =>
    `${r.company_id}: ${r.actions_completed} actions, ${r.streak_days}d streak`
  ).join('\n')

  console.log('✅ Daily performance saved.\n')
  await sendTelegram(`✅ Daily performance computed\n${summary}`)
}

main().catch(async (err) => {
  console.error('FATAL:', err.message)
  await sendTelegram(`🔴 ${SCRIPT_NAME} FATAL: ${err.message}`)
  process.exit(1)
})
