#!/usr/bin/env node

// ============================================================
// CRUZ Weekly Performance Summary
// Aggregates the week's daily_performance into a Telegram report.
// Run: node scripts/weekly-summary.js [--dry-run]
// Cron: 0 8 * * 1 (Monday 8 AM CT)
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'weekly-summary'
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

async function main() {
  console.log(`\n📊 CRUZ Weekly Summary ${DRY_RUN ? '(DRY RUN)' : ''}\n`)

  // Last 7 days
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const fromDate = weekAgo.toISOString().split('T')[0]
  const toDate = today.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  console.log(`Period: ${fromDate} → ${toDate}\n`)

  const { data: rows, error } = await supabase
    .from('daily_performance')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('company_id')
    .order('date', { ascending: false })

  if (error) {
    await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${error.message}`)
    throw new Error(error.message)
  }

  if (!rows || rows.length === 0) {
    console.log('No data for this period.\n')
    await sendTelegram(`📊 Weekly summary: no performance data for ${fromDate} → ${toDate}`)
    return
  }

  // Group by company
  const byCompany = {}
  for (const row of rows) {
    if (!byCompany[row.company_id]) byCompany[row.company_id] = []
    byCompany[row.company_id].push(row)
  }

  const lines = ['<b>📊 CRUZ Resumen Semanal</b>', `${fromDate} → ${toDate}`, '']

  const rankings = []

  for (const [companyId, days] of Object.entries(byCompany)) {
    const totalActions = days.reduce((s, d) => s + (d.actions_completed || 0), 0)
    const totalCrossings = days.reduce((s, d) => s + (d.crossings_today || 0), 0)
    const totalDocs = days.reduce((s, d) => s + (d.docs_processed || 0), 0)
    const activeDays = days.filter(d => d.actions_completed > 0).length
    const currentStreak = days[0]?.streak_days || 0
    const streakRecord = Math.max(...days.map(d => d.streak_record || 0))

    rankings.push({ companyId, totalActions, currentStreak })

    lines.push(`<b>${companyId.toUpperCase()}</b>`)
    lines.push(`  Acciones: ${totalActions} (${activeDays} días activos)`)
    lines.push(`  Cruces: ${totalCrossings}`)
    lines.push(`  Documentos: ${totalDocs}`)
    lines.push(`  Racha actual: ${currentStreak}d (récord: ${streakRecord}d)`)
    lines.push('')

    console.log(`${companyId}: ${totalActions} actions, ${totalCrossings} crossings, ${currentStreak}d streak`)
  }

  // Rankings
  if (rankings.length > 1) {
    rankings.sort((a, b) => b.totalActions - a.totalActions)
    lines.push('<b>🏆 Ranking por acciones</b>')
    rankings.forEach((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
      lines.push(`  ${medal} ${r.companyId}: ${r.totalActions}`)
    })
    lines.push('')

    // Streak ranking
    rankings.sort((a, b) => b.currentStreak - a.currentStreak)
    lines.push('<b>🔥 Ranking por racha</b>')
    rankings.forEach((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
      lines.push(`  ${medal} ${r.companyId}: ${r.currentStreak}d`)
    })
  }

  const report = lines.join('\n')
  console.log('\n' + report + '\n')

  if (!DRY_RUN) {
    await sendTelegram(report)
    console.log('✅ Weekly summary sent to Telegram.\n')
  } else {
    console.log('DRY RUN — Telegram not sent.\n')
  }
}

main().catch(async (err) => {
  console.error('FATAL:', err.message)
  await sendTelegram(`🔴 ${SCRIPT_NAME} FATAL: ${err.message}`)
  process.exit(1)
})
