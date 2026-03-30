const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const CLAVE = '9254'

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function fmtNum(n) { return Number(n || 0).toLocaleString('es-MX') }

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function fetchAll(table, select, filters) {
  let all = []
  let offset = 0
  const BATCH = 1000
  while (true) {
    let q = supabase.from(table).select(select).range(offset, offset + BATCH - 1)
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v)
    const { data, error } = await q
    if (error) { console.error(`Error fetching ${table}:`, error.message); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < BATCH) break
    offset += BATCH
  }
  return all
}

async function runFraccionIntelligence() {
  console.log('📊 Running Fraccion Intelligence Analysis (v2 — GlobalPC + Aduanet)\n')

  // ── Phase 1: Pull real fracciones from globalpc_productos ──
  console.log('── Phase 1: GlobalPC Productos (fracciones arancelarias)')
  const productos = await fetchAll(
    'globalpc_productos',
    'cve_producto, cve_proveedor, descripcion, fraccion, nico, pais_origen',
    { cve_cliente: CLAVE }
  )
  const prodWithFraccion = productos.filter(p => p.fraccion)
  console.log(`   Total productos: ${fmtNum(productos.length)}`)
  console.log(`   Con fraccion: ${fmtNum(prodWithFraccion.length)}`)

  // ── Phase 2: Pull partidas for volume/value context ──
  console.log('\n── Phase 2: GlobalPC Partidas (volume/pricing)')
  const partidas = await fetchAll(
    'globalpc_partidas',
    'folio, cve_proveedor, cve_producto, precio_unitario, cantidad, peso, pais_origen',
    { cve_cliente: CLAVE }
  )
  console.log(`   Total partidas: ${fmtNum(partidas.length)}`)

  // Build producto→fraccion lookup
  const prodToFraccion = {}
  prodWithFraccion.forEach(p => {
    const key = `${p.cve_proveedor}|${p.cve_producto}`
    prodToFraccion[key] = { fraccion: p.fraccion, nico: p.nico, pais: p.pais_origen, desc: p.descripcion }
  })

  // ── Phase 3: Pull aduanet_facturas for IGI/T-MEC data ──
  console.log('\n── Phase 3: Aduanet Facturas (IGI/T-MEC data)')
  const facturas = await fetchAll(
    'aduanet_facturas',
    'pedimento, valor_usd, igi, dta, iva, fecha_pago, proveedor, referencia',
    { clave_cliente: CLAVE }
  )
  console.log(`   Total facturas: ${fmtNum(facturas.length)}`)

  // ── Phase 4: Enrich partidas with fraccion data ──
  console.log('\n── Phase 4: Cross-referencing fracciones con partidas\n')

  const fraccionMap = {}
  let matched = 0, unmatched = 0

  partidas.forEach(p => {
    const key = `${p.cve_proveedor}|${p.cve_producto}`
    const prod = prodToFraccion[key]
    if (!prod) { unmatched++; return }
    matched++

    const frac = prod.fraccion
    if (!fraccionMap[frac]) {
      fraccionMap[frac] = {
        fraccion: frac,
        nico: prod.nico,
        ops: 0,
        total_valor: 0,
        total_peso: 0,
        total_qty: 0,
        proveedores: new Set(),
        productos: new Set(),
        paises: new Set(),
        descriptions: new Set(),
      }
    }
    const fr = fraccionMap[frac]
    fr.ops++
    fr.total_valor += (p.precio_unitario || 0) * (p.cantidad || 1)
    fr.total_peso += p.peso || 0
    fr.total_qty += p.cantidad || 0
    if (p.cve_proveedor) fr.proveedores.add(p.cve_proveedor)
    if (p.cve_producto) fr.productos.add(p.cve_producto)
    if (prod.pais) fr.paises.add(prod.pais)
    if (prod.desc && fr.descriptions.size < 3) fr.descriptions.add(prod.desc.substring(0, 50))
  })

  console.log(`   Partidas matched to fraccion: ${fmtNum(matched)}`)
  console.log(`   Partidas without fraccion: ${fmtNum(unmatched)}`)

  // ── Phase 5: Cross-reference IGI by pedimento ──
  console.log('\n── Phase 5: IGI Analysis from Aduanet')

  // Build pedimento-level IGI summary
  const pedIGI = {}
  facturas.forEach(f => {
    if (!f.pedimento) return
    if (!pedIGI[f.pedimento]) pedIGI[f.pedimento] = { total_igi: 0, total_valor: 0, ops: 0, tmec: 0 }
    pedIGI[f.pedimento].ops++
    pedIGI[f.pedimento].total_igi += f.igi || 0
    pedIGI[f.pedimento].total_valor += f.valor_usd || 0
    if ((f.igi || 0) === 0) pedIGI[f.pedimento].tmec++
  })

  const totalIGI = facturas.reduce((s, f) => s + (f.igi || 0), 0)
  const totalValorAduanet = facturas.reduce((s, f) => s + (f.valor_usd || 0), 0)
  const tmecCount = facturas.filter(f => (f.igi || 0) === 0).length
  const igiCount = facturas.filter(f => (f.igi || 0) > 0).length

  console.log(`   Total IGI pagado: ${fmtUSD(totalIGI)}`)
  console.log(`   T-MEC aplicado: ${tmecCount}/${facturas.length} (${(tmecCount/facturas.length*100).toFixed(1)}%)`)
  console.log(`   Pedimentos con IGI: ${igiCount}`)

  // ── Phase 6: Output ──
  const frList = Object.values(fraccionMap).sort((a, b) => b.total_valor - a.total_valor)

  console.log('\n' + '='.repeat(70))
  console.log(`\n   FRACCIONES ARANCELARIAS — ${frList.length} UNICAS`)
  console.log('='.repeat(70))

  const opportunities = []

  frList.forEach(fr => {
    const descs = [...fr.descriptions].join(' / ')
    const paises = [...fr.paises].join(', ')
    const usaOnly = fr.paises.size === 1 && fr.paises.has('USA')

    console.log(`\n${fr.fraccion}${fr.nico ? '.' + fr.nico : ''}`)
    console.log(`  ${descs}`)
    console.log(`  Partidas: ${fmtNum(fr.ops)} | Productos: ${fr.productos.size} | Proveedores: ${fr.proveedores.size}`)
    console.log(`  Valor: ${fmtUSD(fr.total_valor)} | Peso: ${fmtNum(Math.round(fr.total_peso))} kg | Qty: ${fmtNum(fr.total_qty)}`)
    console.log(`  Origen: ${paises}`)

    // Flag: high-value fraccion from USA that could benefit from T-MEC
    if (usaOnly && fr.total_valor > 50000) {
      console.log(`  --> Origen USA exclusivo — elegible T-MEC si tiene certificado`)
    }

    // Flag: non-USA origin in a mostly-USA product set
    if (!usaOnly && fr.paises.has('USA') && fr.paises.size > 1) {
      const nonUSA = [...fr.paises].filter(p => p !== 'USA')
      console.log(`  --> MULTI-ORIGEN: ${nonUSA.join(', ')} + USA — revisar origen para T-MEC`)
      if (fr.total_valor > 10000) {
        opportunities.push({
          fraccion: fr.fraccion, type: 'MULTI_ORIGIN',
          detail: `Multi-origen (${paises}) · ${fr.productos.size} productos · Valor ${fmtUSD(fr.total_valor)}`,
          potential_savings: Math.round(fr.total_valor * 0.05),
          priority: fr.total_valor > 100000 ? 'Alta' : 'Media',
        })
      }
    }

    // Flag: non-USA with no T-MEC benefit
    if (!fr.paises.has('USA') && fr.total_valor > 20000) {
      console.log(`  --> ORIGEN NO-USA (${paises}) — revisar si hay tratado aplicable`)
      opportunities.push({
        fraccion: fr.fraccion, type: 'NON_USA_ORIGIN',
        detail: `Origen ${paises} · No T-MEC · Valor ${fmtUSD(fr.total_valor)}`,
        potential_savings: Math.round(fr.total_valor * 0.05),
        priority: fr.total_valor > 100000 ? 'Alta' : 'Media',
      })
    }
  })

  // Add pedimento-level IGI opportunities
  console.log('\n' + '='.repeat(70))
  console.log('\n   PEDIMENTOS CON IGI PAGADO')
  console.log('='.repeat(70))

  const pedWithIGI = Object.entries(pedIGI)
    .filter(([, v]) => v.total_igi > 0)
    .sort(([, a], [, b]) => b.total_igi - a.total_igi)

  pedWithIGI.slice(0, 15).forEach(([ped, v]) => {
    const tmecPct = v.ops > 0 ? (v.tmec / v.ops * 100).toFixed(0) : 0
    console.log(`\n  Ped. ${ped}: IGI ${fmtUSD(v.total_igi)} | Valor ${fmtUSD(v.total_valor)} | T-MEC: ${tmecPct}%`)

    if (v.tmec > 0 && v.total_igi > 5000) {
      opportunities.push({
        fraccion: `Ped.${ped}`, type: 'TMEC_INCONSISTENT',
        detail: `${v.tmec}/${v.ops} ops T-MEC pero IGI pagado ${fmtUSD(v.total_igi)}`,
        potential_savings: v.total_igi,
        priority: v.total_igi > 100000 ? 'Alta' : 'Media',
      })
      console.log(`  --> INCONSISTENTE: T-MEC parcial — ${fmtUSD(v.total_igi)} recuperable`)
    } else if (v.tmec === 0 && v.total_igi > 10000) {
      opportunities.push({
        fraccion: `Ped.${ped}`, type: 'TMEC_NEVER_APPLIED',
        detail: `T-MEC nunca aplicado · IGI ${fmtUSD(v.total_igi)} · Valor ${fmtUSD(v.total_valor)}`,
        potential_savings: v.total_igi,
        priority: v.total_igi > 100000 ? 'Alta' : 'Media',
      })
      console.log(`  --> T-MEC NUNCA APLICADO — ${fmtUSD(v.total_igi)} total`)
    }
  })

  if (pedWithIGI.length > 15) {
    console.log(`\n  ... y ${pedWithIGI.length - 15} pedimentos mas con IGI`)
  }

  // ── Summary ──
  const totalOpportunity = opportunities.reduce((s, o) => s + o.potential_savings, 0)
  const highPriority = opportunities.filter(o => o.priority === 'Alta')

  console.log('\n' + '='.repeat(70))
  console.log('\nSUMMARY')
  console.log('='.repeat(70))
  console.log(`\n  DATA SOURCES`)
  console.log(`  GlobalPC productos:  ${fmtNum(prodWithFraccion.length)} con fraccion`)
  console.log(`  GlobalPC partidas:   ${fmtNum(partidas.length)} lineas (${fmtNum(matched)} matched)`)
  console.log(`  Aduanet facturas:    ${fmtNum(facturas.length)} registros`)
  console.log(`\n  FRACCIONES`)
  console.log(`  Unicas encontradas:  ${frList.length}`)
  console.log(`  Total productos:     ${fmtNum(prodWithFraccion.length)}`)
  console.log(`  Total proveedores:   ${new Set(prodWithFraccion.map(p => p.cve_proveedor)).size}`)
  console.log(`\n  IGI / T-MEC`)
  console.log(`  Total IGI pagado:    ${fmtUSD(totalIGI)}`)
  console.log(`  T-MEC aplicado:      ${tmecCount}/${facturas.length} (${(tmecCount/facturas.length*100).toFixed(1)}%)`)
  console.log(`  Pedimentos con IGI:  ${pedWithIGI.length}`)
  console.log(`\n  OPORTUNIDADES`)
  console.log(`  Total encontradas:   ${opportunities.length}`)
  console.log(`  Prioridad Alta:      ${highPriority.length}`)
  console.log(`  Savings potencial:   ${fmtUSD(totalOpportunity)}`)

  // Save report
  const report = {
    generated: new Date().toISOString(),
    sources: {
      globalpc_productos: prodWithFraccion.length,
      globalpc_partidas: partidas.length,
      aduanet_facturas: facturas.length,
    },
    fracciones: frList.map(fr => ({
      fraccion: fr.fraccion, nico: fr.nico,
      partidas: fr.ops, productos: fr.productos.size, proveedores: fr.proveedores.size,
      total_valor: Math.round(fr.total_valor), total_peso: Math.round(fr.total_peso),
      paises: [...fr.paises], descriptions: [...fr.descriptions],
    })),
    igi_summary: {
      total_igi: Math.round(totalIGI),
      total_valor: Math.round(totalValorAduanet),
      tmec_rate: (tmecCount / facturas.length * 100).toFixed(1) + '%',
      pedimentos_with_igi: pedWithIGI.length,
    },
    opportunities,
  }

  const outputPath = path.join(process.env.HOME || '', 'Desktop', 'CRUZ-Fraccion-Intelligence.json')
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))
  console.log(`\n✅ Report saved: ${outputPath}`)

  // Telegram
  const lines = [
    `📊 <b>FRACCION INTELLIGENCE v2 — CRUZ</b>`,
    `EVCO Plastics · ${new Date().toLocaleDateString('es-MX')}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<b>Fuentes:</b> GlobalPC ${fmtNum(prodWithFraccion.length)} productos + Aduanet ${fmtNum(facturas.length)} facturas`,
    `Fracciones unicas: ${frList.length}`,
    `IGI total pagado: ${fmtUSD(totalIGI)}`,
    `T-MEC: ${tmecCount}/${facturas.length} (${(tmecCount/facturas.length*100).toFixed(1)}%)`,
    ``,
  ]
  if (highPriority.length > 0) {
    lines.push(`<b>ALTA PRIORIDAD (${highPriority.length}):</b>`)
    highPriority.slice(0, 5).forEach(o => lines.push(`• ${o.fraccion}: ${o.detail}`))
    lines.push(``, `Savings potencial: <b>${fmtUSD(totalOpportunity)}</b>`)
  } else if (opportunities.length > 0) {
    lines.push(`${opportunities.length} oportunidades encontradas`)
    lines.push(`Savings potencial: ${fmtUSD(totalOpportunity)}`)
  } else {
    lines.push(`✅ T-MEC aplicado correctamente`)
  }
  lines.push(`━━━━━━━━━━━━━━━━━━━━`, `— CRUZ 🦀`)
  await sendTelegram(lines.join('\n'))
}

runFraccionIntelligence().catch(err => { console.error('Fatal error:', err); process.exit(1) })
