#!/usr/bin/env node
// scripts/morning-report.js
// Daily morning report → Telegram
// Cron: 55 6 * * * node ~/evco-portal/scripts/morning-report.js

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://jkhpafacchjxawnscplf.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpraHBhZmFjY2hqeGF3bnNjcGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTkyNTUsImV4cCI6MjA4NTI5NTI1NX0.UukWb6CHAfjbhFPT-u0eM-UyAGNKDYSLpdrLgYw0qTw'

const TELEGRAM_BOT_TOKEN = '8625668778:AAE5uwQqc4ykwTNBTEvGTbmrjBOP68EW_y4'
const TELEGRAM_CHAT_ID = '-5085543275'

const COMPANY_ID = 'evco'
const CLAVE = '9254'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`Telegram error: ${JSON.stringify(json)}`)
  return json
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-US')
}

function fmtUSD(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

async function main() {
  console.log('Fetching data from Supabase...')

  // 1. Traficos
  const { data: traficos } = await supabase
    .from('traficos')
    .select('estatus, peso_bruto')
    .eq('company_id', COMPANY_ID)

  const traf = traficos || []
  const totalTraficos = traf.length
  const enProceso = traf.filter(t => t.estatus === 'En Proceso').length
  const cruzados = traf.filter(t => t.estatus === 'Cruzado').length
  const pesoTotal = traf.reduce((s, t) => s + (t.peso_bruto || 0), 0)

  // 2. Entradas
  const { data: entradas } = await supabase
    .from('entradas')
    .select('tiene_faltantes, mercancia_danada')
    .eq('company_id', COMPANY_ID)
    .limit(1000)

  const ent = entradas || []
  const totalEntradas = ent.length
  const conFaltantes = ent.filter(e => e.tiene_faltantes).length
  const conDanos = ent.filter(e => e.mercancia_danada).length

  // 3. Facturas
  const { data: facturas } = await supabase
    .from('aduanet_facturas')
    .select('valor_usd, pedimento')
    .eq('clave_cliente', CLAVE)

  const fact = facturas || []
  const valorUSD = fact.reduce((s, f) => s + (f.valor_usd || 0), 0)
  const pedimentos = new Set(fact.map(f => f.pedimento).filter(Boolean)).size

  // Format date
  const now = new Date()
  const cst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const day = dayNames[cst.getDay()]
  const dateStr = cst.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = cst.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

  const message = `🌅 BUENOS DÍAS TITO
Renato Zapata & Company · CRUZ 🦀
━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${day}, ${dateStr} · ${timeStr} CST

TRÁFICOS: ${fmtNum(totalTraficos)} activos
🟡 En Proceso: ${fmtNum(enProceso)}
🟢 Cruzados: ${fmtNum(cruzados)}
⚖️ Peso total: ${fmtNum(pesoTotal)} kg

ENTRADAS: ${fmtNum(totalEntradas)} total
⚠️ Con faltantes: ${fmtNum(conFaltantes)}
🔴 Con daños: ${fmtNum(conDanos)}

FINANCIERO:
💰 Valor acumulado: ${fmtUSD(valorUSD)} USD
📄 Pedimentos: ${fmtNum(pedimentos)}

GLOBALPC: ⏳ Whitelist pendiente
━━━━━━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`

  console.log(message)
  console.log('\nSending to Telegram...')
  await sendTelegram(message)
  console.log('✅ Morning report sent successfully!')

  // Mark heartbeat
  const { execSync } = require('child_process')
  try { execSync('node scripts/heartbeat.js --mark-morning-report', { cwd: process.cwd() }) } catch(e) {}
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
