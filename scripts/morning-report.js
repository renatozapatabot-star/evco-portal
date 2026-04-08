#!/usr/bin/env node
// scripts/morning-report.js
// Multi-client daily morning report → Telegram
// Cron: 55 6 * * * node ~/evco-portal/scripts/morning-report.js
// Test: node scripts/morning-report.js --dry-run

const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const DRY_RUN = process.argv.includes('--dry-run')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── MULTI-CLIENT CONFIG ──────────────────────────────
const CLIENTS = [
  {
    name: 'EVCO Plastics de Mexico',
    short: 'EVCO',
    company_id: 'evco',
    clave: '9254',
    telegram_chat: '-5085543275',
    active: true,
  },
  {
    name: 'MAFESA',
    short: 'MAFESA',
    company_id: 'mafesa',
    clave: '4598',
    telegram_chat: '-5085543275',
    active: true,
  },
]

const CLIENT_FILTER = process.env.CLIENT_ID

// ── AI ANALYSIS CONFIG ──
const OLLAMA_URL = 'http://127.0.0.1:11434'
const AI_MODEL = 'qwen3:8b'

// ── TELEGRAM ─────────────────────────────────────────
async function sendTelegram(chatId, text) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true') return
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) { console.log('[TG skip — no token]'); return }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`Telegram error: ${JSON.stringify(json)}`)
}

async function callAIAnalysis(prompt) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        prompt,
        stream: false,
        think: false,
        options: { temperature: 0.3, num_predict: 500 },
      }),
    })
    if (!response.ok) return null
    const result = await response.json()
    const text = (result.response || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    return text || null
  } catch (err) {
    console.warn(`AI analysis skipped: ${err.message}`)
    return null
  }
}

function fmtNum(n) { return Number(n || 0).toLocaleString('en-US') }
function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }

function staleBadge(dateStr) {
  if (!dateStr) return ''
  const hoursOld = (Date.now() - new Date(dateStr).getTime()) / 3600000
  if (hoursOld >= 48) return ' 🔴'
  if (hoursOld >= 24) return ' 🟡'
  return ''
}

// ── GLOBAL DATA (fetched once, shared across clients) ──
async function getGlobalData() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]

  // Exchange rate from system_config
  const { data: tcRow } = await supabase
    .from('system_config')
    .select('value, valid_to')
    .eq('key', 'banxico_exchange_rate')
    .single()
  const exchangeRate = tcRow?.value?.rate || null
  const tcExpired = tcRow?.valid_to ? new Date(tcRow.valid_to) < new Date() : true

  // Shadow mode classifications (last 24h)
  const { data: shadowRecent } = await supabase
    .from('shadow_classifications')
    .select('classification, confidence')
    .gte('created_at', yesterdayStr)
  const shadowCount = shadowRecent?.length || 0
  const shadowAvgConf = shadowCount > 0
    ? Math.round(shadowRecent.reduce((s, r) => s + (r.confidence || 0), 0) / shadowCount * 100)
    : 0

  // Pending drafts (cross-client)
  const { data: pendingDrafts } = await supabase
    .from('pedimento_drafts')
    .select('id, created_at, status')
    .in('status', ['draft', 'pending', 'pending_review'])
  const draftCount = pendingDrafts?.length || 0
  const stale24 = (pendingDrafts || []).filter(d => staleBadge(d.created_at) !== '').length
  const stale48 = (pendingDrafts || []).filter(d => {
    const h = (Date.now() - new Date(d.created_at).getTime()) / 3600000
    return h >= 48
  }).length

  // Document solicitudes
  const { data: solicitudes } = await supabase
    .from('documento_solicitudes')
    .select('id, status, solicitado_at')
  const solSent = (solicitudes || []).filter(s =>
    s.solicitado_at && s.solicitado_at >= yesterdayStr && s.solicitado_at < todayStr
  ).length
  const solPending = (solicitudes || []).filter(s => s.status === 'solicitado').length

  return {
    exchangeRate, tcExpired,
    shadowCount, shadowAvgConf,
    draftCount, stale24, stale48, pendingDrafts: pendingDrafts || [],
    solSent, solPending,
  }
}

// ── PER-CLIENT DATA ──────────────────────────────────
async function getClientReport(client) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]

  // Traficos
  const { data: traficos } = await supabase
    .from('traficos').select('estatus, peso_bruto, risk_score, deadline, fecha_llegada')
    .eq('company_id', client.company_id)
    .gte('fecha_llegada', '2024-01-01')
  const traf = traficos || []
  const totalTraficos = traf.length
  const enProceso = traf.filter(t => t.estatus === 'En Proceso').length
  const cruzados = traf.filter(t => (t.estatus || '').toLowerCase().includes('cruz')).length
  const pesoTotal = traf.reduce((s, t) => s + (t.peso_bruto || 0), 0)
  const highRisk = traf.filter(t => (t.risk_score || 0) >= 70).length

  // Entradas
  const entradas = await fetchAll(supabase
    .from('entradas').select('tiene_faltantes, mercancia_danada')
    .eq('company_id', client.company_id))
  const ent = entradas || []
  const totalEntradas = ent.length
  const conFaltantes = ent.filter(e => e.tiene_faltantes).length
  const conDanos = ent.filter(e => e.mercancia_danada).length

  // Overnight entradas
  const { data: overnightEntradas } = await supabase
    .from('entrada_lifecycle')
    .select('id')
    .eq('company_id', client.company_id)
    .gte('created_at', yesterdayStr)
    .lt('created_at', todayStr)
  const overnightCount = overnightEntradas?.length || 0

  // Facturas / Financial
  const { data: facturas } = await supabase
    .from('aduanet_facturas').select('valor_usd, pedimento')
    .eq('clave_cliente', client.clave)
  const fact = facturas || []
  const valorUSD = fact.reduce((s, f) => s + (f.valor_usd || 0), 0)
  const pedimentos = new Set(fact.map(f => f.pedimento).filter(Boolean)).size

  // Expediente coverage
  const { count: expDocCount } = await supabase
    .from('expediente_documentos').select('*', { count: 'exact', head: true })
    .eq('company_id', client.company_id)
  // Compare expedientes vs traficos with pedimento
  const trafWithPed = traf.filter(t => t.estatus && t.estatus !== 'En Proceso').length
  const expCoverage = trafWithPed > 0
    ? Math.round(Math.min(100, ((expDocCount || 0) / Math.max(1, trafWithPed)) * 100 / 8))
    : 0 // Rough: assume ~8 docs per expediente

  // Entradas con faltantes count
  const entFaltantesCount = conFaltantes

  // Deadlines within 7 days
  const sevenDays = new Date()
  sevenDays.setDate(sevenDays.getDate() + 7)
  const { data: upcomingDeadlines } = await supabase
    .from('traficos')
    .select('trafico')
    .eq('company_id', client.company_id)
    .eq('estatus', 'En Proceso')
    .not('deadline', 'is', null)
    .lte('deadline', sevenDays.toISOString().split('T')[0])
  const upcomingDeadlinesCount = upcomingDeadlines?.length || 0

  // Bridge wait times
  const { data: bridgeData } = await supabase
    .from('bridge_intelligence')
    .select('crossing_hours')
    .limit(50)
  const avgBridge = bridgeData?.length
    ? (bridgeData.reduce((s, b) => s + (b.crossing_hours || 0), 0) / bridgeData.length).toFixed(1)
    : '—'

  // Top risks
  const topRisks = traf
    .filter(t => (t.risk_score || 0) > 0)
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 3)

  return {
    totalTraficos, enProceso, cruzados, pesoTotal, highRisk,
    totalEntradas, conFaltantes, conDanos, overnightCount,
    valorUSD, pedimentos,
    expDocCount: expDocCount || 0, expCoverage,
    entFaltantesCount,
    upcomingDeadlinesCount,
    avgBridge,
    topRisks,
  }
}

// ── MAIN ─────────────────────────────────────────────
async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Multi-Client Morning Report — CRUZ`)

  const now = new Date()
  const cst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const day = dayNames[cst.getDay()]
  const dateStr = cst.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = cst.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

  // Fetch global data
  const g = await getGlobalData()

  const activeClients = CLIENTS.filter(c => {
    if (CLIENT_FILTER) return c.company_id === CLIENT_FILTER
    return c.active
  })

  // ── Build report ──
  const lines = []

  lines.push(`🌅 <b>BUENOS DÍAS TITO</b>`)
  lines.push(`Renato Zapata &amp; Company · CRUZ 🦀`)
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  lines.push(`📅 ${day}, ${dateStr} · ${timeStr} CST`)
  lines.push(`${activeClients.length} cliente(s) activo(s)`)
  lines.push(``)

  // ── Exchange rate ──
  if (g.exchangeRate) {
    lines.push(`💱 TC: <b>$${Number(g.exchangeRate).toFixed(4)}</b> MXN/USD${g.tcExpired ? ' ⚠️ EXPIRADO' : ''}`)
    lines.push(``)
  }

  // ── Per-client sections ──
  let allRisks = []

  for (const client of activeClients) {
    console.log(`  Fetching ${client.short}...`)
    let r
    try {
      r = await getClientReport(client)
    } catch (err) {
      lines.push(`━━━ ${client.short} ━━━`)
      lines.push(`❌ Error: ${err.message}`)
      lines.push(``)
      continue
    }

    lines.push(`━━━ <b>${client.short}</b> ━━━`)

    // Traficos
    lines.push(`🚢 Tráficos: <b>${fmtNum(r.totalTraficos)}</b>`)
    lines.push(`  🟡 En proceso: ${fmtNum(r.enProceso)}`)
    lines.push(`  🟢 Cruzados: ${fmtNum(r.cruzados)}`)
    lines.push(`  ⚖️ ${fmtNum(r.pesoTotal)} kg`)
    if (r.highRisk > 0) lines.push(`  🔴 Alto riesgo: ${r.highRisk}`)

    // Entradas
    lines.push(`📦 Entradas: <b>${fmtNum(r.totalEntradas)}</b>`)
    if (r.conFaltantes > 0) lines.push(`  ⚠️ Con faltantes: ${r.conFaltantes}`)
    if (r.conDanos > 0) lines.push(`  🔴 Con daños: ${r.conDanos}`)
    if (r.overnightCount > 0) lines.push(`  🌙 Overnight: ${r.overnightCount}`)

    // Financial
    lines.push(`💰 Valor: <b>${fmtUSD(r.valorUSD)}</b> USD · ${fmtNum(r.pedimentos)} pedimentos`)

    // Expediente coverage
    lines.push(`📋 Expedientes: ${fmtNum(r.expDocCount)} docs · ~${r.expCoverage}% cobertura`)

    // Bridge
    if (r.avgBridge !== '—') lines.push(`🌉 Puente promedio: ${r.avgBridge}h`)

    // Deadlines
    if (r.upcomingDeadlinesCount > 0) lines.push(`📅 Vencen 7 días: ${r.upcomingDeadlinesCount}`)

    lines.push(``)

    allRisks.push(...r.topRisks.map(t => ({ ...t, client: client.short })))
  }

  // ── Cross-client: Pending approvals ──
  lines.push(`━━━ <b>PENDIENTES</b> ━━━`)
  lines.push(`📄 Borradores: <b>${g.draftCount}</b>`)
  if (g.pendingDrafts.length > 0) {
    // Show oldest drafts with stale badges
    const oldest = g.pendingDrafts
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(0, 3)
    for (const d of oldest) {
      const badge = staleBadge(d.created_at)
      if (badge) {
        const h = Math.round((Date.now() - new Date(d.created_at).getTime()) / 3600000)
        lines.push(`  ${badge} ${d.id.substring(0, 8)}... — ${h}h pendiente`)
      }
    }
  }
  lines.push(`📨 Docs solicitados: <b>${g.solPending}</b> pendientes · ${g.solSent} enviados ayer`)
  if (g.stale48 > 0) lines.push(`🔴 ${g.stale48} item(s) llevan &gt;48h — <b>/aprobar</b>`)
  else if (g.stale24 > 0) lines.push(`🟡 ${g.stale24} item(s) llevan &gt;24h — <b>/aprobar</b>`)
  else if (g.draftCount === 0 && g.solPending === 0) lines.push(`✅ Todo al día`)
  lines.push(``)

  // ── Shadow mode ──
  if (g.shadowCount > 0) {
    lines.push(`👁️ Shadow: <b>${g.shadowCount}</b> emails clasificados · ${g.shadowAvgConf}% confianza`)
    lines.push(``)
  }

  // ── Top risks ──
  allRisks.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
  if (allRisks.length > 0) {
    lines.push(`🚨 <b>TOP RIESGOS</b>`)
    allRisks.slice(0, 3).forEach((r, i) => {
      lines.push(`  ${i + 1}. Score ${r.risk_score} — ${r.client}`)
    })
    lines.push(``)
  }

  // ── AI insights ──
  const firstReport = activeClients.length > 0 ? await getClientReport(activeClients[0]).catch(() => null) : null
  if (firstReport) {
    const aiInsights = await generateAIInsights(firstReport, g)
    if (aiInsights) {
      lines.push(`🤖 <b>ANÁLISIS CRUZ</b>`)
      lines.push(aiInsights)
      lines.push(``)
    }
  }

  // ── AGENT STATS (last 24h) ──
  try {
    const dayAgo = new Date(Date.now() - 86400000).toISOString()
    const { data: agentRows } = await supabase.from('agent_decisions')
      .select('workflow, autonomy_level, was_correct')
      .gte('created_at', dayAgo)
      .limit(500)

    if (agentRows && agentRows.length > 0) {
      const total = agentRows.length
      const autonomous = agentRows.filter(d => d.autonomy_level >= 2).length
      const autoPct = total > 0 ? Math.round(autonomous / total * 100) : 0
      const reviewed = agentRows.filter(d => d.was_correct !== null)
      const correct = reviewed.filter(d => d.was_correct).length
      const accuracy = reviewed.length > 0 ? Math.round(correct / reviewed.length * 1000) / 10 : 0

      // Count by workflow
      const wfCounts = {}
      agentRows.forEach(d => { wfCounts[d.workflow || d.trigger_type || 'unknown'] = (wfCounts[d.workflow || d.trigger_type || 'unknown'] || 0) + 1 })

      lines.push(``)
      lines.push(`🤖 <b>CRUZ AGENT — 24h</b>`)
      lines.push(`Decisiones: ${total} · Autónomas: ${autonomous} (${autoPct}%)`)
      if (reviewed.length > 0) lines.push(`Precisión: ${accuracy}%`)
      Object.entries(wfCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([wf, count]) => {
        lines.push(`  • ${wf.replace(/_/g, ' ')}: ${count}`)
      })
    }
  } catch { /* agent_decisions table may not exist yet */ }

  // ── CLASIFICACIONES AUTONOMAS (Block 6 data) ──
  try {
    const dayAgo = new Date(Date.now() - 86400000).toISOString()

    // Recent classifications (24h)
    const { data: recentClass } = await supabase.from('agent_decisions')
      .select('id, decision, confidence, action_taken, payload')
      .eq('trigger_type', 'classification')
      .gte('created_at', dayAgo)
      .order('confidence', { ascending: true })
      .limit(200)

    // Pending reviews (all time — matches /clasificar page)
    const { count: pendingCount } = await supabase.from('agent_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('trigger_type', 'classification')
      .is('was_correct', null)

    if ((recentClass && recentClass.length > 0) || (pendingCount && pendingCount > 0)) {
      const autoApplied = (recentClass || []).filter(c => (c.action_taken || '').includes('auto-aplicada')).length
      const humanReview = (recentClass || []).length - autoApplied
      const pending = pendingCount || 0

      lines.push(``)
      lines.push(`🏷️ <b>CLASIFICACIONES</b>`)
      if (recentClass && recentClass.length > 0) {
        lines.push(`  24h: ${autoApplied} auto-aplicadas · ${humanReview} revisión humana`)
      }
      if (pending > 0) {
        lines.push(`  ⏳ Pendientes revisión: <b>${pending}</b>`)
        // Show top 5 lowest-confidence pending
        const { data: pendingRows } = await supabase.from('agent_decisions')
          .select('confidence, payload')
          .eq('trigger_type', 'classification')
          .is('was_correct', null)
          .order('confidence', { ascending: true })
          .limit(5)
        if (pendingRows && pendingRows.length > 0) {
          for (const p of pendingRows) {
            const frac = p.payload?.suggested_fraccion || '?'
            const desc = (p.payload?.product_description || '').substring(0, 30)
            const pct = Math.round((p.confidence || 0) * 100)
            lines.push(`    ⚡ ${frac} — ${pct}% — ${desc}`)
          }
          if (pending > 5) lines.push(`    + ${pending - 5} más`)
        }
        lines.push(`  → <b>/clasificar</b> para revisar`)
      }
    }
  } catch { /* clasificaciones section optional */ }

  // ── CADENA AUTONOMA (Blocks 8-9 workflow chain stats) ──
  try {
    const dayAgo = new Date(Date.now() - 86400000).toISOString()

    const [dutiesRes, readyRes, blockedRes] = await Promise.all([
      supabase.from('workflow_events').select('id, payload', { count: 'exact' })
        .eq('event_type', 'duties_calculated').eq('workflow', 'pedimento')
        .gte('created_at', dayAgo).limit(200),
      supabase.from('workflow_events').select('id', { count: 'exact', head: true })
        .eq('event_type', 'ready_for_pedimento').eq('workflow', 'docs')
        .gte('created_at', dayAgo),
      supabase.from('workflow_events').select('id', { count: 'exact', head: true })
        .eq('event_type', 'blocked').eq('workflow', 'docs')
        .gte('created_at', dayAgo),
    ])

    const dutiesCount = dutiesRes.count || (dutiesRes.data || []).length
    const readyCount = readyRes.count || 0
    const blockedCount = blockedRes.count || 0

    if (dutiesCount > 0 || readyCount > 0 || blockedCount > 0) {
      const totalMxn = (dutiesRes.data || []).reduce((s, e) => {
        return s + (e.payload?.total_contribuciones_mxn || e.payload?.total || 0)
      }, 0)

      lines.push(``)
      lines.push(`⛓️ <b>CADENA AUTÓNOMA (24h)</b>`)
      lines.push(`  Calcular → Validar docs → Listo`)
      if (dutiesCount > 0) lines.push(`  💰 ${dutiesCount} contribuciones calculadas · ${fmtUSD(totalMxn)} MXN`)
      if (readyCount > 0) lines.push(`  ✅ ${readyCount} docs listos para pedimento`)
      if (blockedCount > 0) lines.push(`  🔴 ${blockedCount} bloqueados por docs faltantes`)
    }
  } catch { /* chain section optional */ }

  // ── DOCS INCOMPLETOS (Block 9 blocked traficos) ──
  try {
    const { data: blockedDrafts } = await supabase.from('pedimento_drafts')
      .select('trafico_id, draft_data')
      .eq('needs_manual_intervention', true)
      .not('draft_data->docs_validation', 'is', null)
      .limit(5)

    const blocked = (blockedDrafts || []).filter(d =>
      d.draft_data?.docs_validation?.blocked === true
    )

    if (blocked.length > 0) {
      lines.push(``)
      lines.push(`📋 <b>DOCS INCOMPLETOS</b>`)
      for (const d of blocked.slice(0, 5)) {
        const missing = (d.draft_data.docs_validation.missing_critical || []).join(', ')
        lines.push(`  • ${d.trafico_id} — falta: ${missing || 'desconocido'}`)
      }
    }
  } catch { /* docs section optional */ }

  lines.push(``)
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  lines.push(`Patente 3596 · Aduana 240`)
  lines.push(`— CRUZ 🦀`)

  const fullReport = lines.join('\n')

  console.log(fullReport.replace(/<[^>]+>/g, ''))

  if (DRY_RUN) {
    console.log('\n[DRY RUN — not sending to Telegram]')
    process.exit(0)
  }

  console.log('\nSending to Telegram...')
  const sentChats = new Set()
  for (const client of activeClients) {
    if (!sentChats.has(client.telegram_chat)) {
      await sendTelegram(client.telegram_chat, fullReport)
      sentChats.add(client.telegram_chat)
    }
  }

  console.log('✅ Morning report sent!')

  // Heartbeat
  await supabase.from('heartbeat_log').insert({
    script: 'morning-report',
    status: 'success',
    details: { clients: activeClients.map(c => c.short), dry_run: DRY_RUN },
  }).then(() => {}, () => {})
}

async function generateAIInsights(r, g) {
  const prompt = `Analiza estos datos operativos y da 3 prioridades del día en español. Máximo 4 líneas. Sin introducción.

TRAFICOS: ${r.totalTraficos} activos, ${r.enProceso} en proceso, ${r.cruzados} cruzados
ENTRADAS: ${r.totalEntradas} total, ${r.conFaltantes} con faltantes
PUENTE: ${r.avgBridge}h promedio
PENDIENTES: ${g.draftCount} borradores, ${g.solPending} solicitudes, ${g.stale48} >48h
SHADOW: ${g.shadowCount} emails clasificados
TC: ${g.exchangeRate || 'no disponible'}${g.tcExpired ? ' EXPIRADO' : ''}`

  return await callAIAnalysis(prompt)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
