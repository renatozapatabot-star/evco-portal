#!/usr/bin/env node
// scripts/morning-report.js
// Multi-client daily morning report → Telegram
// Cron: 55 6 * * * node ~/evco-portal/scripts/morning-report.js

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = 'https://jkhpafacchjxawnscplf.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpraHBhZmFjY2hqeGF3bnNjcGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTkyNTUsImV4cCI6MjA4NTI5NTI1NX0.UukWb6CHAfjbhFPT-u0eM-UyAGNKDYSLpdrLgYw0qTw'

const TELEGRAM_BOT_TOKEN = '8625668778:AAE5uwQqc4ykwTNBTEvGTbmrjBOP68EW_y4'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── MULTI-CLIENT CONFIG ──────────────────────────────
const CLIENTS = [
  {
    name: 'EVCO Plastics de Mexico',
    company_id: 'evco',
    clave: '9254',
    rfc: 'EPM001109I74',
    telegram_chat: '-5085543275',
    portal_url: 'https://evco-portal.vercel.app',
    active: true,
  },
  {
    name: 'MAFESA',
    company_id: 'mafesa',
    clave: 'TBD',
    rfc: 'TBD',
    telegram_chat: '-5085543275',
    portal_url: 'https://mafesa-portal.vercel.app',
    active: false, // activate when onboarded
  },
]

// Allow override via env var
const CLIENT_FILTER = process.env.CLIENT_ID

// ── AI ANALYSIS CONFIG ──
const OLLAMA_URL = 'http://127.0.0.1:11434'
const AI_MODEL = 'qwen3:8b'

async function sendTelegram(chatId, text) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`Telegram error: ${JSON.stringify(json)}`)
  return json
}

async function callAIAnalysis(prompt) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 500 }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`AI endpoint error: ${response.status} - ${errorText}`)
      return null
    }
    
    const result = await response.json()
    return result.response || null
  } catch (err) {
    console.warn(`AI analysis failed: ${err.message}`)
    return null
  }
}

function fmtNum(n) { return Number(n || 0).toLocaleString('en-US') }
function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }

async function getClientReport(client) {
  // 1. Traficos
  const { data: traficos } = await supabase
    .from('traficos').select('estatus, peso_bruto, risk_score, deadline')
    .eq('company_id', client.company_id)
  const traf = traficos || []
  const totalTraficos = traf.length
  const enProceso = traf.filter(t => t.estatus === 'En Proceso').length
  const cruzados = traf.filter(t => (t.estatus || '').toLowerCase().includes('cruz')).length
  const pesoTotal = traf.reduce((s, t) => s + (t.peso_bruto || 0), 0)
  const highRisk = traf.filter(t => (t.risk_score || 0) >= 70).length

  // 2. Entradas
  const { data: entradas } = await supabase
    .from('entradas').select('tiene_faltantes, mercancia_danada')
    .eq('company_id', client.company_id).limit(1000)
  const ent = entradas || []
  const totalEntradas = ent.length
  const conFaltantes = ent.filter(e => e.tiene_faltantes).length
  const conDanos = ent.filter(e => e.mercancia_danada).length

  // 3. Entradas overnight (from entrada_lifecycle)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStart = yesterday.toISOString().split('T')[0]
  const tomorrow = new Date(yesterday)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStart = tomorrow.toISOString().split('T')[0]
  
  const { data: overnightEntradas } = await supabase
    .from('entrada_lifecycle')
    .select('id, created_at, status')
    .eq('company_id', client.company_id)
    .gte('created_at', yesterdayStart)
    .lt('created_at', tomorrowStart)
  const overnightCount = overnightEntradas?.length || 0

  // 4. Documents processed by email-intelligence
  const { data: emailDocs } = await supabase
    .from('email_intelligence')
    .select('id, processed_at, status')
    .eq('company_id', client.company_id)
    .gte('processed_at', yesterdayStart)
    .lt('processed_at', tomorrowStart)
  const emailDocsProcessed = emailDocs?.length || 0

  // 5. Anomalies detected by anomaly-check
  const { data: anomalies } = await supabase
    .from('anomaly_check')
    .select('id, detected_at, severity, description')
    .eq('company_id', client.company_id)
    .gte('detected_at', yesterdayStart)
    .lt('processed_at', tomorrowStart)
  const anomalyCount = anomalies?.length || 0
  const highSeverityAnomalies = anomalies?.filter(a => a.severity === 'high')?.length || 0

  // 6. Bridge average wait times
  const { data: bridgeData } = await supabase
    .from('bridge_wait_times')
    .select('wait_minutes')
    .eq('company_id', client.company_id)
    .gte('recorded_at', yesterdayStart)
    .lt('recorded_at', tomorrowStart)
  const bridgeWaitTimes = bridgeData?.map(d => d.wait_minutes) || []
  const avgWaitTime = bridgeWaitTimes.length > 0 
    ? Math.round(bridgeWaitTimes.reduce((a, b) => a + b, 0) / bridgeWaitTimes.length)
    : 0

  // 7. Deadlines within 7 days
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0]
  
  const { data: upcomingDeadlines } = await supabase
    .from('traficos')
    .select('trafico_id, deadline, description')
    .eq('company_id', client.company_id)
    .gte('deadline', yesterdayStart)
    .lte('deadline', sevenDaysStr)
    .eq('estatus', 'En Proceso')
  const upcomingDeadlinesCount = upcomingDeadlines?.length || 0

  // 8. Facturas / Financial
  const { data: facturas } = await supabase
    .from('aduanet_facturas').select('valor_usd, pedimento')
    .eq('clave_cliente', client.clave)
  const fact = facturas || []
  const valorUSD = fact.reduce((s, f) => s + (f.valor_usd || 0), 0)
  const pedimentos = new Set(fact.map(f => f.pedimento).filter(Boolean)).size

  // 9. Document sync status
  const { count: docCount } = await supabase
    .from('documents').select('*', { count: 'exact', head: true })
  const { count: expDocCount } = await supabase
    .from('expediente_documentos').select('*', { count: 'exact', head: true })
    .eq('company_id', client.company_id)

  // 10. Call transcripts from yesterday
  const { count: callCount } = await supabase
    .from('call_transcripts').select('*', { count: 'exact', head: true })
    .eq('company_id', client.company_id)
    .gte('transcribed_at', yesterday.toISOString().split('T')[0])

  // 11. Top 3 risks
  const topRisks = traf
    .filter(t => (t.risk_score || 0) > 0)
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 3)

  return {
    totalTraficos, enProceso, cruzados, pesoTotal, highRisk,
    totalEntradas, conFaltantes, conDanos,
    overnightEntradas: overnightCount,
    emailDocsProcessed,
    anomalyCount, highSeverityAnomalies,
    avgWaitTime,
    upcomingDeadlinesCount,
    valorUSD, pedimentos,
    docCount: docCount || 0, expDocCount: expDocCount || 0,
    callCount: callCount || 0,
    topRisks,
  }
}

async function generateAIInsights(reportData) {
  const prompt = `Analiza estos datos operativos del día y proporciona insights accionables en formato conciso:

TRAFFICOS: ${reportData.totalTraficos} activos, ${reportData.enProceso} en proceso, ${reportData.cruzados} cruzados
ENTRADAS: ${reportData.totalEntradas} total, ${reportData.conFaltantes} con faltantes, ${reportData.conDanos} con daños
OVERNIGHT: ${reportData.overnightEntradas} entradas recibidas
DOCUMENTOS: ${reportData.emailDocsProcessed} procesados por email-intelligence
ANOMALIAS: ${reportData.anomalyCount} detectadas (${reportData.highSeverityAnomalies} alta prioridad)
PUENTE: ${reportData.avgWaitTime} min promedio de espera
PLAZOS: ${reportData.upcomingDeadlinesCount} vencen en 7 días
RIESGOS: ${reportData.highRisk} alto riesgo

Proporciona:
1. Prioridades del día
2. Alertas críticas
3. Recomendaciones`

  const analysis = await callAIAnalysis(prompt)
  return analysis || 'Análisis no disponible'
}

async function main() {
  console.log('Multi-Client Morning Report — CRUZ')

  const now = new Date()
  const cst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
  const day = dayNames[cst.getDay()]
  const dateStr = cst.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = cst.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

  const activeClients = CLIENTS.filter(c => {
    if (CLIENT_FILTER) return c.company_id === CLIENT_FILTER
    return c.active
  })

  let fullReport = `🌅 BUENOS DIAS TITO
Renato Zapata & Company · CRUZ 🦀
━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${day}, ${dateStr} · ${timeStr} CST
${activeClients.length} cliente(s) activo(s)\n`

  let allRisks = []

  for (const client of activeClients) {
    console.log(`Fetching data for ${client.name}...`)
    const r = await getClientReport(client)

    fullReport += `
━━━ ${client.name.toUpperCase()} ━━━
TRAFICOS: ${fmtNum(r.totalTraficos)} activos
🟡 En Proceso: ${fmtNum(r.enProceso)}
🟢 Cruzados: ${fmtNum(r.cruzados)}
⚖️ Peso total: ${fmtNum(r.pesoTotal)} kg
${r.highRisk > 0 ? `🔴 Alto riesgo: ${r.highRisk}` : ''}

ENTRADAS: ${fmtNum(r.totalEntradas)} total
⚠️ Con faltantes: ${fmtNum(r.conFaltantes)}
🔴 Con danos: ${fmtNum(r.conDanos)}
🌙 Overnight: ${fmtNum(r.overnightEntradas)}

SYNC STATUS:
📁 Documentos: ${fmtNum(r.docCount)} en storage
📋 Expedientes: ${fmtNum(r.expDocCount)} indexados
📧 Email-intelligence: ${fmtNum(r.emailDocsProcessed)} procesados
🔍 Anomalías: ${fmtNum(r.anomalyCount)} (${r.highSeverityAnomalies} alta)
⏱️ Puente: ${r.avgWaitTime} min promedio
📅 Vencen 7 días: ${fmtNum(r.upcomingDeadlinesCount)}

FINANCIERO:
💰 Valor acumulado: ${fmtUSD(r.valorUSD)} USD
📄 Pedimentos: ${fmtNum(r.pedimentos)}
📞 Llamadas ayer: ${r.callCount}`

    allRisks.push(...r.topRisks.map(t => ({ ...t, client: client.name })))
  }

  // AI Analysis
  const aiInsights = await generateAIInsights({
    totalTraficos: 0, enProceso: 0, cruzados: 0,
    conFaltantes: 0, conDanos: 0,
    overnightEntradas: 0, emailDocsProcessed: 0,
    anomalyCount: 0, highSeverityAnomalies: 0,
    avgWaitTime: 0, upcomingDeadlinesCount: 0,
    highRisk: 0
  })
  
  if (aiInsights) {
    fullReport += `\n\n🤖 ANÁLISIS CRUZ:\n${aiInsights}`
  }

  // Top 3 risks across all clients
  allRisks.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
  if (allRisks.length > 0) {
    fullReport += `\n\n🚨 TOP RIESGOS:`
    allRisks.slice(0, 3).forEach((r, i) => {
      fullReport += `\n  ${i + 1}. Score ${r.risk_score} — ${r.client}`
    })
  }

  fullReport += `
━━━━━━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`

  console.log(fullReport)
  console.log('\nSending to Telegram...')

  // Send to each client's chat (and main Tito chat)
  const sentChats = new Set()
  for (const client of activeClients) {
    if (!sentChats.has(client.telegram_chat)) {
      await sendTelegram(client.telegram_chat, fullReport)
      sentChats.add(client.telegram_chat)
    }
  }

  console.log('✅ Morning report sent successfully!')

  // Mark heartbeat
  const { execSync } = require('child_process')
  try { execSync('node scripts/heartbeat.js --mark-morning-report', { cwd: path.join(__dirname, '..') }) } catch(e) {}
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
