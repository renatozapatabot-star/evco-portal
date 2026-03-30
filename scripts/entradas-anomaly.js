const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

function fmt(n) { return Number(n || 0).toLocaleString('es-MX') }
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}
function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function runEntradasAnomaly() {
  console.log('🔍 Running Entradas Anomaly Report...')

  // Pull last 30 days of entradas
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data, error } = await supabase
    .from('entradas')
    .select('cve_entrada, descripcion_mercancia, fecha_llegada_mercancia, cantidad_bultos, peso_bruto, tiene_faltantes, mercancia_danada, recibio_facturas, recibio_packing_list, trafico, transportista_americano, transportista_mexicano')
    .eq('company_id', COMPANY_ID)
    .gte('fecha_llegada_mercancia', since.toISOString().split('T')[0])
    .order('fecha_llegada_mercancia', { ascending: false })

  if (error) { console.error('Supabase error:', error); return }

  const entradas = data || []
  console.log(`📋 Analyzing ${entradas.length} entradas (last 30 days)`)

  const conFaltantes = entradas.filter(e => e.tiene_faltantes === true)
  const conDanos = entradas.filter(e => e.mercancia_danada === true)
  const sinFacturas = entradas.filter(e => e.recibio_facturas === false)
  const sinPacking = entradas.filter(e => e.recibio_packing_list === false)

  const hasIssues = conFaltantes.length > 0 || conDanos.length > 0 || sinFacturas.length > 0 || sinPacking.length > 0

  console.log(`  Con faltantes: ${conFaltantes.length}`)
  console.log(`  Con daños: ${conDanos.length}`)
  console.log(`  Sin facturas: ${sinFacturas.length}`)
  console.log(`  Sin packing list: ${sinPacking.length}`)

  if (!hasIssues) {
    console.log('✅ No anomalies found')
    return
  }

  const lines = [
    `🔍 <b>ENTRADAS — ANOMALÍAS DETECTADAS</b>`,
    `${nowCST()} · Últimos 30 días`,
    `Total revisadas: ${fmt(entradas.length)}`,
    ``
  ]

  if (conFaltantes.length > 0) {
    lines.push(`<b>⚠️ CON FALTANTES: ${conFaltantes.length}</b>`)
    conFaltantes.slice(0, 5).forEach(e => {
      lines.push(`  • ${e.cve_entrada} · ${fmtDate(e.fecha_llegada_mercancia)}`)
      if (e.trafico) lines.push(`    Tráfico: ${e.trafico}`)
      if (e.descripcion_mercancia) lines.push(`    ${e.descripcion_mercancia.substring(0, 50)}`)
    })
    if (conFaltantes.length > 5) lines.push(`  ... y ${conFaltantes.length - 5} más`)
    lines.push(``)
  }

  if (conDanos.length > 0) {
    lines.push(`<b>🔴 CON DAÑOS: ${conDanos.length}</b>`)
    conDanos.slice(0, 5).forEach(e => {
      lines.push(`  • ${e.cve_entrada} · ${fmtDate(e.fecha_llegada_mercancia)}`)
      if (e.trafico) lines.push(`    Tráfico: ${e.trafico}`)
    })
    if (conDanos.length > 5) lines.push(`  ... y ${conDanos.length - 5} más`)
    lines.push(``)
  }

  if (sinFacturas.length > 0) {
    lines.push(`<b>📄 SIN FACTURAS: ${sinFacturas.length}</b>`)
    sinFacturas.slice(0, 3).forEach(e => {
      lines.push(`  • ${e.cve_entrada} · ${fmtDate(e.fecha_llegada_mercancia)}`)
    })
    lines.push(``)
  }

  if (sinPacking.length > 0) {
    lines.push(`<b>📋 SIN PACKING LIST: ${sinPacking.length}</b>`)
    sinPacking.slice(0, 3).forEach(e => {
      lines.push(`  • ${e.cve_entrada} · ${fmtDate(e.fecha_llegada_mercancia)}`)
    })
    lines.push(``)
  }

  lines.push(`Acción: Revisar con Ursula Banda`)
  lines.push(`— CRUZ 🦀`)

  await sendTelegram(lines.join('\n'))
  console.log(`⚠️  ${conFaltantes.length} faltantes · ${conDanos.length} daños · ${sinFacturas.length} sin facturas`)
}

runEntradasAnomaly().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
