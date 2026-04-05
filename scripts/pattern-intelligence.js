#!/usr/bin/env node

// ============================================================
// CRUZ Pattern Intelligence — the data network effect
// Analyzes ALL clients' data to find patterns no single broker can see.
// Cron: 0 3 * * 0 (Sunday 3 AM)
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

async function main() {
  console.log(`🧠 CRUZ Pattern Intelligence — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const insights = []

  // ── 1. Reconocimiento patterns ──
  console.log('1. Reconocimiento patterns...')
  const { data: semaforoData } = await supabase
    .from('traficos')
    .select('semaforo, descripcion_mercancia, importe_total')
    .not('semaforo', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .limit(10000)

  const sem = semaforoData || []
  const total = sem.length
  const rojos = sem.filter(s => s.semaforo === 1)

  if (total > 50) {
    const rojoRate = Math.round((rojos.length / total) * 100)
    console.log(`  Fleet reconocimiento rate: ${rojoRate}% (${rojos.length}/${total})`)

    // Value correlation
    const rojoAvgValue = rojos.length > 0 ? rojos.reduce((s, r) => s + (Number(r.importe_total) || 0), 0) / rojos.length : 0
    const verdeAvgValue = (total - rojos.length) > 0 ? sem.filter(s => s.semaforo === 0).reduce((s, r) => s + (Number(r.importe_total) || 0), 0) / (total - rojos.length) : 0

    if (rojoAvgValue > verdeAvgValue * 1.5) {
      insights.push({ type: 'crossing', pattern: `Valores altos tienen ${Math.round(rojoAvgValue / Math.max(1, verdeAvgValue))}x más reconocimiento`, confidence: 85, sample: total })
    }
  }

  // ── 2. Supplier patterns ──
  console.log('2. Supplier patterns...')
  const { data: suppData } = await supabase
    .from('traficos')
    .select('proveedores, company_id')
    .gte('fecha_llegada', '2024-01-01')
    .not('proveedores', 'is', null)
    .limit(10000)

  const supplierClients = {}
  for (const t of (suppData || [])) {
    const provs = (t.proveedores || '').split(',').map(s => s.trim()).filter(Boolean)
    for (const p of provs) {
      if (p.startsWith('PRV_')) continue
      if (!supplierClients[p]) supplierClients[p] = new Set()
      supplierClients[p].add(t.company_id)
    }
  }

  const multiClientSuppliers = Object.entries(supplierClients)
    .filter(([, clients]) => clients.size >= 3)
    .map(([name, clients]) => ({ name, clientCount: clients.size }))
    .sort((a, b) => b.clientCount - a.clientCount)

  if (multiClientSuppliers.length > 0) {
    console.log(`  ${multiClientSuppliers.length} suppliers serve 3+ clients`)
    insights.push({
      type: 'supplier',
      pattern: `${multiClientSuppliers.length} proveedores atienden 3+ clientes. Top: ${multiClientSuppliers[0].name} (${multiClientSuppliers[0].clientCount} clientes)`,
      confidence: 95, sample: Object.keys(supplierClients).length,
    })
  }

  // ── 3. Volume trends ──
  console.log('3. Volume trends...')
  const { data: volumeData } = await supabase
    .from('traficos')
    .select('fecha_llegada')
    .gte('fecha_llegada', '2024-01-01')
    .limit(10000)

  const monthlyVolume = {}
  for (const t of (volumeData || [])) {
    const m = (t.fecha_llegada || '').substring(0, 7)
    if (m) monthlyVolume[m] = (monthlyVolume[m] || 0) + 1
  }

  const months = Object.keys(monthlyVolume).sort()
  if (months.length >= 6) {
    const recent3 = months.slice(-3).reduce((s, m) => s + monthlyVolume[m], 0) / 3
    const prior3 = months.slice(-6, -3).reduce((s, m) => s + monthlyVolume[m], 0) / 3
    const trend = prior3 > 0 ? Math.round(((recent3 - prior3) / prior3) * 100) : 0

    if (Math.abs(trend) > 10) {
      insights.push({
        type: 'market',
        pattern: `Volumen fleet ${trend > 0 ? 'subió' : 'bajó'} ${Math.abs(trend)}% vs trimestre anterior (${Math.round(recent3)}/mes actual vs ${Math.round(prior3)}/mes previo)`,
        confidence: 90, sample: (volumeData || []).length,
      })
    }
  }

  // ── 4. Document patterns ──
  console.log('4. Document patterns...')
  const { data: solData } = await supabase
    .from('documento_solicitudes')
    .select('doc_type, status')
    .limit(5000)

  const docMissing = {}
  for (const s of (solData || [])) {
    if (s.status === 'solicitado') {
      docMissing[s.doc_type] = (docMissing[s.doc_type] || 0) + 1
    }
  }

  const topMissing = Object.entries(docMissing).sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (topMissing.length > 0) {
    insights.push({
      type: 'compliance',
      pattern: `Documentos más solicitados: ${topMissing.map(([t, c]) => `${t} (${c})`).join(', ')}`,
      confidence: 92, sample: (solData || []).length,
    })
  }

  // ── 5. Price trends ──
  console.log('5. Price trends...')
  const { data: priceData } = await supabase
    .from('traficos')
    .select('importe_total, peso_bruto, fecha_llegada')
    .gte('fecha_llegada', '2024-01-01')
    .not('importe_total', 'is', null)
    .not('peso_bruto', 'is', null)
    .gt('peso_bruto', 0)
    .limit(5000)

  if ((priceData || []).length > 100) {
    const prices = (priceData || []).map(t => ({
      month: (t.fecha_llegada || '').substring(0, 7),
      perKg: (Number(t.importe_total) || 0) / (Number(t.peso_bruto) || 1),
    }))

    const recentPrices = prices.filter(p => p.month >= months[months.length - 3])
    const oldPrices = prices.filter(p => p.month < months[months.length - 3])

    if (recentPrices.length > 10 && oldPrices.length > 10) {
      const recentAvg = recentPrices.reduce((s, p) => s + p.perKg, 0) / recentPrices.length
      const oldAvg = oldPrices.reduce((s, p) => s + p.perKg, 0) / oldPrices.length
      const priceTrend = oldAvg > 0 ? Math.round(((recentAvg - oldAvg) / oldAvg) * 100) : 0

      if (Math.abs(priceTrend) > 15) {
        insights.push({
          type: 'market',
          pattern: `Precio por kg ${priceTrend > 0 ? 'subió' : 'bajó'} ${Math.abs(priceTrend)}% ($${recentAvg.toFixed(2)}/kg vs $${oldAvg.toFixed(2)}/kg)`,
          confidence: 80, sample: prices.length,
        })
      }
    }
  }

  // ── Save insights ──
  if (!DRY_RUN && insights.length > 0) {
    for (const insight of insights) {
      await supabase.from('benchmarks').insert({
        metric: `insight_${insight.type}`,
        dimension: insight.pattern.substring(0, 100),
        value: insight.confidence,
        sample_size: insight.sample,
        period: new Date().toISOString().split('T')[0],
      }).then(() => {}, () => {})
    }
  }

  // ── Telegram digest ──
  if (insights.length > 0) {
    const lines = [
      `🧠 <b>Pattern Intelligence — ${insights.length} patrones</b>`,
      ``,
      ...insights.map((ins, i) => `${i + 1}. ${ins.pattern} (${ins.confidence}% conf, ${ins.sample} muestras)`),
      ``,
      `Basado en datos de ${Object.keys(supplierClients).length} proveedores · ${(volumeData || []).length} tráficos`,
      `— CRUZ 🦀`,
    ]
    await sendTelegram(lines.join('\n'))
  }

  console.log(`\n✅ ${insights.length} insights generated`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
