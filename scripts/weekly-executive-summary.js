const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'
const CLAVE = '9254'

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function fmtNum(n) { return Number(n || 0).toLocaleString('es-MX') }
function arrow(curr, prev) {
  if (!prev || prev === 0) return ''
  const pct = ((curr - prev) / prev * 100).toFixed(1)
  return Number(pct) >= 0 ? ` ↑${pct}%` : ` ↓${Math.abs(pct)}%`
}

function getWeekRange(weeksAgo = 0) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - (weeksAgo * 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
    label: monday.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) +
           ' – ' + sunday.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
  }
}

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
  console.log('✅ Executive summary sent to Telegram')
}

async function getWeekStats(start, end) {
  const [trafRes, entRes, factRes] = await Promise.all([
    supabase.from('traficos')
      .select('estatus, peso_bruto')
      .eq('company_id', COMPANY_ID)
      .gte('fecha_llegada', start)
      .lte('fecha_llegada', end),
    supabase.from('entradas')
      .select('peso_bruto, tiene_faltantes, mercancia_danada')
      .eq('company_id', COMPANY_ID)
      .gte('fecha_llegada_mercancia', start)
      .lte('fecha_llegada_mercancia', end),
    supabase.from('aduanet_facturas')
      .select('valor_usd, igi, dta, iva')
      .eq('clave_cliente', CLAVE)
      .gte('fecha_pago', start)
      .lte('fecha_pago', end),
  ])

  const traf = trafRes.data || []
  const ent = entRes.data || []
  const fact = factRes.data || []

  return {
    traficos: traf.length,
    cruzados: traf.filter(t => t.estatus === 'Cruzado').length,
    detenidos: traf.filter(t => t.estatus === 'Detenido').length,
    entradas: ent.length,
    faltantes: ent.filter(e => e.tiene_faltantes).length,
    danos: ent.filter(e => e.mercancia_danada).length,
    peso: traf.reduce((s, t) => s + (t.peso_bruto || 0), 0),
    valor: fact.reduce((s, f) => s + (f.valor_usd || 0), 0),
    gravamen: fact.reduce((s, f) => s + (f.dta || 0) + (f.igi || 0) + (f.iva || 0), 0),
    tmec: fact.filter(f => (f.igi || 0) === 0).length,
    pedimentos: fact.length,
  }
}

async function runWeeklyExecutiveSummary() {
  console.log('📊 Generating Weekly Executive Summary...')

  const thisWeek = getWeekRange(0)
  const lastWeek = getWeekRange(1)

  const [curr, prev] = await Promise.all([
    getWeekStats(thisWeek.start, thisWeek.end),
    getWeekStats(lastWeek.start, lastWeek.end),
  ])

  console.log(`This week (${thisWeek.label}): ${curr.traficos} tráficos · ${fmtUSD(curr.valor)}`)
  console.log(`Last week (${lastWeek.label}): ${prev.traficos} tráficos · ${fmtUSD(prev.valor)}`)

  // Determine week trend
  const valorTrend = prev.valor > 0 ? ((curr.valor - prev.valor) / prev.valor * 100) : 0
  const trendIcon = valorTrend >= 10 ? '🚀' : valorTrend >= 0 ? '📈' : valorTrend >= -10 ? '📉' : '⚠️'
  const trendLabel = valorTrend >= 0 ? `+${valorTrend.toFixed(1)}%` : `${valorTrend.toFixed(1)}%`

  // Issues this week
  const issues = []
  if (curr.detenidos > 0) issues.push(`🔴 ${curr.detenidos} tráfico${curr.detenidos > 1 ? 's' : ''} detenido${curr.detenidos > 1 ? 's' : ''}`)
  if (curr.faltantes > 0) issues.push(`⚠️ ${fmtNum(curr.faltantes)} entradas con faltantes`)
  if (curr.danos > 0) issues.push(`⚠️ ${fmtNum(curr.danos)} entradas con daños`)

  const message = [
    `📊 <b>RESUMEN SEMANAL — TITO</b>`,
    `Renato Zapata &amp; Company · CRUZ 🦀`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📅 Semana: ${thisWeek.label}`,
    ``,
    `${trendIcon} <b>VALOR IMPORTADO</b>`,
    `Esta semana: <b>${fmtUSD(curr.valor)}</b> <code>${trendLabel} vs semana anterior</code>`,
    `Semana anterior: ${fmtUSD(prev.valor)}`,
    ``,
    `<b>OPERACIONES</b>`,
    `🚢 Tráficos: ${fmtNum(curr.traficos)}${arrow(curr.traficos, prev.traficos)}`,
    `📦 Entradas: ${fmtNum(curr.entradas)}${arrow(curr.entradas, prev.entradas)}`,
    `⚖️ Peso: ${fmtNum(Math.round(curr.peso))} kg`,
    ``,
    `<b>FINANZAS</b>`,
    `Pedimentos: ${fmtNum(curr.pedimentos)}`,
    `T-MEC aplicado: ${curr.tmec}/${curr.pedimentos}`,
    curr.gravamen > 0 ? `Gravamen total: ${fmtUSD(curr.gravamen)}` : `IGI: T-MEC $0 ✅`,
    ``,
    issues.length > 0
      ? `<b>INCIDENCIAS:</b>\n${issues.join('\n')}`
      : `✅ Sin incidencias esta semana`,
    ``,
    `Reporte completo: evco-portal.vercel.app`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `— CRUZ 🦀`
  ].join('\n')

  await sendTelegram(message)
  console.log('✅ Done')
}

runWeeklyExecutiveSummary().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
