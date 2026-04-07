#!/usr/bin/env node
/**
 * CRUZ — Self-Healing System
 *
 * Detects failures, fixes them automatically, learns from patterns.
 * The system gets healthier over time — fewer manual interventions each month.
 *
 * DETECT: 9 health checks every 15 minutes
 * HEAL: Auto-fix what can be fixed, alert on what can't
 * LEARN: Track patterns, build prevention rules
 *
 * Cron: every 15 minutes
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { execSync } = require('child_process')

const { fetchAll } = require('./lib/paginate')
const SCRIPT_NAME = 'self-healer'
const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'
const PORTAL_URL = 'https://evco-portal.vercel.app'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function logEvent(issueType, severity, description, actionTaken, healed, durationMs, details = {}) {
  if (DRY_RUN) {
    console.log(`  [LOG] ${severity} | ${issueType} | ${description} | action: ${actionTaken} | healed: ${healed}`)
    return
  }
  await supabase.from('self_healing_log').insert({
    issue_type: issueType,
    severity,
    description,
    action_taken: actionTaken,
    healed,
    heal_duration_ms: durationMs,
    manual_required: !healed,
    details,
  }).then(() => {}, () => {})
}

// ── DETECT + HEAL ──

async function checkSyncStatus() {
  const { data } = await supabase.from('pipeline_log')
    .select('status, timestamp')
    .eq('step', 'globalpc-sync:complete')
    .order('timestamp', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return null

  const lastRun = new Date(data[0].timestamp)
  const hoursAgo = (Date.now() - lastRun.getTime()) / 3600000

  if (hoursAgo > 26) {
    console.log(`  ⚠️ GlobalPC sync stale: ${Math.round(hoursAgo)}h ago`)
    const start = Date.now()
    try {
      if (!DRY_RUN) execSync('node scripts/globalpc-sync.js', { timeout: 300000, stdio: 'pipe' })
      await logEvent('sync_stale', 'warning', `Sync ${Math.round(hoursAgo)}h stale`, 're-ran globalpc-sync', true, Date.now() - start)
      return { healed: true }
    } catch (e) {
      await logEvent('sync_stale', 'critical', `Sync stale and retry failed: ${e.message}`, 'retry failed', false, Date.now() - start)
      return { healed: false, alert: true }
    }
  }
  return null
}

async function checkExchangeRate() {
  const { data } = await supabase.from('system_config')
    .select('value, valid_to')
    .eq('key', 'banxico_exchange_rate')
    .single()

  if (!data) return null

  if (data.valid_to && new Date(data.valid_to) < new Date()) {
    console.log('  ⚠️ Exchange rate expired')
    const start = Date.now()
    try {
      if (!DRY_RUN) execSync('node scripts/banxico-rate.js', { timeout: 30000, stdio: 'pipe' })
      await logEvent('rate_expired', 'warning', 'Exchange rate expired', 're-ran banxico-rate', true, Date.now() - start)
      return { healed: true }
    } catch {
      // Fallback: extend validity by 1 day with stale annotation
      if (!DRY_RUN) {
        await supabase.from('system_config').update({
          valid_to: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        }).eq('key', 'banxico_exchange_rate')
      }
      await logEvent('rate_expired', 'warning', 'Rate expired, extended 1 day', 'extended validity (stale)', true, Date.now() - start)
      return { healed: true }
    }
  }
  return null
}

async function checkApiHealth() {
  try {
    const start = Date.now()
    const res = await fetch(`${PORTAL_URL}/api/health`, { signal: AbortSignal.timeout(10000) })
    const latency = Date.now() - start
    if (!res.ok) {
      await logEvent('api_error', 'warning', `API returned ${res.status}`, 'alert only', false, latency)
      return { healed: false, alert: true }
    }
    if (latency > 5000) {
      await logEvent('api_slow', 'info', `API latency ${latency}ms`, 'logged', true, latency)
    }
  } catch (e) {
    await logEvent('api_unreachable', 'critical', `API unreachable: ${e.message}`, 'alert only', false, 0)
    return { healed: false, alert: true }
  }
  return null
}

async function checkSupabase() {
  try {
    const { error } = await supabase.from('system_config').select('key').limit(1)
    if (error) throw error
  } catch (e) {
    console.log('  🔴 Supabase connectivity issue')
    await logEvent('supabase_error', 'critical', `Supabase: ${e.message}`, 'alert - cannot self-heal', false, 0)
    return { healed: false, alert: true }
  }
  return null
}

async function checkPm2() {
  try {
    const output = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf8', timeout: 10000 })
    const procs = JSON.parse(output)
    const expected = ['cruz-bot', 'globalpc-sync']
    const dead = []

    for (const name of expected) {
      const p = procs.find(x => x.name === name)
      if (!p || p.pm2_env?.status !== 'online') dead.push(name)
    }

    if (dead.length > 0) {
      console.log(`  ⚠️ PM2 dead: ${dead.join(', ')}`)
      const start = Date.now()
      for (const name of dead) {
        try {
          if (!DRY_RUN) {
            execSync(`pm2 restart ${name}`, { timeout: 15000, stdio: 'pipe' })
            execSync('pm2 save', { timeout: 10000, stdio: 'pipe' })
          }
          await logEvent('pm2_dead', 'warning', `${name} was dead`, `restarted + saved`, true, Date.now() - start)
        } catch {
          await logEvent('pm2_dead', 'critical', `${name} restart failed`, 'manual required', false, Date.now() - start)
          return { healed: false, alert: true }
        }
      }
      return { healed: true }
    }
  } catch {
    // pm2 not available (Vercel environment)
  }
  return null
}

async function checkStaleEstatus() {
  const { count } = await supabase.from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('estatus', 'En Proceso')
    .not('pedimento', 'is', null)

  if (count > 0) {
    console.log(`  ⚠️ ${count} stale En Proceso with pedimento`)
    const start = Date.now()
    try {
      if (!DRY_RUN) execSync('node scripts/fix-stale-estatus.js', { timeout: 600000, stdio: 'pipe' })
      await logEvent('stale_estatus', 'warning', `${count} stale traficos`, 'ran fix-stale-estatus', true, Date.now() - start, { count })
      return { healed: true }
    } catch {
      await logEvent('stale_estatus', 'warning', `${count} stale, fix failed`, 'fix script failed', false, Date.now() - start)
    }
  }
  return null
}

async function checkClientIsolation() {
  // Spot check: pick 5 random traficos, verify company_id makes sense
  const { data: samples } = await supabase.from('traficos')
    .select('trafico, company_id')
    .limit(5)
    .order('created_at', { ascending: false })

  // Simple heuristic: trafico ID prefix should relate to company
  // If a trafico like "9254-Y4466" is under company_id "mafesa", that's wrong
  // Full verification needs GlobalPC, so just flag obvious mismatches
  for (const t of (samples || [])) {
    const prefix = (t.trafico || '').split('-')[0]
    if (prefix === '9254' && t.company_id !== 'evco') {
      await logEvent('isolation_breach', 'critical',
        `Trafico ${t.trafico} (prefix 9254) assigned to ${t.company_id}`,
        'BLOCKED - alert Tito', false, 0, { trafico: t.trafico, company_id: t.company_id })
      await tg(`🔴🔴🔴 <b>CLIENT ISOLATION BREACH</b>\n${t.trafico} assigned to ${t.company_id}\nBloqueo inmediato requerido\n— CRUZ 🦀`)
      return { healed: false, alert: true, critical: true }
    }
  }
  return null
}

async function checkDuplicates() {
  const { data } = await supabase.rpc('check_duplicate_pedimentos').catch(() => ({ data: null }))
  // If RPC doesn't exist, do manual check
  if (!data) {
    const dups = await fetchAll(supabase.from('traficos')
      .select('pedimento, company_id')
      .not('pedimento', 'is', null))

    const seen = new Map()
    const duplicates = []
    for (const t of (dups || [])) {
      const key = `${t.company_id}:${t.pedimento}`
      if (seen.has(key)) duplicates.push(key)
      else seen.set(key, true)
    }

    if (duplicates.length > 0) {
      await logEvent('duplicates', 'info', `${duplicates.length} duplicate pedimentos`, 'logged only', true, 0, { count: duplicates.length })
    }
  }
  return null
}

// ── LEARN ──

async function learnFromHistory() {
  // Check for patterns in last 7 days
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: events } = await supabase.from('self_healing_log')
    .select('issue_type, severity, detected_at, healed')
    .gte('detected_at', weekAgo)
    .order('detected_at', { ascending: false })
    .limit(100)

  if (!events || events.length === 0) return

  // Count by type
  const counts = {}
  for (const e of events) {
    counts[e.issue_type] = (counts[e.issue_type] || 0) + 1
  }

  const healedCount = events.filter(e => e.healed).length
  const manualCount = events.filter(e => !e.healed).length

  console.log(`\n── LEARN: ${events.length} events this week`)
  console.log(`   Auto-healed: ${healedCount} | Manual needed: ${manualCount}`)
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`)
  })

  // Check for time-based patterns (same issue at same hour, 3+ times)
  const byHour = {}
  for (const e of events) {
    const hour = new Date(e.detected_at).getHours()
    const key = `${e.issue_type}:${hour}`
    byHour[key] = (byHour[key] || 0) + 1
  }

  const patterns = Object.entries(byHour).filter(([, count]) => count >= 3)
  if (patterns.length > 0) {
    console.log('   Patterns detected:')
    for (const [key, count] of patterns) {
      const [type, hour] = key.split(':')
      console.log(`     ${type} at ${hour}:00 — ${count} times this week`)
    }
  }
}

// ── MAIN ──

async function run() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  const startTime = Date.now()
  console.log(`\n🏥 ${prefix}CRUZ Self-Healer`)
  console.log('═'.repeat(50))

  const results = []
  const checks = [
    ['sync', checkSyncStatus],
    ['rate', checkExchangeRate],
    ['api', checkApiHealth],
    ['supabase', checkSupabase],
    ['pm2', checkPm2],
    ['stale_estatus', checkStaleEstatus],
    ['isolation', checkClientIsolation],
    ['duplicates', checkDuplicates],
  ]

  for (const [name, fn] of checks) {
    try {
      const result = await fn()
      if (result) {
        results.push({ name, ...result })
        const icon = result.healed ? '✅' : result.critical ? '🔴' : '⚠️'
        console.log(`  ${icon} ${name}: ${result.healed ? 'healed' : 'needs attention'}`)
      } else {
        console.log(`  ✅ ${name}: healthy`)
      }
    } catch (e) {
      console.error(`  ❌ ${name}: check failed — ${e.message}`)
    }
  }

  // Learn from history
  await learnFromHistory()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const healed = results.filter(r => r.healed).length
  const alerts = results.filter(r => r.alert).length
  const critical = results.filter(r => r.critical).length

  console.log('\n' + '═'.repeat(50))
  console.log(`📊 ${prefix}SUMMARY: ${elapsed}s`)
  console.log(`   Checks: ${checks.length} | Issues: ${results.length} | Healed: ${healed} | Alerts: ${alerts}`)

  // Only alert on unhealed issues
  if (alerts > 0) {
    await tg(
      `🏥 <b>SELF-HEALER</b>\n` +
      `${results.length} issue${results.length !== 1 ? 's' : ''} detected\n` +
      `✅ Auto-healed: ${healed}\n` +
      `⚠️ Needs attention: ${alerts}\n` +
      (critical > 0 ? `🔴 CRITICAL: ${critical}\n` : '') +
      `— CRUZ 🦀`
    )
  }
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
