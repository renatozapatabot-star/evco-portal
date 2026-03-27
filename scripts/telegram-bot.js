const TelegramBot = require('node-telegram-bot-api')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = '-5085543275'
const COMPANY_ID = 'evco'
const CLAVE = '9254'

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env.local')
  process.exit(1)
}

const bot = new TelegramBot(TOKEN, { polling: true })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function fmt(n) { return Number(n || 0).toLocaleString('es-MX') }
function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

// ── HANDLERS ──────────────────────────────────────────────

async function handleStatus() {
  const [trafRes, entRes, factRes] = await Promise.all([
    supabase.from('traficos').select('estatus, peso_bruto').eq('company_id', COMPANY_ID),
    supabase.from('entradas').select('tiene_faltantes, mercancia_danada').eq('company_id', COMPANY_ID),
    supabase.from('aduanet_facturas').select('valor_usd, igi, pedimento').eq('clave_cliente', CLAVE),
  ])

  const traf = trafRes.data || []
  const ent = entRes.data || []
  const fact = factRes.data || []

  const enProceso = traf.filter(t => t.estatus === 'En Proceso').length
  const cruzados = traf.filter(t => t.estatus === 'Cruzado').length
  const detenidos = traf.filter(t => t.estatus === 'Detenido').length
  const faltantes = ent.filter(e => e.tiene_faltantes).length
  const danos = ent.filter(e => e.mercancia_danada).length
  const valorTotal = fact.reduce((s, f) => s + (f.valor_usd || 0), 0)
  const pedimentos = new Set(fact.map(f => f.pedimento).filter(Boolean)).size
  const tmec = fact.filter(f => (f.igi || 0) === 0).length

  return [
    `📊 <b>STATUS — CRUZ</b>`,
    `EVCO Plastics · ${nowCST()}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<b>TRÁFICOS</b>`,
    `🟡 En Proceso: ${fmt(enProceso)}`,
    `🟢 Cruzados: ${fmt(cruzados)}`,
    detenidos > 0 ? `🔴 Detenidos: ${fmt(detenidos)}` : `✅ Sin detenidos`,
    ``,
    `<b>ENTRADAS: ${fmt(ent.length)}</b>`,
    faltantes > 0 ? `⚠️ Con faltantes: ${fmt(faltantes)}` : `✅ Sin faltantes`,
    danos > 0 ? `🔴 Con daños: ${fmt(danos)}` : `✅ Sin daños`,
    ``,
    `<b>FINANCIERO</b>`,
    `💰 Valor: ${fmtUSD(valorTotal)}`,
    `📄 Pedimentos: ${fmt(pedimentos)} (T-MEC: ${fmt(tmec)})`,
    ``,
    `🌐 evco-portal.vercel.app`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `— CRUZ 🦀`
  ].join('\n')
}

async function handleTraficos(search) {
  let q = supabase.from('traficos')
    .select('trafico, estatus, fecha_llegada, peso_bruto, pedimento')
    .eq('company_id', COMPANY_ID)
    .order('fecha_llegada', { ascending: false })
    .limit(5)

  if (search) q = q.ilike('trafico', `%${search}%`)

  const { data } = await q
  const rows = data || []

  if (rows.length === 0) return `❌ No se encontraron tráficos${search ? ` para "${search}"` : ''}`

  const lines = [`🚢 <b>TRÁFICOS RECIENTES</b>`, `━━━━━━━━━━━━━━━━━━━━`]
  rows.forEach(t => {
    const icon = t.estatus === 'Cruzado' ? '🟢' : t.estatus === 'Detenido' ? '🔴' : '🟡'
    lines.push(`${icon} <b>${t.trafico}</b>`)
    lines.push(`   ${t.estatus} · ${t.fecha_llegada ? new Date(t.fecha_llegada).toLocaleDateString('es-MX') : '—'}`)
    if (t.pedimento) lines.push(`   Ped: ${t.pedimento}`)
    if (t.peso_bruto) lines.push(`   ${fmt(t.peso_bruto)} kg`)
    lines.push(``)
  })
  lines.push(`— CRUZ 🦀`)
  return lines.join('\n')
}

async function handleEntradas() {
  const { data } = await supabase.from('entradas')
    .select('cve_entrada, descripcion_mercancia, fecha_llegada_mercancia, cantidad_bultos, peso_bruto, tiene_faltantes, trafico')
    .eq('company_id', COMPANY_ID)
    .order('fecha_llegada_mercancia', { ascending: false })
    .limit(5)

  const rows = data || []
  if (rows.length === 0) return '❌ Sin entradas recientes'

  const lines = [`📦 <b>ENTRADAS RECIENTES</b>`, `━━━━━━━━━━━━━━━━━━━━`]
  rows.forEach(e => {
    lines.push(`<b>${e.cve_entrada}</b> · ${e.fecha_llegada_mercancia ? new Date(e.fecha_llegada_mercancia).toLocaleDateString('es-MX') : '—'}`)
    if (e.descripcion_mercancia) lines.push(`   ${e.descripcion_mercancia.substring(0, 40)}`)
    lines.push(`   ${e.cantidad_bultos || '?'} bultos · ${e.peso_bruto ? fmt(e.peso_bruto) + ' kg' : '—'}`)
    if (e.tiene_faltantes) lines.push(`   ⚠️ CON FALTANTES`)
    if (e.trafico) lines.push(`   Tráfico: ${e.trafico}`)
    lines.push(``)
  })
  lines.push(`— CRUZ 🦀`)
  return lines.join('\n')
}

async function handleFinanciero() {
  const { data } = await supabase.from('aduanet_facturas')
    .select('valor_usd, dta, igi, iva, proveedor, fecha_pago, pedimento')
    .eq('clave_cliente', CLAVE)
    .order('fecha_pago', { ascending: false })
    .limit(100)

  const rows = data || []
  const total = rows.reduce((s, f) => s + (f.valor_usd || 0), 0)
  const totalIGI = rows.reduce((s, f) => s + (f.igi || 0), 0)
  const totalIVA = rows.reduce((s, f) => s + (f.iva || 0), 0)
  const totalDTA = rows.reduce((s, f) => s + (f.dta || 0), 0)
  const tmec = rows.filter(f => (f.igi || 0) === 0).length
  const peds = new Set(rows.map(f => f.pedimento).filter(Boolean)).size

  return [
    `💰 <b>RESUMEN FINANCIERO</b>`,
    `EVCO · Patente 3596 · Aduana 240`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Valor Total: <b>${fmtUSD(total)}</b>`,
    `DTA: ${fmtUSD(totalDTA * 0.057)}`,
    `IGI: ${totalIGI === 0 ? '✅ T-MEC $0' : fmtUSD(totalIGI * 0.057)}`,
    `IVA: ${fmtUSD(totalIVA * 0.057)}`,
    ``,
    `Pedimentos: ${fmt(peds)}`,
    `T-MEC aplicado: ${fmt(tmec)}/${fmt(rows.length)}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `— CRUZ 🦀`
  ].join('\n')
}

function handleHelp() {
  return [
    `🦀 <b>CRUZ — Comandos</b>`,
    `Renato Zapata &amp; Company`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `/status — Estado general del sistema`,
    `/traficos — Últimos 5 tráficos`,
    `/traficos [ID] — Buscar tráfico específico`,
    `/entradas — Últimas 5 entradas`,
    `/financiero — Resumen financiero`,
    `/help — Esta lista`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Portal: evco-portal.vercel.app`,
    `— CRUZ 🦀`
  ].join('\n')
}

// ── BOT LISTENERS ──────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🦀 <b>CRUZ activo</b>\nRenato Zapata &amp; Company\nEscribe /help para ver comandos`,
    { parse_mode: 'HTML' }
  )
})

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, handleHelp(), { parse_mode: 'HTML' })
})

bot.onText(/\/status/, async (msg) => {
  try {
    const reply = await handleStatus()
    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'HTML' })
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

bot.onText(/\/traficos(.*)/, async (msg, match) => {
  try {
    const search = match[1]?.trim() || null
    const reply = await handleTraficos(search)
    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'HTML' })
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

bot.onText(/\/entradas/, async (msg) => {
  try {
    const reply = await handleEntradas()
    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'HTML' })
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

bot.onText(/\/financiero/, async (msg) => {
  try {
    const reply = await handleFinanciero()
    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'HTML' })
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

bot.on('polling_error', (err) => console.error('Polling error:', err.message))

console.log('🦀 CRUZ Telegram bot running...')
console.log('Commands: /start /help /status /traficos /entradas /financiero')
console.log('Press Ctrl+C to stop')
