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
const TMEC_COUNTRIES = new Set(['USA', 'CAN', 'MEX'])

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function fmtNum(n) { return Number(n || 0).toLocaleString('es-MX') }

async function sendTG(msg) {
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

async function fetchAll(table, select, filters, extra) {
  let all = []
  let offset = 0
  const BATCH = 1000
  while (true) {
    let q = supabase.from(table).select(select).range(offset, offset + BATCH - 1)
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v)
    if (extra) q = extra(q)
    const { data, error } = await q
    if (error) { console.error(`  Error fetching ${table}:`, error.message); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < BATCH) break
    offset += BATCH
  }
  return all
}

async function runTMECGuardian() {
  console.log('🛡️  T-MEC Guardian v2 — GlobalPC Cross-Reference\n')

  // ── Step 1: Build high-priority fraccion set dynamically ──
  console.log('── Step 1: Building high-priority fraccion set from IGI data')

  const facturas = await fetchAll(
    'aduanet_facturas',
    'pedimento, valor_usd, igi',
    { clave_cliente: CLAVE }
  )

  // Group IGI by pedimento
  const pedIGI = {}
  facturas.forEach(f => {
    if (!f.pedimento) return
    if (!pedIGI[f.pedimento]) pedIGI[f.pedimento] = { igi: 0, valor: 0, ops: 0, tmec: 0 }
    pedIGI[f.pedimento].igi += f.igi || 0
    pedIGI[f.pedimento].valor += f.valor_usd || 0
    pedIGI[f.pedimento].ops++
    if ((f.igi || 0) === 0) pedIGI[f.pedimento].tmec++
  })

  // Get fracciones from globalpc_productos with their proveedor mapping
  const productos = await fetchAll(
    'globalpc_productos',
    'cve_producto, cve_proveedor, fraccion, pais_origen',
    { cve_cliente: CLAVE }
  )
  const prodWithFrac = productos.filter(p => p.fraccion)

  // Build fraccion→stats from partidas
  const partidas = await fetchAll(
    'globalpc_partidas',
    'folio, cve_proveedor, cve_producto, precio_unitario, cantidad, pais_origen',
    { cve_cliente: CLAVE }
  )

  // producto lookup
  const prodLookup = {}
  prodWithFrac.forEach(p => {
    prodLookup[`${p.cve_proveedor}|${p.cve_producto}`] = p
  })

  // Build fraccion stats from partidas
  const fracStats = {}
  partidas.forEach(p => {
    const prod = prodLookup[`${p.cve_proveedor}|${p.cve_producto}`]
    if (!prod) return
    const frac = prod.fraccion
    if (!fracStats[frac]) fracStats[frac] = { valor: 0, ops: 0, tmec_eligible: 0, non_tmec: 0 }
    const valor = (p.precio_unitario || 0) * (p.cantidad || 1)
    const origin = prod.pais_origen || p.pais_origen || ''
    fracStats[frac].valor += valor
    fracStats[frac].ops++
    if (TMEC_COUNTRIES.has(origin)) fracStats[frac].tmec_eligible++
    else fracStats[frac].non_tmec++
  })

  // High-priority = fracciones with >$50K valor and some T-MEC eligible products
  const highPriorityFracs = new Set()
  Object.entries(fracStats).forEach(([frac, s]) => {
    if (s.valor > 50000 && s.tmec_eligible > 0) highPriorityFracs.add(frac)
  })

  console.log(`   Productos with fraccion: ${fmtNum(prodWithFrac.length)}`)
  console.log(`   Partidas analyzed: ${fmtNum(partidas.length)}`)
  console.log(`   High-priority fracciones: ${highPriorityFracs.size}`)
  console.log(`   (fracciones with >$50K valor + T-MEC eligible origin)\n`)

  // ── Step 2: Get active traficos ──
  console.log('── Step 2: Checking active traficos (En Proceso)')

  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico, descripcion_mercancia, fecha_llegada, pedimento, importe_total')
    .eq('company_id', COMPANY_ID)
    .eq('estatus', 'En Proceso')
    .order('fecha_llegada', { ascending: false })
    .limit(500)

  const activeTraficos = traficos || []
  console.log(`   Active traficos: ${activeTraficos.length}\n`)

  // ── Step 3: For each active trafico, check partidas → fraccion → origin ──
  console.log('── Step 3: Cross-referencing partidas per trafico\n')

  // Build folio→trafico mapping from globalpc_facturas
  const { data: gpcFacturas } = await supabase
    .from('globalpc_facturas')
    .select('folio, cve_trafico')
    .eq('cve_cliente', CLAVE)
    .limit(5000)

  const folioToTrafico = {}
  const traficoToFolios = {}
  ;(gpcFacturas || []).forEach(f => {
    folioToTrafico[f.folio] = f.cve_trafico
    if (!traficoToFolios[f.cve_trafico]) traficoToFolios[f.cve_trafico] = []
    traficoToFolios[f.cve_trafico].push(f.folio)
  })

  // Build folio→partidas lookup
  const partidasByFolio = {}
  partidas.forEach(p => {
    if (!partidasByFolio[p.folio]) partidasByFolio[p.folio] = []
    partidasByFolio[p.folio].push(p)
  })

  // Get existing USMCA docs
  const { data: usmcaDocs } = await supabase
    .from('documents')
    .select('trafico_id, doc_type')
    .in('doc_type', ['usmca_cert', 'certificado_origen'])

  const hasUSMCA = new Set((usmcaDocs || []).map(d => d.trafico_id))

  const alerts = []
  let checked = 0

  for (const t of activeTraficos) {
    const folios = traficoToFolios[t.trafico] || []
    if (folios.length === 0) continue

    checked++
    let traficoFracs = new Set()
    let tmecEligibleItems = 0
    let totalItems = 0
    let totalValor = 0
    let highPriorityHits = []

    for (const folio of folios) {
      const parts = partidasByFolio[folio] || []
      for (const p of parts) {
        totalItems++
        const prod = prodLookup[`${p.cve_proveedor}|${p.cve_producto}`]
        if (!prod) continue

        const frac = prod.fraccion
        const origin = prod.pais_origen || p.pais_origen || ''
        const valor = (p.precio_unitario || 0) * (p.cantidad || 1)
        totalValor += valor

        if (frac) traficoFracs.add(frac)

        if (TMEC_COUNTRIES.has(origin)) {
          tmecEligibleItems++

          if (highPriorityFracs.has(frac) && !hasUSMCA.has(t.trafico)) {
            highPriorityHits.push({
              fraccion: frac,
              producto: p.cve_producto?.substring(0, 30),
              proveedor: p.cve_proveedor,
              origen: origin,
              valor,
            })
          }
        }
      }
    }

    if (highPriorityHits.length > 0) {
      const topFracs = [...new Set(highPriorityHits.map(h => h.fraccion))].slice(0, 3)
      const hitValor = highPriorityHits.reduce((s, h) => s + h.valor, 0)

      alerts.push({
        trafico: t.trafico,
        fecha: t.fecha_llegada,
        desc: (t.descripcion_mercancia || '').substring(0, 50),
        pedimento: t.pedimento,
        importe: t.importe_total,
        totalItems,
        tmecEligible: tmecEligibleItems,
        highPriorityHits: highPriorityHits.length,
        topFracs,
        hitValor,
        hasUSMCA: hasUSMCA.has(t.trafico),
      })
    }
  }

  console.log(`   Traficos with partida data: ${checked}`)
  console.log(`   Traficos needing USMCA cert: ${alerts.length}`)

  // ── Step 4: Output ──
  console.log('\n' + '='.repeat(70))

  if (alerts.length === 0) {
    console.log('\n✅ All active traficos with high-priority fracciones have USMCA coverage')
    console.log('   (or no T-MEC-eligible items found)\n')

    await sendTG([
      `🛡️ <b>T-MEC GUARDIAN — OK</b>`,
      `${activeTraficos.length} traficos activos revisados`,
      `${checked} con datos de partidas`,
      `${highPriorityFracs.size} fracciones prioritarias monitoreadas`,
      `✅ Sin alertas`,
      `— CRUZ 🦀`,
    ].join('\n'))
    return
  }

  // Sort by hit value descending
  alerts.sort((a, b) => b.hitValor - a.hitValor)

  console.log(`\n⚠️  ${alerts.length} TRAFICOS NECESITAN CERTIFICADO USMCA\n`)

  alerts.forEach((a, i) => {
    console.log(`${i + 1}. ${a.trafico}`)
    console.log(`   ${a.desc}`)
    console.log(`   Fecha: ${a.fecha || '—'} | Pedimento: ${a.pedimento || 'Sin asignar'}`)
    console.log(`   Items: ${a.totalItems} total, ${a.tmecEligible} T-MEC elegibles`)
    console.log(`   High-priority hits: ${a.highPriorityHits} items | Valor: ${fmtUSD(a.hitValor)}`)
    console.log(`   Fracciones: ${a.topFracs.join(', ')}`)
    console.log(`   USMCA cert: ${a.hasUSMCA ? '✅' : '❌ FALTA'}`)
    console.log()
  })

  const totalHitValor = alerts.reduce((s, a) => s + a.hitValor, 0)

  console.log('='.repeat(70))
  console.log('\nSUMMARY')
  console.log(`  Traficos activos:          ${activeTraficos.length}`)
  console.log(`  Con datos de partidas:     ${checked}`)
  console.log(`  Necesitan USMCA cert:      ${alerts.length}`)
  console.log(`  Fracciones prioritarias:   ${highPriorityFracs.size}`)
  console.log(`  Valor en riesgo de IGI:    ${fmtUSD(totalHitValor)}`)
  console.log(`  (IGI estimado ~5%):        ${fmtUSD(totalHitValor * 0.05)}`)

  // Telegram alert
  const tgLines = [
    `🛡️ <b>T-MEC GUARDIAN — ALERTA</b>`,
    `${alerts.length} trafico(s) sin certificado USMCA`,
    `Valor en riesgo: <b>${fmtUSD(totalHitValor)}</b>`,
    `IGI estimado: ${fmtUSD(totalHitValor * 0.05)}`,
    ``,
  ]

  alerts.slice(0, 8).forEach(a => {
    tgLines.push(`⚠️ <b>${a.trafico}</b>`)
    tgLines.push(`   ${a.topFracs.join(', ')} · ${fmtUSD(a.hitValor)}`)
    tgLines.push(`   ${a.tmecEligible} items T-MEC elegibles · Cert: ❌`)
  })

  if (alerts.length > 8) tgLines.push(`\n... y ${alerts.length - 8} mas`)

  tgLines.push(``, `Accion: Solicitar certificados USMCA antes de transmitir pedimentos`)
  tgLines.push(`— CRUZ 🦀`)

  await sendTG(tgLines.join('\n'))
  console.log(`\n✅ Alert sent to Telegram`)
}

module.exports = { runTMECGuardian }
runTMECGuardian().catch(err => { console.error('Fatal:', err); process.exit(1) })
