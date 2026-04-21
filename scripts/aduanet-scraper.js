#!/usr/bin/env node
/**
 * CRUZ ADUANET Scraper — Login, Search Pedimentos, Extract Partidas + COVEs + Contribuciones → Supabase
 *
 * Ported from ~/.openclaw/workspace/scripts/aduanet-scraper/src/aduanet.js
 * Added: DTA/IGI/IVA extraction (at017 contribuciones), multi-client, Telegram alerts
 *
 * Usage:
 *   node scripts/aduanet-scraper.js                         # full scrape (LOOKBACK_DAYS)
 *   node scripts/aduanet-scraper.js --pedimento 6500507     # single pedimento lookup
 *   node scripts/aduanet-scraper.js --from 01/01/2025       # custom date range
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const https = require('https')
const { createClient } = require('@supabase/supabase-js')

// ── Config ──────────────────────────────────────────────────────────────────
const ADUANET_HOST = 'www.aduanetm3.net'
const ADUANET_PORT = 443
const USER   = process.env.ADUANET_USERNAME || process.env.ADUANET_USER
const PASS   = process.env.ADUANET_PASSWORD || process.env.ADUANET_PASS
const IDRA   = process.env.ADUANET_IDRA || 'RZGA01'
const PATENTE = process.env.EVCO_QUERIES || '3596'
const ADUANA  = process.env.ADUANA || '240'
const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || '90', 10)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT = '-5085543275'

// ── Simple logger (no winston dependency) ───────────────────────────────────
const log = {
  info: (...args) => console.log(`[${new Date().toISOString()}] INFO:`, ...args),
  warn: (...args) => console.warn(`[${new Date().toISOString()}] WARN:`, ...args),
  error: (...args) => console.error(`[${new Date().toISOString()}] ERROR:`, ...args),
}

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TG_TOKEN) { log.info('[TG]', msg.replace(/<[^>]+>/g, '')); return }
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
function rawReq(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, res => {
      const chunks = []
      res.on('data', d => chunks.push(d))
      res.on('end', () => resolve({
        text: Buffer.concat(chunks).toString(),
        status: res.statusCode,
        sc: res.headers['set-cookie'] || [],
        headers: res.headers,
      }))
    })
    r.on('error', reject)
    if (body) r.write(body)
    r.end()
  })
}

function doGet(path, cookies) {
  return rawReq({
    hostname: ADUANET_HOST, port: ADUANET_PORT, path, method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      ...(cookies ? { Cookie: cookies } : {}),
    },
  })
}

function doPost(path, data, cookies) {
  const body = Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return rawReq({
    hostname: ADUANET_HOST, port: ADUANET_PORT, path, method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      'Content-Length': Buffer.byteLength(body),
      ...(cookies ? { Cookie: cookies } : {}),
    },
  }, body)
}

function mergeCookies(existing, newCookies) {
  const c = {}
  if (existing) {
    existing.split('; ').forEach(x => {
      const i = x.indexOf('=')
      if (i > 0) c[x.slice(0, i)] = x.slice(i + 1)
    })
  }
  newCookies.forEach(s => {
    const kv = s.split(';')[0]
    const i = kv.indexOf('=')
    if (i > 0) c[kv.slice(0, i).trim()] = kv.slice(i + 1).trim()
  })
  return Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; ')
}

// ── Date helpers ────────────────────────────────────────────────────────────
function ddmmyyyy(daysBack = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysBack)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function isoDate(ddmm) {
  if (!ddmm) return null
  const p = ddmm.split('/')
  if (p.length !== 3) return null
  return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
}

function parseNum(str) {
  if (!str) return null
  return parseFloat(str.replace(/[$,\s]/g, '')) || null
}

// ── HTML table parser ───────────────────────────────────────────────────────
function parseHtmlRows(html) {
  const rows = []
  ;(html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []).forEach(row => {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map(td => td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
    if (cells.length >= 3 && cells.some(c => c.length > 0)) rows.push(cells)
  })
  return rows
}

// ── XML helpers ─────────────────────────────────────────────────────────────
function xmlVal(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))
  return m ? m[1].trim() : null
}

function xmlRows(xml, section) {
  const secBlock = xml.match(new RegExp(`<${section}>([\\s\\S]*?)<\\/${section}>`))
  if (!secBlock) return []
  const rows = []
  const re = /<row[^>]*>([\s\S]*?)<\/row>/g
  let m
  while ((m = re.exec(secBlock[1])) !== null) rows.push(m[1])
  return rows
}

// ════════════════════════════════════════════════════════════════════════════
// 1. LOGIN
// ════════════════════════════════════════════════════════════════════════════
async function login() {
  log.info('Authenticating with ADUANET M3…')

  const r1 = await doGet('/loginI.php')
  let ck = mergeCookies('', r1.sc)

  const r2 = await doPost('/login_auth.php', { accion: 'getUrl', idra: IDRA }, ck)
  ck = mergeCookies(ck, r2.sc)

  const r3 = await doPost('/loginV.php', {
    accion: 'validLogin', userid: USER, userpwd: PASS, idra: IDRA, sistema: 'am3',
  }, ck)
  ck = mergeCookies(ck, r3.sc)

  if (!r3.text.includes('VALID')) {
    throw new Error(`Auth failed: ${r3.text.slice(0, 120)}`)
  }

  const r4 = await doGet('/herramientas/home.php', ck)
  ck = mergeCookies(ck, r4.sc)

  log.info('Auth successful')
  return ck
}

// ════════════════════════════════════════════════════════════════════════════
// 2. SEARCH PEDIMENTOS
// ════════════════════════════════════════════════════════════════════════════
async function searchPedimentos(cookies, { from, to, pedimentoNum } = {}) {
  const fromDate = from || ddmmyyyy(LOOKBACK_DAYS)
  const toDate = to || ddmmyyyy(0)

  log.info(`Searching pedimentos: ${fromDate} → ${toDate}${pedimentoNum ? ` (pedimento: ${pedimentoNum})` : ''}`)

  await doGet('/reportes/reportePedimentosTransmitidos.php', cookies)

  const params = {
    FECHAINI: fromDate, FECHAFIN: toDate,
    PATENTE: PATENTE, ADUANA: ADUANA, accion: 'GetHTML',
  }
  const qs = '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  const r = await doGet('/reportes/reportePedimentosTransmitidos.php' + qs, cookies)
  const rows = parseHtmlRows(r.text)
  log.info(`Report returned ${rows.length} raw rows`)

  const pedimentos = []
  const seen = new Set()

  for (const row of rows) {
    if (row.length < 6) continue
    const tipo = row[5] ? row[5].trim().toLowerCase() : ''
    if (tipo !== 'pedimento' && tipo !== 'r1pedimento' && tipo !== 'doda') continue

    const seqNum = (tipo === 'doda' ? row[4] : row[3] || '').trim()
    if (!seqNum) continue
    if (pedimentoNum && !seqNum.includes(pedimentoNum)) continue

    const yr = new Date().getFullYear().toString().slice(-2)
    const ad = (row[2] || ADUANA).toString().slice(0, 2)
    const pedId = `${yr} ${ad} ${PATENTE} ${seqNum}`
    if (seen.has(pedId)) continue
    seen.add(pedId)

    pedimentos.push({
      pedimento_id: pedId, numero_pedimento: seqNum,
      aduana: row[2] || ADUANA, patente: row[1] || PATENTE,
      tipo_operacion: tipo, referencia: row[4] || '', raw_row: row,
    })
  }

  log.info(`Parsed ${pedimentos.length} pedimentos`)
  return pedimentos
}

// ════════════════════════════════════════════════════════════════════════════
// 3. EXTRACT PARTIDAS + CONTRIBUCIONES from pedimento XML
// ════════════════════════════════════════════════════════════════════════════
async function extractDetails(cookies, pedimento) {
  const { numero_pedimento, aduana, referencia } = pedimento
  const path = `/pedimentos/pxml.php?aduana=${aduana}&pedimento=${numero_pedimento}&patente=${PATENTE}&referencia=${encodeURIComponent(referencia || '')}`

  const r = await doGet(path, cookies)

  if (r.status !== 200 || r.text.length < 100 || r.text.includes('<error>')) {
    log.warn(`No XML for pedimento ${numero_pedimento} (status ${r.status}, ${r.text.length} bytes)`)
    return { partidas: [], coves: [], contribuciones: {}, pedimentoMeta: {} }
  }

  const xml = r.text

  // ── Pedimento-level metadata (at001) ──
  const at001Rows = xmlRows(xml, 'at001')
  const hdr = at001Rows[0] || ''
  const pedimentoMeta = {
    clave_pedimento: xmlVal(hdr, 'C001CVEDOC'),
    tipo_cambio: parseNum(xmlVal(hdr, 'F001TIPCAM')),
    peso_bruto: parseNum(xmlVal(hdr, 'F001PESO')),
    fecha_entrada: xmlVal(hdr, 'D001FECEP'),
    fecha_pago: xmlVal(hdr, 'D001FECPAG'),
    valor_dolares: parseNum(xmlVal(hdr, 'F001VALDOL')),
    valor_aduana: parseNum(xmlVal(hdr, 'N001VALADU')),
    rfc_importador: xmlVal(hdr, 'C001RFCCLI'),
  }

  // ── Partidas (at016) ──
  const partidaRows = xmlRows(xml, 'at016')
  const partidas = partidaRows.map((block, idx) => ({
    partida_numero: parseInt(xmlVal(block, 'C016SECFRA') || String(idx + 1), 10),
    fraccion_arancelaria: xmlVal(block, 'C016FRAC'),
    descripcion: xmlVal(block, 'C016DESMER'),
    cantidad_comercial: parseNum(xmlVal(block, 'F016CANUMC')),
    unidad_comercial: xmlVal(block, 'C016UNIUMC'),
    cantidad_tarifa: parseNum(xmlVal(block, 'F016CANUMT')),
    unidad_tarifa: xmlVal(block, 'C016UNIUMT'),
    valor_dolares: parseNum(xmlVal(block, 'F016VALDOL')),
    valor_aduana: parseNum(xmlVal(block, 'N016VALADU')),
    precio_unitario: parseNum(xmlVal(block, 'F016PREUNI')),
    pais_origen: xmlVal(block, 'C016PAISOD'),
    pais_vendedor: xmlVal(block, 'C016PAISCV'),
    marca: xmlVal(block, 'C016MARCA'),
    modelo: xmlVal(block, 'C016MODMER'),
  })).filter(p => p.fraccion_arancelaria || p.descripcion)

  // ── Contribuciones / Taxes (at017) — DTA, IGI, IVA totals ──
  const contribRows = xmlRows(xml, 'at017')
  const contribuciones = { dta: 0, igi: 0, iva: 0, otros: 0 }

  for (const block of contribRows) {
    const code = (xmlVal(block, 'C017CVECON') || '').toUpperCase().trim()
    const amount = parseNum(xmlVal(block, 'F017FORMPA')) || 0
    const rate = parseNum(xmlVal(block, 'F017TASCON')) || 0

    if (code === 'DTA' || code === '15') {
      contribuciones.dta += amount
    } else if (code === 'IGI' || code === '1' || code === 'AD VALOREM') {
      contribuciones.igi += amount
    } else if (code === 'IVA' || code === '21') {
      contribuciones.iva += amount
    } else if (amount > 0) {
      contribuciones.otros += amount
    }
  }

  // Also try at003 section (some XML formats use at003 for pedimento-level contributions)
  const at003Rows = xmlRows(xml, 'at003')
  for (const block of at003Rows) {
    const code = (xmlVal(block, 'C003CVECON') || '').toUpperCase().trim()
    const amount = parseNum(xmlVal(block, 'F003FORMPA')) || 0

    if (code === 'DTA' || code === '15') contribuciones.dta += amount
    else if (code === 'IGI' || code === '1') contribuciones.igi += amount
    else if (code === 'IVA' || code === '21') contribuciones.iva += amount
  }

  if (contribuciones.dta || contribuciones.igi || contribuciones.iva) {
    log.info(`  Contribuciones: DTA=${contribuciones.dta} IGI=${contribuciones.igi} IVA=${contribuciones.iva}`)
  }

  // ── COVEs (at005) ──
  const coveRows = xmlRows(xml, 'at005')
  const coves = coveRows.map(block => ({
    cove_numero: xmlVal(block, 'C005EDOC'),
    pedimento: numero_pedimento,
    factura: xmlVal(block, 'C005NUMFAC'),
    fecha: xmlVal(block, 'D005FECFAC'),
    proveedor: xmlVal(block, 'C005NOMPRO'),
    cve_proveedor: xmlVal(block, 'C005CVEPRO'),
    pais: xmlVal(block, 'C005PAISPR'),
    moneda: xmlVal(block, 'C005MONFAC'),
    incoterm: xmlVal(block, 'C005CVEINC'),
    val_dolares: parseNum(xmlVal(block, 'F005VALDOL')),
    val_moneda: parseNum(xmlVal(block, 'F005VALMEX')),
  })).filter(c => c.cove_numero)

  log.info(`Pedimento ${numero_pedimento}: ${partidas.length} partidas, ${coves.length} COVEs`)
  return { partidas, coves, contribuciones, pedimentoMeta }
}

// ════════════════════════════════════════════════════════════════════════════
// 4. SAVE TO SUPABASE
// ════════════════════════════════════════════════════════════════════════════

async function getCompanyMap() {
  const { data } = await sb.from('companies').select('company_id, clave_cliente').eq('active', true)
  const map = {}
  ;(data || []).forEach(c => { map[c.clave_cliente] = c.company_id })
  return map
}

async function savePedimentos(pedimentos) {
  if (!pedimentos.length) return 0
  const now = new Date().toISOString()
  const rows = pedimentos.map(p => ({
    pedimento_id: p.pedimento_id,
    numero_pedimento: p.numero_pedimento,
    aduana: p.aduana, patente: p.patente,
    tipo_operacion: p.tipo_operacion,
    clave_pedimento: p.meta?.clave_pedimento || null,
    fecha_pago: p.meta?.fecha_pago ? isoDate(p.meta.fecha_pago) : null,
    fecha_entrada: p.meta?.fecha_entrada ? isoDate(p.meta.fecha_entrada) : null,
    valor_aduana: p.meta?.valor_aduana || null,
    valor_dolares: p.meta?.valor_dolares || null,
    rfc_importador: p.meta?.rfc_importador || null,
    tipo_cambio: p.meta?.tipo_cambio || null,
    dta: p.contribuciones?.dta || null,
    igi: p.contribuciones?.igi || null,
    iva: p.contribuciones?.iva || null,
    scraped_at: now,
  }))

  const { error } = await sb.from('pedimentos').upsert(rows, { onConflict: 'pedimento_id' })
  if (error) log.warn(`Save pedimentos: ${error.message}`)
  else log.info(`Upserted ${rows.length} pedimentos`)

  // Also update aduanet_facturas with DTA/IGI/IVA where we have matching pedimentos
  let factUpdated = 0
  for (const p of pedimentos) {
    if (!p.contribuciones?.dta && !p.contribuciones?.igi && !p.contribuciones?.iva) continue
    const { data: updated } = await sb.from('aduanet_facturas')
      .update({
        dta: p.contribuciones.dta || null,
        igi: p.contribuciones.igi || null,
        iva: p.contribuciones.iva || null,
        updated_at: now,
      })
      .like('pedimento', `%${p.numero_pedimento}%`)
      .select('id')
    if (updated?.length) factUpdated += updated.length
  }
  if (factUpdated) log.info(`Updated ${factUpdated} aduanet_facturas with DTA/IGI/IVA`)

  return rows.length
}

async function savePartidas(pedimentoId, partidas) {
  if (!partidas.length) return 0
  const rows = partidas.map(p => ({
    pedimento_id: pedimentoId,
    partida_numero: p.partida_numero,
    fraccion_arancelaria: p.fraccion_arancelaria,
    descripcion: p.descripcion,
    cantidad_comercial: p.cantidad_comercial,
    valor_dolares: p.valor_dolares,
    valor_aduana: p.valor_aduana,
    precio_unitario: p.precio_unitario,
    pais_origen: p.pais_origen,
    marca: p.marca, modelo: p.modelo,
    scraped_at: new Date().toISOString(),
  }))

  const { error } = await sb.from('partidas').upsert(rows, { onConflict: 'pedimento_id,partida_numero' })
  if (error) log.warn(`Save partidas for ${pedimentoId}: ${error.message}`)
  return rows.length
}

async function saveCoves(coves, companyMap) {
  if (!coves.length) return 0
  const rows = coves.map(c => ({
    pedimento: c.pedimento, cove_numero: c.cove_numero,
    factura: c.factura, fecha: c.fecha,
    proveedor: c.proveedor, cve_proveedor: c.cve_proveedor,
    pais: c.pais, moneda: c.moneda, incoterm: c.incoterm,
    val_dolares: c.val_dolares, val_moneda: c.val_moneda,
    company_id: companyMap['9254'] || 'evco', // Patente 3596 = our clients
  }))

  const pedNums = [...new Set(rows.map(r => r.pedimento).filter(Boolean))]
  for (const ped of pedNums) {
    await sb.from('coves').delete().eq('pedimento', ped)
  }
  const { error } = await sb.from('coves').insert(rows)
  if (error) log.warn(`Save COVEs: ${error.message}`)
  else log.info(`Upserted ${rows.length} COVEs`)
  return rows.length
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
async function run(opts = {}) {
  const startTime = Date.now()
  const result = { pedimentosCount: 0, covesCount: 0, partidasCount: 0, error: null }

  try {
    const companyMap = await getCompanyMap()
    const cookies = await login()
    const pedimentos = await searchPedimentos(cookies, {
      from: opts.from, to: opts.to, pedimentoNum: opts.pedimento,
    })

    const allCoves = []
    const allPartidas = []
    for (const ped of pedimentos) {
      try {
        const { partidas, coves, contribuciones, pedimentoMeta } = await extractDetails(cookies, ped)
        ped.meta = pedimentoMeta
        ped.contribuciones = contribuciones
        if (partidas.length) allPartidas.push({ pedimentoId: ped.pedimento_id, partidas })
        allCoves.push(...coves)
        await new Promise(r => setTimeout(r, 500))
      } catch (e) {
        log.warn(`Failed extracting ${ped.numero_pedimento}: ${e.message}`)
      }
    }

    // Save pedimentos FIRST (partidas have FK dependency)
    result.pedimentosCount = await savePedimentos(pedimentos)

    // Then save partidas
    for (const { pedimentoId, partidas } of allPartidas) {
      try {
        result.partidasCount += await savePartidas(pedimentoId, partidas)
      } catch (e) {
        log.warn(`Failed saving partidas for ${pedimentoId}: ${e.message}`)
      }
    }

    const coveMap = new Map()
    for (const c of allCoves) { if (c.cove_numero) coveMap.set(c.cove_numero, c) }
    result.covesCount = await saveCoves(Array.from(coveMap.values()), companyMap)

    log.info(`Done: ${result.pedimentosCount} pedimentos, ${result.partidasCount} partidas, ${result.covesCount} COVEs`)
    await tg(`✅ <b>ADUANET scraped</b>\n${result.pedimentosCount} pedimentos · ${result.partidasCount} partidas · ${result.covesCount} COVEs\n— CRUZ 🦀`)
  } catch (e) {
    result.error = e.message
    log.error(`FATAL: ${e.message}`)
    await tg(`🔴 <b>ADUANET scraper failed</b>\n${e.message}\n— CRUZ 🦀`)
  }

  result.durationMs = Date.now() - startTime

  await sb.from('scrape_runs').insert({
    source: 'aduanet_scraper',
    started_at: new Date(startTime).toISOString(),
    completed_at: new Date().toISOString(),
    status: result.error ? 'error' : 'success',
    error_message: result.error || null,
    records_found: result.pedimentosCount,
    metadata: { partidas: result.partidasCount, coves: result.covesCount, duration_ms: result.durationMs },
  })

  return result
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2)
  const opts = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pedimento' && args[i + 1]) opts.pedimento = args[++i]
    if (args[i] === '--from' && args[i + 1]) opts.from = args[++i]
    if (args[i] === '--to' && args[i + 1]) opts.to = args[++i]
  }

  run(opts).then(r => {
    if (r.error) { log.error(r.error); process.exit(1) }
    process.exit(0)
  })
}

module.exports = { login, searchPedimentos, extractDetails, run }
