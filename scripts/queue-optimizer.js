#!/usr/bin/env node

// ============================================================
// CRUZ Queue Optimizer — smart processing order for tráficos
// Scores pending work by urgency × efficiency × risk.
// Cron: 0 7 * * 1-6 (weekdays 7 AM — before Juan José starts)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

function scorePriority(t, docsComplete) {
  let score = 0
  const reasons = []

  // URGENCY (max 40)
  const daysActive = t.fecha_llegada ? Math.max(0, (Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000) : 0
  if (daysActive > 14) { score += 40; reasons.push(`${Math.round(daysActive)}d activo (urgente)`) }
  else if (daysActive > 7) { score += 25; reasons.push(`${Math.round(daysActive)}d activo`) }
  else if (daysActive > 3) { score += 10; reasons.push(`${Math.round(daysActive)}d activo`) }

  const value = Number(t.importe_total) || 0
  if (value > 50000) { score += 15; reasons.push('Alto valor') }
  else if (value > 10000) { score += 5 }

  // EFFICIENCY (max 30)
  if (docsComplete) { score += 30; reasons.push('Docs completos — listo') }
  else if (t.pedimento) { score += 15; reasons.push('Pedimento asignado') }

  // RISK (max 30 — reduces priority for complex items)
  const provs = (t.proveedores || '')
  if (provs.includes('PRV_')) { score -= 10; reasons.push('Proveedor sin resolver') }

  const scoreReasons = t.score_reasons ? JSON.parse(t.score_reasons) : null
  if (scoreReasons?.level === 'elevated' || scoreReasons?.level === 'high') {
    score += 10; reasons.push('Riesgo elevado — revisar')
  }

  return { score: Math.max(0, score), reasons }
}

async function main() {
  console.log(`📋 CRUZ Queue Optimizer — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Get pending tráficos
  const { data: pending } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, fecha_llegada, importe_total, pedimento, proveedores, score_reasons')
    .neq('estatus', 'Cruzado')
    .gte('fecha_llegada', '2024-01-01')
    .order('fecha_llegada', { ascending: true })
    .limit(200)

  if (!pending || pending.length === 0) {
    console.log('  No pending tráficos')
    process.exit(0)
  }

  // Check doc completeness
  const traficoIds = pending.map(t => t.trafico)
  const { data: docs } = await supabase
    .from('expediente_documentos')
    .select('pedimento_id')
    .in('pedimento_id', traficoIds.slice(0, 100))

  const docCounts = {}
  for (const d of (docs || [])) {
    docCounts[d.pedimento_id] = (docCounts[d.pedimento_id] || 0) + 1
  }

  // Score each tráfico
  const scored = pending.map(t => {
    const docsComplete = (docCounts[t.trafico] || 0) >= 3
    const { score, reasons } = scorePriority(t, docsComplete)
    return { ...t, priority: score, reasons }
  }).sort((a, b) => b.priority - a.priority)

  // Display top 15
  console.log(`\n  ${pending.length} tráficos pendientes:\n`)
  scored.slice(0, 15).forEach((t, i) => {
    const bar = '█'.repeat(Math.min(20, Math.floor(t.priority / 5))) + '░'.repeat(20 - Math.min(20, Math.floor(t.priority / 5)))
    console.log(`  ${String(i + 1).padStart(2)}. ${bar} ${t.priority.toString().padStart(3)} ${t.trafico.padEnd(15)} ${t.company_id.padEnd(12)} ${t.reasons.join(' · ')}`)
  })

  // Estimate processing time (15 min per tráfico average)
  const estHours = Math.round(pending.length * 15 / 60 * 10) / 10

  // Telegram
  const lines = [
    `📋 <b>Cola de trabajo — ${pending.length} tráficos</b>`,
    `Tiempo estimado: ${estHours} horas`,
    ``,
    `🔝 <b>Top 5 prioridad:</b>`,
    ...scored.slice(0, 5).map((t, i) => `  ${i + 1}. <code>${t.trafico}</code> (${t.company_id}) — ${t.priority}pts`),
    ``,
  ]

  if (pending.length > 40) lines.push(`⚠️ Cola > 40 — considerar apoyo adicional`)
  else if (pending.length > 20) lines.push(`🟡 Cola > 20 — monitorear`)

  lines.push(`— CRUZ 🦀`)
  await sendTelegram(lines.join('\n'))

  // Save queue order
  if (!DRY_RUN) {
    await supabase.from('benchmarks').upsert({
      metric: 'queue_size',
      dimension: 'fleet',
      value: pending.length,
      sample_size: scored.filter(s => s.priority > 50).length,
      period: new Date().toISOString().split('T')[0],
    }, { onConflict: 'metric,dimension' }).then(() => {}, () => {})
  }

  console.log(`\n✅ Queue: ${pending.length} items · Est: ${estHours}h · Top priority: ${scored[0]?.priority || 0}`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
