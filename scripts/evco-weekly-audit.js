#!/usr/bin/env node
// scripts/evco-weekly-audit.js
// Generates a weekly audit PDF for EVCO Plastics
// Usage: node evco-weekly-audit.js [YYYY-MM-DD]
// Date defaults to current week (Monday–Sunday)

const { createClient } = require('@supabase/supabase-js')
const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')

const SUPABASE_URL = 'https://jkhpafacchjxawnscplf.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpraHBhZmFjY2hqeGF3bnNjcGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTkyNTUsImV4cCI6MjA4NTI5NTI1NX0.UukWb6CHAfjbhFPT-u0eM-UyAGNKDYSLpdrLgYw0qTw'

const CLAVE = '9254'
const COMPANY_ID = 'evco'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function getWeekRange(dateArg) {
  const d = dateArg ? new Date(dateArg + 'T12:00:00') : new Date()
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMon)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function getISOWeek(d) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function fmtDate(d) {
  return d.toISOString().split('T')[0]
}

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtMXN(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtNum(n) { return Number(n || 0).toLocaleString('en-US') }
function fmtDateShort(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function main() {
  const dateArg = process.argv[2]
  const { start, end } = getWeekRange(dateArg)
  const weekNum = getISOWeek(start)
  const year = start.getFullYear()

  console.log(`📊 EVCO Weekly Audit — ${year}-W${String(weekNum).padStart(2, '0')}`)
  console.log(`   Range: ${fmtDate(start)} → ${fmtDate(end)}`)

  // Query facturas for the week
  const { data: facturas, error: factErr } = await supabase
    .from('aduanet_facturas')
    .select('*')
    .eq('clave_cliente', CLAVE)
    .gte('fecha_pago', fmtDate(start))
    .lte('fecha_pago', fmtDate(end))
    .order('fecha_pago', { ascending: false })

  if (factErr) { console.error('Facturas error:', factErr); process.exit(1) }
  const facts = facturas || []
  console.log(`   Facturas found: ${facts.length}`)

  // Query entradas for the week
  const { data: entradas, error: entErr } = await supabase
    .from('entradas')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .gte('fecha_llegada_mercancia', fmtDate(start))
    .lte('fecha_llegada_mercancia', fmtDate(end))
    .order('fecha_llegada_mercancia', { ascending: false })

  if (entErr) { console.error('Entradas error:', entErr); process.exit(1) }
  const ents = entradas || []
  console.log(`   Entradas found: ${ents.length}`)

  // Query traficos for the week
  const { data: traficos } = await supabase
    .from('traficos')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .gte('fecha_llegada', fmtDate(start))
    .lte('fecha_llegada', fmtDate(end))

  const trafs = traficos || []
  console.log(`   Tráficos found: ${trafs.length}`)

  // KPIs
  const totalValorUSD = facts.reduce((s, f) => s + (f.valor_usd || 0), 0)
  const totalDTA = facts.reduce((s, f) => s + (f.dta || 0), 0)
  const totalIGI = facts.reduce((s, f) => s + (f.igi || 0), 0)
  const totalIVA = facts.reduce((s, f) => s + (f.iva || 0), 0)
  const totalGravamen = totalDTA + totalIGI + totalIVA
  const pedimentosSet = new Set(facts.map(f => f.pedimento).filter(Boolean))
  const pedimentosCount = pedimentosSet.size
  const totalPesoKg = ents.reduce((s, e) => s + (e.peso_bruto || 0), 0)
  const faltantes = ents.filter(e => e.tiene_faltantes).length
  const danadas = ents.filter(e => e.mercancia_danada).length
  const incidencias = faltantes + danadas
  const tmecCount = facts.filter(f => (f.igi || 0) === 0).length

  // Top proveedores
  const byProv = {}
  facts.forEach(f => { if (f.proveedor) byProv[f.proveedor] = (byProv[f.proveedor] || 0) + (f.valor_usd || 0) })
  const topProv = Object.entries(byProv)
    .map(([name, valor]) => ({ name, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10)

  // Build HTML
  const html = buildHTML({
    year, weekNum, start, end,
    facts, ents, trafs,
    totalValorUSD, totalDTA, totalIGI, totalIVA, totalGravamen,
    pedimentosCount, totalPesoKg, incidencias, tmecCount,
    topProv,
  })

  // Generate PDF
  const outDir = path.join(process.env.HOME, 'Desktop')
  const filename = `EVCO-Audit-${year}-W${String(weekNum).padStart(2, '0')}.pdf`
  const outPath = path.join(outDir, filename)

  console.log(`   Generating PDF...`)
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.pdf({
    path: outPath,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  })
  await browser.close()

  console.log(`✅ Saved: ${outPath}`)
}

function buildHTML(d) {
  const startStr = fmtDateShort(d.start)
  const endStr = fmtDateShort(d.end)
  const kpis = [
    { label: 'Valor Total USD', value: fmtUSD(d.totalValorUSD), color: '#C9A84C' },
    { label: 'Pedimentos', value: d.pedimentosCount, color: '#60A5FA' },
    { label: 'Tráficos', value: d.trafs.length, color: '#34D399' },
    { label: 'Remesas', value: d.ents.length, color: '#A78BFA' },
    { label: 'Peso (kg)', value: fmtNum(d.totalPesoKg), color: '#F472B6' },
    { label: 'Incidencias', value: d.incidencias, color: d.incidencias > 0 ? '#F87171' : '#34D399' },
  ]

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', -apple-system, sans-serif; background: #FFF; color: #1a1a1a; font-size: 11px; }

  .header { background: #0A0A0A; color: #FFF; padding: 32px 40px 28px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
  .header .gold { color: #C9A84C; }
  .header .sub { color: rgba(255,255,255,0.5); font-size: 11px; margin-top: 4px; }
  .header .badge { background: #C9A84C; color: #0A0A0A; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .header .meta { display: flex; gap: 20px; color: rgba(255,255,255,0.45); font-size: 10px; }

  .body { padding: 28px 40px; }

  .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { border: 1px solid #E5E5E5; border-radius: 8px; padding: 14px; text-align: center; }
  .kpi .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 6px; }
  .kpi .kpi-value { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }

  .section-title { font-size: 13px; font-weight: 700; color: #0A0A0A; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #C9A84C; display: inline-block; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #F5F5F0; padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em; color: #666; border-bottom: 1px solid #E5E5E5; }
  thead th.r { text-align: right; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #F0F0F0; font-size: 10px; color: #333; }
  tbody td.r { text-align: right; }
  tbody td.b { font-weight: 700; }
  tbody td.navy { color: #0D2340; font-weight: 700; }
  tbody td.green { color: #166534; font-weight: 600; }
  tbody td.muted { color: #999; }
  tbody tr:nth-child(even) { background: #FAFAF8; }

  .footer { background: #0A0A0A; color: rgba(255,255,255,0.4); padding: 20px 40px; font-size: 9px;
    display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .footer .gold { color: #C9A84C; font-weight: 700; }

  .tmec { color: #166534; font-weight: 700; font-size: 9px; }
  .provbar { height: 4px; background: #E5E5E5; border-radius: 99px; overflow: hidden; margin-top: 4px; }
  .provbar-fill { height: 100%; border-radius: 99px; }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <div>
      <h1>EVCO PLASTICS DE <span class="gold">MÉXICO</span></h1>
      <div class="sub">RFC: EPM001109I74 · Clave Cliente: 9254 · Patente: 3596 · Aduana: 240</div>
    </div>
    <div class="badge">SEMANA ${d.weekNum} · ${d.year}</div>
  </div>
  <div class="meta">
    <span>📅 ${startStr} — ${endStr}</span>
    <span>Generado: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
  </div>
</div>

<div class="body">
  <!-- KPI Cards -->
  <div class="kpi-grid">
    ${kpis.map(k => `
      <div class="kpi">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value" style="color: ${k.color}">${k.value}</div>
      </div>
    `).join('')}
  </div>

  <!-- Financial Summary -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px;">
    ${[
      { l: 'DTA Total', v: fmtMXN(d.totalDTA), c: '#555' },
      { l: 'IGI Total', v: d.totalIGI === 0 ? 'T-MEC $0.00 ✓' : fmtMXN(d.totalIGI), c: d.totalIGI === 0 ? '#166534' : '#555' },
      { l: 'IVA Total', v: fmtMXN(d.totalIVA), c: '#555' },
      { l: 'Gravamen Total', v: fmtMXN(d.totalGravamen), c: '#0D2340' },
    ].map(k => `
      <div style="border: 1px solid #E5E5E5; border-radius: 6px; padding: 10px 12px;">
        <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-bottom: 4px;">${k.l}</div>
        <div style="font-size: 14px; font-weight: 700; color: ${k.c};">${k.v}</div>
      </div>
    `).join('')}
  </div>

  <!-- Financial Table -->
  <div class="section-title">Detalle Financiero por Pedimento</div>
  <table>
    <thead>
      <tr>
        <th>Pedimento</th>
        <th>Referencia</th>
        <th>Fecha Pago</th>
        <th>Proveedor</th>
        <th class="r">T/C</th>
        <th class="r">Valor USD</th>
        <th class="r">DTA</th>
        <th class="r">IGI</th>
        <th class="r">IVA</th>
        <th>T-MEC</th>
      </tr>
    </thead>
    <tbody>
      ${d.facts.length === 0
        ? '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #999;">Sin movimientos en este período</td></tr>'
        : d.facts.map(f => `
        <tr>
          <td class="navy">${f.pedimento || '—'}</td>
          <td>${f.referencia || '—'}</td>
          <td class="muted">${fmtDateShort(f.fecha_pago)}</td>
          <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.proveedor || '—'}</td>
          <td class="r muted">${f.tipo_cambio ? '$' + Number(f.tipo_cambio).toFixed(4) : '—'}</td>
          <td class="r b">${fmtUSD(f.valor_usd)}</td>
          <td class="r">${f.dta ? fmtMXN(f.dta) : '—'}</td>
          <td class="r">${f.igi ? fmtMXN(f.igi) : '—'}</td>
          <td class="r">${fmtMXN(f.iva)}</td>
          <td>${(f.igi || 0) === 0 ? '<span class="tmec">✓ T-MEC</span>' : '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Top Proveedores -->
  <div class="section-title">Top Proveedores</div>
  <table>
    <thead>
      <tr>
        <th style="width: 40px">#</th>
        <th>Proveedor</th>
        <th class="r">Valor USD</th>
        <th style="width: 200px">Participación</th>
      </tr>
    </thead>
    <tbody>
      ${d.topProv.length === 0
        ? '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #999;">Sin proveedores en este período</td></tr>'
        : d.topProv.map((p, i) => {
          const max = d.topProv[0]?.valor || 1
          const pct = ((p.valor / d.totalValorUSD) * 100).toFixed(1)
          return `
          <tr>
            <td class="muted">${i + 1}</td>
            <td class="b">${p.name}</td>
            <td class="r b">${fmtUSD(p.valor)}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="provbar" style="flex: 1;">
                  <div class="provbar-fill" style="width: ${(p.valor / max) * 100}%; background: ${i === 0 ? '#C9A84C' : i < 3 ? '#0D2340' : '#CEC9BF'};"></div>
                </div>
                <span class="muted" style="font-size: 9px; min-width: 30px; text-align: right;">${pct}%</span>
              </div>
            </td>
          </tr>
        `}).join('')}
    </tbody>
  </table>

  ${d.tmecCount > 0 ? `
  <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px;">
    <span style="color: #166534; font-weight: 700; font-size: 11px;">🌿 T-MEC: ${d.tmecCount} de ${d.facts.length} operaciones con IGI $0 — Certificado de origen vigente</span>
  </div>
  ` : ''}
</div>

<div class="footer">
  <div>
    <span class="gold">Grupo Aduanal Renato Zapata S.C.</span> · Patente 3596 · Aduana 240 Nuevo Laredo
  </div>
  <div>
    <span class="gold">CRUZ</span> Platform · Generado automáticamente
  </div>
</div>

</body>
</html>`
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
