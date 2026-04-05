#!/usr/bin/env node

// ============================================================
// CRUZ Shadow Weekly Report
// Queries shadow_classifications + staff_corrections from last 7 days
// Sends formatted intelligence summary to Telegram
// Run: node scripts/shadow-weekly-report.js
// Cron: 0 20 * * 0 (Sunday 8 PM)
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'shadow-weekly-report'

// ── Telegram ────────────────────────────────────
async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) { console.log('[TG skip]', msg.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT,
        text: msg,
        parse_mode: 'HTML',
      }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

// ── Main ────────────────────────────────────────
async function main() {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const today = new Date().toLocaleDateString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short', year: 'numeric',
  })

  console.log(`📊 CRUZ Shadow Weekly Report — ${today}`)

  // 1. Fetch classifications from last 7 days
  const { data: classifications, error: classErr } = await supabase
    .from('shadow_classifications')
    .select('classification, confidence, staff_action, accuracy, created_at')
    .gte('created_at', weekAgo)

  if (classErr) {
    console.error('Error fetching classifications:', classErr.message)
    await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${classErr.message}`)
    process.exit(1)
  }

  const total = classifications?.length || 0

  // 2. Classification distribution
  const typeCounts = {}
  let totalConfidence = 0
  let matchedCount = 0
  let accuracySum = 0
  let accuracyCount = 0

  for (const c of (classifications || [])) {
    typeCounts[c.classification] = (typeCounts[c.classification] || 0) + 1
    totalConfidence += (c.confidence || 0)

    if (c.staff_action) matchedCount++
    if (c.accuracy != null) {
      accuracySum += c.accuracy
      accuracyCount++
    }
  }

  const avgConfidence = total > 0 ? (totalConfidence / total * 100).toFixed(0) : 0
  const agreementRate = accuracyCount > 0
    ? (accuracySum / accuracyCount * 100).toFixed(0)
    : 'N/A'

  // Sort types by count
  const sortedTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // 3. Fetch staff corrections from last 7 days
  const { data: corrections } = await supabase
    .from('staff_corrections')
    .select('correction_type, original_value, corrected_value, corrected_by')
    .gte('created_at', weekAgo)

  const correctionCount = corrections?.length || 0

  // Top correction patterns
  const correctionPatterns = {}
  for (const c of (corrections || [])) {
    const key = `${c.correction_type}: ${c.original_value} → ${c.corrected_value}`
    correctionPatterns[key] = (correctionPatterns[key] || 0) + 1
  }
  const topCorrections = Object.entries(correctionPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // 4. Build Telegram report
  const typeLines = sortedTypes
    .map(([type, count]) => `  • ${type}: <b>${count}</b>`)
    .join('\n')

  const correctionLines = topCorrections.length > 0
    ? topCorrections.map(([pattern, count]) => `  • ${pattern} (×${count})`).join('\n')
    : '  Sin correcciones esta semana'

  const report = `🦀 <b>CRUZ Shadow Mode — Reporte Semanal</b>
📅 Semana terminando ${today}

📧 <b>Clasificaciones:</b> ${total}
🎯 <b>Confianza promedio:</b> ${avgConfidence}%
✅ <b>Coincidencia con staff:</b> ${agreementRate}${agreementRate !== 'N/A' ? '%' : ''}
👀 <b>Matcheados con acción:</b> ${matchedCount} de ${total}

📊 <b>Top clasificaciones:</b>
${typeLines || '  Sin datos'}

🔧 <b>Correcciones (${correctionCount}):</b>
${correctionLines}

<i>Shadow Mode — observando sin intervenir</i>
<i>Patente 3596 · Aduana 240</i>`

  console.log(report.replace(/<[^>]+>/g, ''))

  await sendTelegram(report)

  // Log run
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: {
      total_classifications: total,
      avg_confidence: avgConfidence,
      agreement_rate: agreementRate,
      corrections: correctionCount,
    },
  }).then(() => {}, () => {})

  console.log('\n✅ Report sent to Telegram')
  process.exit(0)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${err.message}`)
  process.exit(1)
})
