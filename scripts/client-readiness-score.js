#!/usr/bin/env node

// ============================================================
// CRUZ Client Readiness Score — ranks 51 clients by data quality
// Calculates 0-100 score per client based on data completeness.
// Surfaces top clients ready for portal activation.
// Cron: 0 19 * * 0 (Sunday 7 PM — before shadow weekly report)
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
const PORTAL_DATE_FROM = '2024-01-01'
const ACTIVATION_THRESHOLD = 80

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

async function scoreClient(company) {
  const { company_id, name, clave_cliente } = company
  const scores = {}

  // 1. Tráfico count (max 25 pts — need at least 10 for full score)
  const { count: trafCount } = await supabase
    .from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
  const trafScore = Math.min(25, Math.round(((trafCount || 0) / 10) * 25))
  scores.traficos = { count: trafCount || 0, score: trafScore }

  // 2. Pedimento linkage (max 20 pts)
  const { count: withPed } = await supabase
    .from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)
    .not('pedimento', 'is', null)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
  const pedPct = (trafCount || 0) > 0 ? Math.round(((withPed || 0) / trafCount) * 100) : 0
  scores.pedimento_linkage = { pct: pedPct, score: Math.round(pedPct / 100 * 20) }

  // 3. Expediente coverage (max 15 pts)
  const { count: expCount } = await supabase
    .from('expediente_documentos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)
  const expScore = Math.min(15, Math.round(((expCount || 0) / Math.max(1, (trafCount || 1) * 3)) * 15))
  scores.expediente = { docs: expCount || 0, score: expScore }

  // 4. Supplier resolution (max 15 pts — no PRV_ codes)
  const { data: prvCheck } = await supabase
    .from('traficos')
    .select('trafico')
    .eq('company_id', company_id)
    .like('proveedores', '%PRV_%')
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .limit(5)
  const prvCount = prvCheck?.length || 0
  const supplierScore = prvCount === 0 ? 15 : Math.max(0, 15 - prvCount * 3)
  scores.suppliers = { unresolved: prvCount, score: supplierScore }

  // 5. Entrada linkage (max 10 pts)
  const { count: entCount } = await supabase
    .from('entradas')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)
  const entScore = Math.min(10, Math.round(((entCount || 0) / Math.max(1, (trafCount || 1))) * 10))
  scores.entradas = { count: entCount || 0, score: entScore }

  // 6. Financial data (max 15 pts)
  const { count: factCount } = await supabase
    .from('aduanet_facturas')
    .select('*', { count: 'exact', head: true })
    .eq('clave_cliente', clave_cliente || '')
  const finScore = Math.min(15, Math.round(((factCount || 0) / Math.max(1, (trafCount || 1))) * 15))
  scores.financiero = { facturas: factCount || 0, score: finScore }

  const total = Object.values(scores).reduce((s, v) => s + v.score, 0)

  return {
    company_id,
    name,
    total,
    breakdown: scores,
    ready: total >= ACTIVATION_THRESHOLD,
  }
}

async function main() {
  console.log(`📊 CRUZ Client Readiness Score — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, name, clave_cliente, portal_password')
    .eq('active', true)
    .order('name')

  if (!companies || companies.length === 0) {
    console.log('No companies found')
    process.exit(0)
  }

  console.log(`  Scoring ${companies.length} companies...\n`)

  const results = []
  for (const company of companies) {
    try {
      const result = await scoreClient(company)
      results.push(result)
      const bar = '█'.repeat(Math.floor(result.total / 5)) + '░'.repeat(20 - Math.floor(result.total / 5))
      const hasLogin = !!company.portal_password
      console.log(`  ${result.total.toString().padStart(3)}  ${bar}  ${result.name.substring(0, 30).padEnd(30)}${hasLogin ? ' ✅' : ''}${result.ready ? ' 🟢' : ''}`)
    } catch (err) {
      console.log(`  ERR                              ${company.name.substring(0, 30)}  ${err.message}`)
    }
  }

  results.sort((a, b) => b.total - a.total)

  // Save scores
  if (!DRY_RUN) {
    for (const r of results) {
      await supabase.from('client_readiness').upsert({
        company_id: r.company_id,
        score: r.total,
        breakdown: r.breakdown,
        ready: r.ready,
        scored_at: new Date().toISOString(),
      }, { onConflict: 'company_id' }).then(() => {}, () => {})
    }
  }

  // Summary
  const ready = results.filter(r => r.ready)
  const top5 = results.slice(0, 5)
  const withLogin = companies.filter(c => !!c.portal_password)

  const lines = [
    `📊 <b>Client Readiness — ${companies.length} empresas</b>`,
    ``,
    `🟢 <b>Listos para activación (≥${ACTIVATION_THRESHOLD}):</b> ${ready.length}`,
    ...ready.slice(0, 8).map(r => `  • ${r.name.substring(0, 25)}: <b>${r.total}/100</b>`),
    ``,
    `🏆 <b>Top 5:</b>`,
    ...top5.map((r, i) => `  ${i + 1}. ${r.name.substring(0, 25)} — ${r.total}/100`),
    ``,
    `📈 Con portal activo: ${withLogin.length}`,
    `📊 En shadow: ${companies.length - withLogin.length}`,
    ``,
    ready.length > withLogin.length ? `💡 ${ready.length - withLogin.length} cliente(s) listos sin portal — <b>/activar [id]</b>` : '',
    `— CRUZ 🦀`,
  ].filter(Boolean)

  await sendTelegram(lines.join('\n'))

  console.log(`\n✅ ${results.length} scored · ${ready.length} ready · ${withLogin.length} with portal`)
  process.exit(0)
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
