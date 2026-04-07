#!/usr/bin/env node

// ============================================================
// CRUZ Compliance Predictor — predict issues BEFORE they happen
// Scores each active tráfico 0-100 on compliance risk using
// historical patterns across all 47+ clients.
// Cron: 0 6 * * 1-6 (weekdays 6 AM)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

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
  await fetch(`https://api.telegram.org/bot${TELEGRAM_CHAT}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function buildBaselines() {
  // Fleet semáforo rojo rate
  const semaforoData = await fetchAll(supabase
    .from('traficos')
    .select('semaforo')
    .gte('fecha_llegada', '2024-01-01')
    .not('semaforo', 'is', null))
  const total = semaforoData.length
  const rojos = semaforoData.filter(t => t.semaforo === 1).length
  const rojoRate = total > 0 ? rojos / total : 0.08

  // Average value
  const valData = await fetchAll(supabase
    .from('traficos')
    .select('importe_total')
    .gte('fecha_llegada', '2024-01-01')
    .not('importe_total', 'is', null))
  const vals = valData.map(t => Number(t.importe_total)).filter(v => v > 0)
  const avgValue = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 10000

  return { rojoRate, avgValue }
}

function scoreTrafico(t, baselines) {
  const factors = []
  let score = 0

  // 1. Reconocimiento probability (30 pts)
  if (t.semaforo === 1) {
    score += 30; factors.push({ f: 'Semáforo rojo asignado', v: 30 })
  } else if (t.semaforo === 0) {
    factors.push({ f: 'Semáforo verde', v: 0 })
  } else {
    const base = Math.round(baselines.rojoRate * 30)
    score += base; factors.push({ f: `Probabilidad reconocimiento (${Math.round(baselines.rojoRate * 100)}%)`, v: base })
  }

  // 2. Document completeness (25 pts)
  const hasPed = !!t.pedimento
  if (!hasPed) {
    const days = t.fecha_llegada ? Math.max(0, (Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000) : 0
    const v = Math.min(25, Math.round(days * 2))
    score += v; factors.push({ f: `Sin pedimento (${Math.round(days)}d)`, v })
  } else {
    factors.push({ f: 'Pedimento asignado', v: 0 })
  }

  // 3. Value outlier (20 pts)
  const val = Number(t.importe_total) || 0
  const ratio = baselines.avgValue > 0 ? val / baselines.avgValue : 1
  if (ratio > 3) { score += 20; factors.push({ f: `Valor ${ratio.toFixed(1)}x promedio`, v: 20 }) }
  else if (ratio > 2) { score += 10; factors.push({ f: `Valor ${ratio.toFixed(1)}x promedio`, v: 10 }) }
  else { factors.push({ f: 'Valor normal', v: 0 }) }

  // 4. Supplier (15 pts)
  const prov = (t.proveedores || '')
  const newSupplier = !prov || prov.includes('PRV_')
  if (newSupplier) { score += 15; factors.push({ f: 'Proveedor sin historial', v: 15 }) }
  else { factors.push({ f: 'Proveedor conocido', v: 0 }) }

  // 5. Country risk (10 pts)
  const pais = (t.pais_procedencia || '').toUpperCase()
  const highRisk = ['CN', 'HK', 'TW', 'KR', 'IN', 'VN', 'TH'].includes(pais)
  if (highRisk) { score += 10; factors.push({ f: `País escrutinio alto (${pais})`, v: 10 }) }
  else { factors.push({ f: `País: ${pais || '—'}`, v: 0 }) }

  const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'
  const mitigations = []
  if (score >= 60) {
    if (!hasPed) mitigations.push('Asignar pedimento urgente')
    mitigations.push('Preparar certificado NOM, carta técnica, fotos')
    mitigations.push('Verificar factura con desglose detallado')
    if (newSupplier) mitigations.push('Validar documentación del proveedor')
  }

  return { score, level, factors, mitigations }
}

async function main() {
  console.log(`🛡️ Compliance Predictor — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const baselines = await buildBaselines()
  console.log(`  Rojo rate: ${Math.round(baselines.rojoRate * 100)}% · Avg value: $${Math.round(baselines.avgValue).toLocaleString()}`)

  const { data: active } = await supabase
    .from('traficos')
    .select('id, trafico, company_id, estatus, fecha_llegada, importe_total, pedimento, proveedores, semaforo, pais_procedencia')
    .neq('estatus', 'Cruzado')
    .gte('fecha_llegada', '2024-01-01')
    .limit(500)

  let highCount = 0
  const alerts = []

  for (const t of (active || [])) {
    const result = scoreTrafico(t, baselines)
    if (result.level === 'high') {
      highCount++
      alerts.push({ trafico: t.trafico, company: t.company_id, score: result.score, factors: result.factors.filter(f => f.v > 0) })
    }

    if (!DRY_RUN) {
      await supabase.from('traficos').update({
        score_reasons: JSON.stringify({
          score: result.score, level: result.level,
          reasons: result.factors.filter(f => f.v > 0).map(f => `+${f.v} — ${f.f}`),
          mitigations: result.mitigations,
          scored_at: new Date().toISOString(),
        }),
      }).eq('id', t.id).then(() => {}, () => {})
    }
  }

  if (alerts.length > 0) {
    await sendTelegram([
      `🛡️ <b>Compliance — ${highCount} alto riesgo</b>`,
      ``,
      ...alerts.slice(0, 5).map(a => `🔴 <b>${a.trafico}</b> (${a.company}): ${a.score}/100`),
      ``,
      `${(active || []).length} tráficos analizados`,
      `— CRUZ 🦀`,
    ].join('\n'))
  }

  console.log(`\n✅ ${(active || []).length} scored · ${highCount} high risk`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
