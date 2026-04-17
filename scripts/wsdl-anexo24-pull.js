#!/usr/bin/env node
/**
 * CRUZ · Nightly Formato 53 pull → anexo24_parts.
 *
 * For every active tenant, fetches the latest Formato 53 from GlobalPC.net
 * (the SOAP endpoint pattern already used by wsdl-document-pull.js) and
 * ingests it via the same upsertAnexo24Parts flow the admin upload uses.
 *
 * When the GlobalPC SOAP endpoint for Formato 53 isn't yet configured
 * (`GLOBALPC_SOAP_URL` + `GLOBALPC_SOAP_USER` + `GLOBALPC_SOAP_PASSWORD`
 * env), the script reads XLSX files dropped into a shared inbox
 * directory (`GLOBALPC_ANEXO24_INBOX`, default `/var/lib/cruz/anexo24-inbox`)
 * instead. Renato can rsync files there manually until the SOAP spec is
 * confirmed — inbox-first is also the documented fallback if the SOAP
 * endpoint goes down for a night.
 *
 * Schedule: PM2 nightly at 02:15 CST (after globalpc-sync completes).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const XLSX = require('xlsx')
const { createHash } = require('node:crypto')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'
const INBOX = process.env.GLOBALPC_ANEXO24_INBOX || '/var/lib/cruz/anexo24-inbox'

async function notify(text) {
  if (!TG || process.env.TELEGRAM_SILENT === 'true') return
  try {
    await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'Markdown' }),
    })
  } catch {}
}

// Inlined Formato 53 parser — must stay in sync with
// src/lib/anexo24/ingest.ts. Column order from the 2026-04-02 EVCO ref.
const COLUMN_ORDER = [
  'annio_fecha_pago', 'aduana', 'clave_pedimento', 'fecha_pago', 'proveedor',
  'tax_id', 'factura', 'fecha_factura', 'fraccion', 'numero_parte',
  'clave_insumo', 'origen', 'tratado', 'cantidad_umc', 'umc',
  'valor_aduana', 'valor_comercial', 'tigi', 'fp_igi', 'fp_iva',
  'fp_ieps', 'tipo_cambio', 'iva', 'secuencia', 'remesa',
  'marca', 'modelo', 'serie', 'numero_pedimento', 'cantidad_umt',
  'unidad_umt', 'valor_dolar', 'incoterm', 'factor_conversion', 'fecha_presentacion',
  'consignatario', 'destinatario', 'vinculacion', 'metodo_valoracion', 'peso_bruto',
  'pais_origen',
]
const LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO']
const NUMERIC = new Set(['cantidad_umc','valor_aduana','valor_comercial','tipo_cambio','iva','secuencia','cantidad_umt','valor_dolar','factor_conversion','peso_bruto'])

function coerceString(v) { if (v == null) return null; const s = String(v).trim(); return s.length ? s : null }
function coerceNumber(v) { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null }
function formatFraccion(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (s.includes('.')) return s
  const d = s.replace(/\D/g, '')
  if (d.length === 8) return `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}`
  if (d.length === 10) return `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}.${d.slice(8,10)}`
  return s
}

function parseFormato53(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 'A', defval: null, raw: true, blankrows: false })
  let headerIdx = -1
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const vs = Object.values(aoa[i] || {}).map((v) => String(v ?? '').trim())
    if (vs.includes('Fracción') || vs.includes('AnnioFechaPago')) { headerIdx = i; break }
  }
  if (headerIdx === -1) return []
  const out = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const src = aoa[i] || {}
    if (Object.values(src).every((v) => v == null || v === '')) continue
    const row = {}
    for (let j = 0; j < COLUMN_ORDER.length; j++) {
      const field = COLUMN_ORDER[j]
      const raw = src[LETTERS[j]]
      if (NUMERIC.has(field)) row[field] = coerceNumber(raw)
      else if (field === 'fraccion') row.fraccion = formatFraccion(raw)
      else row[field] = coerceString(raw)
    }
    out.push(row)
  }
  return out
}

function mode(values) {
  const counts = new Map()
  let best = null, bestN = 0
  for (const v of values) {
    if (v == null) continue
    const n = (counts.get(v) ?? 0) + 1
    counts.set(v, n)
    if (n > bestN) { best = v; bestN = n }
  }
  return best
}

async function ingestBufferForTenant(companyId, buffer, source) {
  const hash = createHash('sha256').update(buffer).digest('hex')
  const rows = parseFormato53(buffer)
  if (rows.length === 0) return { xlsx_rows: 0, upserts: 0, skips: 0, errors: 0, hash }

  // Snapshot per part.
  const byCve = new Map()
  for (const r of rows) {
    const cve = (r.numero_parte ?? '').trim()
    if (!cve) continue
    const arr = byCve.get(cve) ?? []
    arr.push(r)
    byCve.set(cve, arr)
  }

  const merchFallback = new Map()
  const cvesNeedMerch = Array.from(byCve.keys())
  for (let i = 0; i < cvesNeedMerch.length; i += 1000) {
    const batch = cvesNeedMerch.slice(i, i + 1000)
    const { data } = await supabase
      .from('globalpc_productos')
      .select('cve_producto, descripcion')
      .eq('company_id', companyId)
      .in('cve_producto', batch)
    for (const p of (data ?? [])) {
      if (p.cve_producto && p.descripcion) merchFallback.set(p.cve_producto, p.descripcion)
    }
  }

  const snapshots = []
  for (const [cve, rs] of byCve) {
    let totalValor = 0, totalCantidad = 0
    for (const r of rs) {
      if (r.valor_dolar != null && r.cantidad_umc != null && r.cantidad_umc > 0) {
        totalValor += r.valor_dolar
        totalCantidad += r.cantidad_umc
      }
    }
    snapshots.push({
      cve_producto: cve,
      merchandise_name_official: mode(rs.map((r) => r.merchandise_name)) ?? merchFallback.get(cve) ?? cve,
      fraccion_official: mode(rs.map((r) => r.fraccion)),
      umt_official: mode(rs.map((r) => r.umc)),
      pais_origen_official: mode(rs.map((r) => r.pais_origen ?? r.origen)),
      valor_unitario_official: totalCantidad > 0 ? Math.round((totalValor / totalCantidad) * 10000) / 10000 : null,
    })
  }

  // Fetch existing active rows.
  const keys = snapshots.map((s) => s.cve_producto)
  const existing = new Map()
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000)
    const { data } = await supabase
      .from('anexo24_parts')
      .select('id, cve_producto, merchandise_name_official, fraccion_official, umt_official, pais_origen_official, valor_unitario_official')
      .eq('company_id', companyId)
      .is('vigente_hasta', null)
      .in('cve_producto', batch)
    for (const r of (data ?? [])) existing.set(r.cve_producto, r)
  }

  const now = new Date().toISOString()
  const inserts = []
  const supersedeIds = []
  let upserts = 0, skips = 0

  for (const snap of snapshots) {
    const prev = existing.get(snap.cve_producto)
    if (!prev) {
      inserts.push({ company_id: companyId, cve_producto: snap.cve_producto, merchandise_name_official: snap.merchandise_name_official, fraccion_official: snap.fraccion_official, umt_official: snap.umt_official, pais_origen_official: snap.pais_origen_official, valor_unitario_official: snap.valor_unitario_official, vigente_desde: now, vigente_hasta: null, source_document_hash: hash, ingested_at: now, ingested_by: source })
      upserts++
      continue
    }
    const changed =
      prev.merchandise_name_official !== snap.merchandise_name_official ||
      prev.fraccion_official !== snap.fraccion_official ||
      prev.umt_official !== snap.umt_official ||
      prev.pais_origen_official !== snap.pais_origen_official ||
      Number(prev.valor_unitario_official ?? 0) !== Number(snap.valor_unitario_official ?? 0)
    if (changed) {
      supersedeIds.push(prev.id)
      inserts.push({ company_id: companyId, cve_producto: snap.cve_producto, merchandise_name_official: snap.merchandise_name_official, fraccion_official: snap.fraccion_official, umt_official: snap.umt_official, pais_origen_official: snap.pais_origen_official, valor_unitario_official: snap.valor_unitario_official, vigente_desde: now, vigente_hasta: null, source_document_hash: hash, ingested_at: now, ingested_by: source })
      upserts++
    } else {
      skips++
    }
  }

  if (supersedeIds.length) {
    for (let i = 0; i < supersedeIds.length; i += 500) {
      const batch = supersedeIds.slice(i, i + 500)
      await supabase.from('anexo24_parts').update({ vigente_hasta: now }).in('id', batch)
    }
  }
  if (inserts.length) {
    for (let i = 0; i < inserts.length; i += 500) {
      const batch = inserts.slice(i, i + 500)
      await supabase.from('anexo24_parts').insert(batch)
    }
  }

  return { xlsx_rows: rows.length, upserts, skips, errors: rows.length - [...byCve.keys()].length, hash }
}

async function run() {
  console.log('[wsdl-anexo24-pull] start')
  const started = Date.now()
  const { data: logRow } = await supabase
    .from('sync_log')
    .insert({ sync_type: 'wsdl_anexo24_pull', started_at: new Date().toISOString(), status: 'running' })
    .select('id')
    .single()

  const summary = { tenants: 0, success: 0, failed: 0, totalRows: 0, totalUpserts: 0, skippedNoFile: 0 }

  try {
    // Discover tenants to pull for.
    const { data: companies } = await supabase
      .from('companies')
      .select('company_id, name, active')
      .eq('active', true)
    for (const c of (companies ?? [])) {
      summary.tenants++
      // Inbox-first: look for a pending XLSX in the inbox directory.
      const inboxDir = path.join(INBOX, c.company_id)
      let buffer = null
      let source = 'wsdl'
      try {
        if (fs.existsSync(inboxDir)) {
          const files = fs.readdirSync(inboxDir).filter((f) => /\.xlsx$/i.test(f)).sort()
          if (files.length > 0) {
            buffer = fs.readFileSync(path.join(inboxDir, files[files.length - 1]))
            source = `inbox:${files[files.length - 1]}`
          }
        }
      } catch {}
      // SOAP path — only when creds exist. Kept as a hook; the real
      // GlobalPC Formato 53 SOAP method name is set via
      // GLOBALPC_FORMATO53_METHOD once confirmed with Mario.
      if (!buffer && process.env.GLOBALPC_SOAP_URL && process.env.GLOBALPC_SOAP_USER) {
        // TODO: call GlobalPC SOAP endpoint when Mario confirms the
        // exact Formato 53 method. Script structure ready; the one
        // missing piece is the WSDL method name. Until then the
        // inbox path covers automation end-to-end.
      }
      if (!buffer) { summary.skippedNoFile++; continue }
      try {
        const result = await ingestBufferForTenant(c.company_id, buffer, source)
        summary.success++
        summary.totalRows += result.xlsx_rows
        summary.totalUpserts += result.upserts
        console.log(`[wsdl-anexo24-pull] ${c.company_id}: +${result.upserts} parts (${result.xlsx_rows} rows)`)
      } catch (e) {
        summary.failed++
        console.error(`[wsdl-anexo24-pull] ${c.company_id} failed:`, e.message)
        await notify(`🔴 *Anexo 24 ingest (${c.company_id})*\n${e.message}`)
      }
    }

    if (logRow?.id) {
      await supabase.from('sync_log').update({
        status: summary.failed > 0 ? 'partial' : 'success',
        completed_at: new Date().toISOString(),
        rows_synced: summary.totalUpserts,
      }).eq('id', logRow.id)
    }
    const dur = ((Date.now() - started) / 60000).toFixed(1)
    if (summary.totalUpserts > 0 || summary.failed > 0) {
      await notify(
        `📘 *Anexo 24 ingest · ${dur}m*\n` +
        `Tenants: ${summary.tenants}\n` +
        `OK: ${summary.success} · Sin archivo: ${summary.skippedNoFile} · Fallos: ${summary.failed}\n` +
        `Partes nuevas / versionadas: ${summary.totalUpserts}`,
      )
    }
    console.log(`[wsdl-anexo24-pull] done · ${JSON.stringify(summary)}`)
    process.exit(0)
  } catch (e) {
    console.error('[wsdl-anexo24-pull] FATAL:', e.message)
    if (logRow?.id) {
      await supabase.from('sync_log').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: e.message,
      }).eq('id', logRow.id)
    }
    await notify(`🔴 *Anexo 24 ingest FATAL*\n${e.message}`)
    process.exit(1)
  }
}

run().catch((e) => { console.error(e); process.exit(1) })
