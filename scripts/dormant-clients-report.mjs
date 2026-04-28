#!/usr/bin/env node
// Dormant clients report — historical Renato Zapata & Co. clients
// that have NOT had a tráfico in the last 30 days.
//
// Signals considered per client:
//   last_trafico_fecha  = max(fecha_llegada, fecha_cruce, created_at) on traficos
//   last_entrada_fecha  = max(fecha_llegada_mercancia, created_at) on entradas
//   last_activity       = max of the two above
//
// A client is "dormant" when:
//   - they have historical traficos on record (ever shipped with us), AND
//   - last_activity is NULL or older than THRESHOLD_DAYS (default 30).
//
// Output: Desktop MD + PDF (via puppeteer, same chrome as prospects list)

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const THRESHOLD_DAYS = 30
const TODAY = new Date()
const THRESHOLD = new Date(TODAY.getTime() - THRESHOLD_DAYS * 86400_000)
const TODAY_ISO = TODAY.toISOString().slice(0, 10)

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function daysSince(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Math.floor((TODAY.getTime() - d.getTime()) / 86400_000)
}

async function loadCompanies() {
  const { data, error } = await sb
    .from('companies')
    .select('company_id, clave_cliente, name, contact_name, contact_email, contact_phone, active, created_at')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

async function lastTraficoByCompany() {
  // Pull traficos fields needed for last-activity and totals.
  // Service-role bypasses RLS; we scope by company_id in memory.
  const pageSize = 1000
  let from = 0
  const rows = []
  for (;;) {
    const { data, error } = await sb
      .from('traficos')
      .select('company_id, client_id, fecha_llegada, fecha_cruce')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  const agg = new Map()
  for (const r of rows) {
    const key = r.company_id || r.client_id
    if (!key) continue
    const bucket = agg.get(key) || { count: 0, last: null, last30: 0 }
    bucket.count += 1
    const cand = [r.fecha_cruce, r.fecha_llegada].filter(Boolean).sort().pop()
    if (cand && (!bucket.last || cand > bucket.last)) bucket.last = cand
    if (cand && new Date(cand) >= THRESHOLD) bucket.last30 += 1
    agg.set(key, bucket)
  }
  return agg
}

async function lastEntradaByCompany() {
  const pageSize = 1000
  let from = 0
  const rows = []
  for (;;) {
    const { data, error } = await sb
      .from('entradas')
      .select('company_id, cve_cliente, fecha_llegada_mercancia')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  const agg = new Map()
  for (const r of rows) {
    const key = r.company_id || r.cve_cliente
    if (!key) continue
    const bucket = agg.get(key) || { count: 0, last: null }
    bucket.count += 1
    const cand = [r.fecha_llegada_mercancia].filter(Boolean).sort().pop()
    if (cand && (!bucket.last || cand > bucket.last)) bucket.last = cand
    agg.set(key, bucket)
  }
  return agg
}

function bucketByDays(days) {
  if (days === null || days === undefined) return 'Sin actividad registrada'
  if (days <= 60) return '31–60 días'
  if (days <= 90) return '61–90 días'
  if (days <= 180) return '91–180 días'
  if (days <= 365) return '181–365 días'
  return '+365 días'
}

async function main() {
  console.log(`Cutoff: ${THRESHOLD.toISOString().slice(0, 10)} (last ${THRESHOLD_DAYS} days)`)
  const [companies, trMap, enMap] = await Promise.all([
    loadCompanies(),
    lastTraficoByCompany(),
    lastEntradaByCompany(),
  ])
  console.log(`Companies: ${companies.length} · trafico keys: ${trMap.size} · entrada keys: ${enMap.size}`)

  const rows = []
  for (const c of companies) {
    const byId = trMap.get(c.company_id)
    const byClave = trMap.get(c.clave_cliente)
    const tr = byId || byClave
    const en = enMap.get(c.company_id) || enMap.get(c.clave_cliente)
    if (!tr || tr.count === 0) continue // never shipped with us

    const lastTr = tr.last
    const lastEn = en?.last
    const lastAny = [lastTr, lastEn].filter(Boolean).sort().pop() || null
    const days = daysSince(lastAny)
    const isDormant = !lastAny || new Date(lastAny) < THRESHOLD

    rows.push({
      company_id: c.company_id,
      clave_cliente: c.clave_cliente,
      name: c.name,
      active: c.active,
      contact_name: c.contact_name,
      contact_email: c.contact_email,
      contact_phone: c.contact_phone,
      total_traficos: tr.count,
      last_30d_traficos: tr.last30,
      last_trafico: lastTr,
      last_entrada: lastEn,
      last_activity: lastAny,
      days_since: days,
      bucket: bucketByDays(days),
      dormant: isDormant,
    })
  }

  const dormant = rows.filter(r => r.dormant)
  // Sort dormant: most-recently-active first (closest to reactivation), nulls last.
  dormant.sort((a, b) => {
    if (!a.last_activity && !b.last_activity) return (b.total_traficos || 0) - (a.total_traficos || 0)
    if (!a.last_activity) return 1
    if (!b.last_activity) return -1
    return b.last_activity.localeCompare(a.last_activity)
  })

  const active = rows.filter(r => !r.dormant)

  // ── MD + HTML + PDF ────────────────────────────────────────────────
  const fmtDate = iso => (iso ? iso.slice(0, 10) : '—')
  const fmtName = r => r.name || r.clave_cliente || r.company_id
  const md = []
  md.push(`# Renato Zapata & Co. — Clientes dormantes`)
  md.push(``)
  md.push(`*Generado · ${TODAY_ISO} · Sin actividad > ${THRESHOLD_DAYS} días*`)
  md.push(``)
  md.push(`**Patente 3596 · Aduana 240 · Laredo TX · Est. 1941**`)
  md.push(``)
  md.push(`## Resumen`)
  md.push(``)
  md.push(`| Métrica | Valor |`)
  md.push(`|---|---:|`)
  md.push(`| Clientes con historial de tráficos | ${rows.length} |`)
  md.push(`| Activos (tráfico en últimos ${THRESHOLD_DAYS} días) | ${active.length} |`)
  md.push(`| **Dormantes (> ${THRESHOLD_DAYS} días sin movimiento)** | **${dormant.length}** |`)
  md.push(``)

  // Bucket breakdown
  const buckets = {}
  for (const r of dormant) buckets[r.bucket] = (buckets[r.bucket] || 0) + 1
  md.push(`### Distribución por antigüedad`)
  md.push(``)
  md.push(`| Bucket | Clientes |`)
  md.push(`|---|---:|`)
  const order = ['31–60 días', '61–90 días', '91–180 días', '181–365 días', '+365 días', 'Sin actividad registrada']
  for (const k of order) if (buckets[k]) md.push(`| ${k} | ${buckets[k]} |`)
  md.push(``)

  md.push(`## Clientes dormantes (${dormant.length})`)
  md.push(``)
  md.push(`| # | Cliente | Clave | Último tráfico | Días sin mover | Tráficos totales | Contacto |`)
  md.push(`|---:|---|---|---|---:|---:|---|`)
  dormant.forEach((r, i) => {
    const contacto = [r.contact_name, r.contact_email, r.contact_phone].filter(Boolean).join(' · ') || '—'
    md.push(`| ${i + 1} | ${fmtName(r)} | ${r.clave_cliente || '—'} | ${fmtDate(r.last_activity)} | ${r.days_since ?? '—'} | ${r.total_traficos} | ${contacto} |`)
  })
  md.push(``)

  if (active.length) {
    md.push(`## Activos (referencia · ${active.length})`)
    md.push(``)
    md.push(`| Cliente | Clave | Tráficos últimos 30d | Último tráfico |`)
    md.push(`|---|---|---:|---|`)
    active
      .sort((a, b) => (b.last_30d_traficos || 0) - (a.last_30d_traficos || 0))
      .forEach(r => md.push(`| ${fmtName(r)} | ${r.clave_cliente || '—'} | ${r.last_30d_traficos} | ${fmtDate(r.last_activity)} |`))
    md.push(``)
  }

  md.push(`---`)
  md.push(`*Fuente: Supabase · traficos + entradas + companies · service role query · ${TODAY_ISO}*`)

  const outDir = path.join(process.env.HOME, 'Desktop')
  const mdPath = path.join(outDir, `clientes-dormantes-${TODAY_ISO}.md`)
  const pdfPath = path.join(outDir, `clientes-dormantes-${TODAY_ISO}.pdf`)
  await fs.writeFile(mdPath, md.join('\n'), 'utf8')
  console.log(`✓ ${mdPath}`)

  // Render PDF via Puppeteer with inline HTML
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Clientes dormantes ${TODAY_ISO}</title>
<style>
  @page { size: Letter; margin: 0.6in; }
  html,body { background:#0A0A0C; color:#E8EAED; font:13px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif; }
  h1 { font-size: 28px; letter-spacing: -0.01em; margin: 0 0 4px; color:#E8EAED; font-weight:600; }
  h2 { font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; color:#C0C5CE; margin-top: 28px; border-bottom: 1px solid rgba(192,197,206,0.18); padding-bottom: 6px; }
  h3 { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color:#7A7E86; margin-top: 18px; }
  p, li { color:#C0C5CE; }
  em { color:#7A7E86; font-style: normal; }
  strong { color:#E8EAED; }
  table { width:100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 11px; }
  th { text-align:left; padding:8px 10px; background: rgba(255,255,255,0.04); color:#C0C5CE; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; font-size:10px; border-bottom:1px solid rgba(192,197,206,0.18); }
  td { padding:7px 10px; border-bottom: 1px solid rgba(192,197,206,0.08); color:#E8EAED; vertical-align: top; }
  td.num, th.num { text-align:right; font-variant-numeric: tabular-nums; font-family: "JetBrains Mono","SF Mono",Menlo,monospace; }
  .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid rgba(122,126,134,0.25); color: rgba(122,126,134,0.7); font-size: 9px; letter-spacing:0.12em; text-transform:uppercase; font-family:"JetBrains Mono","SF Mono",Menlo,monospace; }
</style></head><body>
${mdToHtml(md.join('\n'))}
<div class="footer">Patente 3596 · Aduana 240 · Laredo TX · Est. 1941</div>
</body></html>`

  const htmlPath = path.join(outDir, `clientes-dormantes-${TODAY_ISO}.html`)
  await fs.writeFile(htmlPath, html, 'utf8')

  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' })
  await page.pdf({
    path: pdfPath,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.6in', bottom: '0.6in', left: '0.6in', right: '0.6in' },
  })
  await browser.close()
  console.log(`✓ ${pdfPath}`)
  console.log(`\nTotal w/historial: ${rows.length} · Activos: ${active.length} · Dormantes: ${dormant.length}`)
}

// Lightweight MD→HTML for headings / tables / paragraphs / em / strong.
function mdToHtml(md) {
  const lines = md.split('\n')
  const out = []
  let inTable = false
  let tableHead = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\|/.test(line)) {
      if (/^\|[\s\-:|]+\|\s*$/.test(line)) { tableHead = true; continue }
      const cells = line.trim().slice(1, -1).split('|').map(c => c.trim())
      if (!inTable) { out.push('<table>'); inTable = true }
      const tag = tableHead ? 'td' : 'th'
      out.push('<tr>' + cells.map(c => `<${tag}>${inlineMd(c)}</${tag}>`).join('') + '</tr>')
      if (!tableHead) { /* header row already rendered */ }
      continue
    }
    if (inTable) { out.push('</table>'); inTable = false; tableHead = false }
    if (/^# /.test(line)) out.push(`<h1>${inlineMd(line.slice(2))}</h1>`)
    else if (/^## /.test(line)) out.push(`<h2>${inlineMd(line.slice(3))}</h2>`)
    else if (/^### /.test(line)) out.push(`<h3>${inlineMd(line.slice(4))}</h3>`)
    else if (/^---\s*$/.test(line)) out.push('<hr>')
    else if (line.trim() === '') out.push('')
    else out.push(`<p>${inlineMd(line)}</p>`)
  }
  if (inTable) out.push('</table>')
  return out.join('\n')
}

function inlineMd(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

main().catch(err => { console.error(err); process.exit(1) })
