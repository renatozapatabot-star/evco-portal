#!/usr/bin/env node
/**
 * ADUANET Scraper — Login, Search by Pedimento, Extract Partidas + COVEs → Supabase
 *
 * Usage:
 *   node src/aduanet.js                         # full scrape (LOOKBACK_DAYS)
 *   node src/aduanet.js --pedimento 6500507     # single pedimento lookup
 *   node src/aduanet.js --from 01/01/2025       # custom date range
 */
// Load .env.local from the parent evco-portal directory (where the laptop's
// canonical secrets live). The original `dotenv.config()` looked for `.env`
// in CWD which only works when this script runs from inside its own dir.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env.local') });
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// ── Config ──────────────────────────────────────────────────────────────────
const ADUANET_HOST = 'www.aduanetm3.net';
const ADUANET_PORT = 443;
const USER   = process.env.ADUANET_USERNAME || process.env.ADUANET_USER;
const PASS   = process.env.ADUANET_PASSWORD || process.env.ADUANET_PASS;
const IDRA   = process.env.ADUANET_IDRA || 'RZGA01';
const PATENTE = process.env.EVCO_QUERIES || '3596';
const ADUANA  = process.env.ADUANA || '240';
const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || '90', 10);

// Env passthrough: the laptop's .env.local uses NEXT_PUBLIC_SUPABASE_URL,
// not bare SUPABASE_URL. Accept either to avoid duplicating secrets.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY env vars required');
}
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ── Tenant maps ─────────────────────────────────────────────────────────────
// Per .claude/rules/tenant-isolation.md: trust cve_cliente (and rfc) as the
// authoritative ownership signals; derive company_id from the active
// companies allowlist; never default. Built once per run() in loadTenantMaps.
let claveToCompany = {}; // clave_cliente or globalpc_clave → company_id
let rfcToCompany = {};   // companies.rfc → company_id

async function loadTenantMaps() {
  const { data, error } = await sb
    .from('companies')
    .select('clave_cliente, globalpc_clave, rfc, company_id')
    .eq('active', true);
  if (error) throw new Error(`Loading companies: ${error.message}`);
  claveToCompany = {};
  rfcToCompany = {};
  for (const c of (data || [])) {
    if (c.clave_cliente) claveToCompany[c.clave_cliente] = c.company_id;
    if (c.globalpc_clave) claveToCompany[c.globalpc_clave] = c.company_id;
    if (c.rfc) rfcToCompany[c.rfc.toUpperCase()] = c.company_id;
  }
  logger.info(`Tenant maps loaded: ${Object.keys(claveToCompany).length} claves, ${Object.keys(rfcToCompany).length} RFCs`);
}

function deriveCompanyId({ rfc, clave }) {
  if (rfc) {
    const id = rfcToCompany[rfc.toUpperCase()];
    if (id) return id;
  }
  if (clave) {
    const id = claveToCompany[clave];
    if (id) return id;
  }
  return null;
}

function deriveClaveCliente({ rfc, clave, companyId }) {
  if (clave) return clave;
  // Reverse-lookup clave from companyId so each row carries both signals.
  if (companyId) {
    for (const [k, v] of Object.entries(claveToCompany)) {
      if (v === companyId) return k;
    }
  }
  return null;
}

// ── HTTP helpers (plain HTTP — aduanetm3.net uses port 80) ──────────────────
function rawReq(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({
        text: Buffer.concat(chunks).toString(),
        status: res.statusCode,
        sc: res.headers['set-cookie'] || [],
        headers: res.headers,
      }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

function doGet(path, cookies) {
  return rawReq({
    hostname: ADUANET_HOST, port: ADUANET_PORT, path, method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      ...(cookies ? { Cookie: cookies } : {}),
    },
  });
}

function doPost(path, data, cookies) {
  const body = Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return rawReq({
    hostname: ADUANET_HOST, port: ADUANET_PORT, path, method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      'Content-Length': Buffer.byteLength(body),
      ...(cookies ? { Cookie: cookies } : {}),
    },
  }, body);
}

function mergeCookies(existing, newCookies) {
  const c = {};
  if (existing) {
    existing.split('; ').forEach(x => {
      const i = x.indexOf('=');
      if (i > 0) c[x.slice(0, i)] = x.slice(i + 1);
    });
  }
  newCookies.forEach(s => {
    const kv = s.split(';')[0];
    const i = kv.indexOf('=');
    if (i > 0) c[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });
  return Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ── Date helpers ────────────────────────────────────────────────────────────
function ddmmyyyy(daysBack = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function isoDate(ddmm) {
  if (!ddmm) return null;
  const p = ddmm.split('/');
  if (p.length !== 3) return null;
  return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
}

function parseNum(str) {
  if (!str) return null;
  return parseFloat(str.replace(/[$,\s]/g, '')) || null;
}

// ── HTML table parser ───────────────────────────────────────────────────────
function parseHtmlRows(html) {
  const rows = [];
  (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []).forEach(row => {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map(td => td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    if (cells.length >= 3 && cells.some(c => c.length > 0)) rows.push(cells);
  });
  return rows;
}

// ── XML helpers ─────────────────────────────────────────────────────────────
// ADUANET XML uses CDATA: <TAG><![CDATA[value]]></TAG>
function xmlVal(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
  return m ? m[1].trim() : null;
}

function xmlAll(xml, tag) {
  const results = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

// Extract all <row> blocks within an <atXXX> section
function xmlRows(xml, section) {
  const secBlock = xml.match(new RegExp(`<${section}>([\\s\\S]*?)<\\/${section}>`));
  if (!secBlock) return [];
  const rows = [];
  const re = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let m;
  while ((m = re.exec(secBlock[1])) !== null) rows.push(m[1]);
  return rows;
}

// ════════════════════════════════════════════════════════════════════════════
// 1. LOGIN
// ════════════════════════════════════════════════════════════════════════════
async function login() {
  logger.info('Authenticating with ADUANET M3…');

  const r1 = await doGet('/loginI.php');
  let ck = mergeCookies('', r1.sc);

  const r2 = await doPost('/login_auth.php', { accion: 'getUrl', idra: IDRA }, ck);
  ck = mergeCookies(ck, r2.sc);

  const r3 = await doPost('/loginV.php', {
    accion: 'validLogin', userid: USER, userpwd: PASS, idra: IDRA, sistema: 'am3',
  }, ck);
  ck = mergeCookies(ck, r3.sc);

  if (!r3.text.includes('VALID')) {
    throw new Error(`Auth failed: ${r3.text.slice(0, 120)}`);
  }

  // Establish session
  const r4 = await doGet('/herramientas/home.php', ck);
  ck = mergeCookies(ck, r4.sc);

  logger.info('Auth successful');
  return ck;
}

// ════════════════════════════════════════════════════════════════════════════
// 2. SEARCH PEDIMENTOS (by date range or specific pedimento number)
// ════════════════════════════════════════════════════════════════════════════
async function searchPedimentos(cookies, { from, to, pedimentoNum } = {}) {
  const fromDate = from || ddmmyyyy(LOOKBACK_DAYS);
  const toDate = to || ddmmyyyy(0);

  logger.info(`Searching pedimentos: ${fromDate} → ${toDate}${pedimentoNum ? ` (pedimento: ${pedimentoNum})` : ''}`);

  // Hit the report page first to init session state
  await doGet('/reportes/reportePedimentosTransmitidos.php', cookies);

  const params = {
    FECHAINI: fromDate,
    FECHAFIN: toDate,
    PATENTE: PATENTE,
    ADUANA: ADUANA,
    accion: 'GetHTML',
  };

  const qs = '?' + Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const r = await doGet('/reportes/reportePedimentosTransmitidos.php' + qs, cookies);
  const rows = parseHtmlRows(r.text);
  logger.info(`Report returned ${rows.length} raw rows`);

  // Parse into structured pedimentos
  const pedimentos = [];
  const seen = new Set();

  for (const row of rows) {
    if (row.length < 6) continue;
    const tipo = row[5] ? row[5].trim().toLowerCase() : '';
    if (tipo !== 'pedimento' && tipo !== 'r1pedimento' && tipo !== 'doda') continue;

    const seqNum = (tipo === 'doda' ? row[4] : row[3] || '').trim();
    if (!seqNum) continue;

    // Filter by specific pedimento number if provided
    if (pedimentoNum && !seqNum.includes(pedimentoNum)) continue;

    // pedimento_id: "YY AD PATENTE NUM" — derive year from 2-digit prefix or current
    const yr = new Date().getFullYear().toString().slice(-2);
    const ad = (row[2] || ADUANA).toString().slice(0, 2);
    const pedId = `${yr} ${ad} ${PATENTE} ${seqNum}`;
    if (seen.has(pedId)) continue;
    seen.add(pedId);

    pedimentos.push({
      pedimento_id: pedId,
      numero_pedimento: seqNum,
      aduana: row[2] || ADUANA,
      patente: row[1] || PATENTE,
      tipo_operacion: tipo,
      referencia: row[4] || '',
      raw_row: row,
    });
  }

  logger.info(`Parsed ${pedimentos.length} pedimentos`);
  return pedimentos;
}

// ════════════════════════════════════════════════════════════════════════════
// 3. EXTRACT PARTIDAS from pedimento XML
// ════════════════════════════════════════════════════════════════════════════
async function extractPartidas(cookies, pedimento) {
  const { numero_pedimento, aduana, referencia } = pedimento;
  const path = `/pedimentos/pxml.php?aduana=${aduana}&pedimento=${numero_pedimento}&patente=${PATENTE}&referencia=${encodeURIComponent(referencia || '')}`;

  const r = await doGet(path, cookies);

  if (r.status !== 200 || r.text.length < 100 || r.text.includes('<error>')) {
    logger.warn(`No XML for pedimento ${numero_pedimento} (status ${r.status}, ${r.text.length} bytes)`);
    return { partidas: [], coves: [], pedimentoMeta: {} };
  }

  const xml = r.text;

  // ── Pedimento-level metadata (at001 section → first row) ──
  const at001Rows = xmlRows(xml, 'at001');
  const hdr = at001Rows[0] || '';
  const pedimentoMeta = {
    clave_pedimento: xmlVal(hdr, 'C001CVEDOC'),
    tipo_cambio: parseNum(xmlVal(hdr, 'F001TIPCAM')),
    peso_bruto: parseNum(xmlVal(hdr, 'F001PESO')),
    fecha_entrada: xmlVal(hdr, 'D001FECEP'),
    fecha_pago: xmlVal(hdr, 'D001FECPAG'),
    valor_dolares: parseNum(xmlVal(hdr, 'F001VALDOL')),
    valor_aduana: parseNum(xmlVal(hdr, 'N001VALADU')),
    rfc_importador: xmlVal(hdr, 'C001RFCCLI'),
  };

  // ── Partidas (line items in at016 section, C016* tags) ──
  const partidaRows = xmlRows(xml, 'at016');
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
    vinculacion: xmlVal(block, 'C016VINCU'),
    metodo_valoracion: xmlVal(block, 'C016METVAL'),
  })).filter(p => p.fraccion_arancelaria || p.descripcion);

  // ── COVEs from XML (at005 section, C005*/I005* tags) ──
  const coveRows = xmlRows(xml, 'at005');
  const coves = coveRows.map(block => ({
    cove_numero: xmlVal(block, 'C005EDOC'),
    pedimento: numero_pedimento,
    factura: xmlVal(block, 'C005NUMFAC'),
    fecha: xmlVal(block, 'D005FECFAC'),
    proveedor: xmlVal(block, 'C005NOMPRO'),
    cve_proveedor: xmlVal(block, 'C005CVEPRO'),
    id_proveedor: xmlVal(block, 'C005IDEPRO'),
    domicilio: xmlVal(block, 'C005DOMPRO'),
    pais: xmlVal(block, 'C005PAISPR'),
    moneda: xmlVal(block, 'C005MONFAC'),
    incoterm: xmlVal(block, 'C005CVEINC'),
    val_dolares: parseNum(xmlVal(block, 'F005VALDOL')),
    val_moneda: parseNum(xmlVal(block, 'F005VALMEX')),
    vinculacion: xmlVal(block, 'C005VINCU'),
    rfc_emisor: xmlVal(block, 'C005RFCEMI'),
    rfc_receptor: xmlVal(block, 'C005RFCREC'),
  })).filter(c => c.cove_numero);

  // ── Contribuciones (at008 section — pedimento-level totals per concepto) ──
  // Field map confirmed against pedimento 6500299 on 2026-04-29:
  //   C008CVECON ∈ {DTA, IGI/IGE, IVA, IEPS, PREV, IVA PRV}
  //   N008IMPCON = importe (MXN)
  // at017 was the original target per the plan but does NOT exist in
  // current ADUANET XML output. at008 is the canonical source.
  const at008Rows = xmlRows(xml, 'at008');
  const contribuciones = { dta: 0, igi: 0, iva: 0, ieps: 0, prev: 0, iva_prv: 0 };
  let contribucionesPresent = false;
  for (const block of at008Rows) {
    const cve = (xmlVal(block, 'C008CVECON') || '').toUpperCase().trim();
    const monto = parseNum(xmlVal(block, 'N008IMPCON')) || 0;
    if (!cve) continue;
    contribucionesPresent = true;
    if (cve === 'DTA') contribuciones.dta += monto;
    else if (cve === 'IGI/IGE' || cve === 'IGI') contribuciones.igi += monto;
    else if (cve === 'IVA') contribuciones.iva += monto;
    else if (cve === 'IEPS') contribuciones.ieps += monto;
    else if (cve === 'PREV') contribuciones.prev += monto;
    else if (cve === 'IVA PRV' || cve === 'IVA PREV') contribuciones.iva_prv += monto;
  }

  logger.info(`Pedimento ${numero_pedimento}: ${partidas.length} partidas, ${coves.length} COVEs, ${at008Rows.length} contribuciones rows`);
  return { partidas, coves, pedimentoMeta, contribuciones, contribucionesPresent };
}

// ════════════════════════════════════════════════════════════════════════════
// 4. SEARCH COVEs via report endpoint (fallback when XML has no COVEs)
// ════════════════════════════════════════════════════════════════════════════
async function searchCoves(cookies, { from, to } = {}) {
  const fromDate = from || ddmmyyyy(LOOKBACK_DAYS);
  const toDate = to || ddmmyyyy(0);

  logger.info(`Searching COVEs: ${fromDate} → ${toDate}`);

  const qs = `?FECHAINI=${encodeURIComponent(fromDate)}&FECHAFIN=${encodeURIComponent(toDate)}&PATENTE=${PATENTE}&ADUANA=${ADUANA}&accion=GetHTML`;
  const r = await doGet('/reportes/reporteCove1.php' + qs, cookies);
  const rows = parseHtmlRows(r.text);
  logger.info(`COVE report: ${rows.length} rows`);

  const coves = rows.map(row => {
    if (row.length < 6) return null;
    return {
      cove_id: row[0] || null,
      aduana: row[1] || ADUANA,
      patente: PATENTE,
      tipo_operacion: row[2] || null,
      fecha_emision: isoDate(row[3]),
      rfc_emisor: row[4] || null,
      rfc_receptor: row[5] || null,
      valor_comercial: parseNum(row[6]),
      moneda: row[7] || null,
      incoterm: row[8] || null,
      status: row[9] || 'ACTIVO',
      scraped_at: new Date().toISOString(),
    };
  }).filter(c => c && c.cove_id);

  logger.info(`Parsed ${coves.length} COVEs`);
  return coves;
}

// ════════════════════════════════════════════════════════════════════════════
// 5. SAVE TO SUPABASE
// ════════════════════════════════════════════════════════════════════════════
async function savePedimentos(pedimentos) {
  if (!pedimentos.length) return 0;
  const now = new Date().toISOString();
  const rows = pedimentos.map(p => ({
    pedimento_id: p.pedimento_id,
    numero_pedimento: p.numero_pedimento,
    aduana: p.aduana,
    patente: p.patente,
    tipo_operacion: p.tipo_operacion,
    clave_pedimento: p.meta?.clave_pedimento || null,
    fecha_pago: p.meta?.fecha_pago ? isoDate(p.meta.fecha_pago) : null,
    fecha_entrada: p.meta?.fecha_entrada ? isoDate(p.meta.fecha_entrada) : null,
    valor_aduana: p.meta?.valor_aduana || null,
    rfc_importador: p.meta?.rfc_importador || null,
    tipo_cambio: p.meta?.tipo_cambio || null,
    scraped_at: now,
    raw: p.raw_row,
  }));

  const { error } = await sb.from('pedimentos').upsert(rows, { onConflict: 'pedimento_id' });
  if (error) throw new Error(`Save pedimentos: ${error.message}`);
  logger.info(`Upserted ${rows.length} pedimentos`);
  return rows.length;
}

async function savePartidas(pedimentoId, partidas) {
  if (!partidas.length) return 0;
  const now = new Date().toISOString();
  const rows = partidas.map(p => ({
    pedimento_id: pedimentoId,
    partida_numero: p.partida_numero,
    fraccion_arancelaria: p.fraccion_arancelaria,
    descripcion: p.descripcion,
    cantidad_comercial: p.cantidad_comercial,
    unidad_comercial: p.unidad_comercial,
    cantidad_tarifa: p.cantidad_tarifa,
    unidad_tarifa: p.unidad_tarifa,
    valor_dolares: p.valor_dolares,
    valor_aduana: p.valor_aduana,
    precio_unitario: p.precio_unitario,
    pais_origen: p.pais_origen,
    pais_vendedor: p.pais_vendedor,
    marca: p.marca,
    modelo: p.modelo,
    vinculacion: p.vinculacion,
    metodo_valoracion: p.metodo_valoracion,
    scraped_at: now,
  }));

  const { error } = await sb.from('partidas').upsert(rows, {
    onConflict: 'pedimento_id,partida_numero',
  });
  if (error) throw new Error(`Save partidas for ${pedimentoId}: ${error.message}`);
  return rows.length;
}

async function saveCoves(coves) {
  if (!coves.length) return 0;
  // Derive company_id per row from the parent pedimento's RFC. Per
  // .claude/rules/tenant-isolation.md: trust authoritative signals
  // (cve_cliente, RFC); never default to 'evco'. Rows whose parent_rfc
  // is missing or doesn't match a company in the active allowlist are
  // skipped + logged.
  const rows = [];
  let skippedNoOwner = 0;
  const skippedRfcs = {};
  for (const c of coves) {
    const companyId = deriveCompanyId({ rfc: c.parent_rfc });
    if (!companyId) {
      skippedNoOwner++;
      const k = c.parent_rfc || '(no rfc)';
      skippedRfcs[k] = (skippedRfcs[k] || 0) + 1;
      continue;
    }
    rows.push({
      pedimento: c.pedimento,
      cove_numero: c.cove_numero,
      factura: c.factura,
      fecha: c.fecha,
      proveedor: c.proveedor,
      cve_proveedor: c.cve_proveedor,
      id_proveedor: c.id_proveedor,
      domicilio: c.domicilio,
      pais: c.pais,
      moneda: c.moneda,
      incoterm: c.incoterm,
      val_dolares: c.val_dolares,
      val_moneda: c.val_moneda,
      vinculacion: c.vinculacion,
      company_id: companyId,
    });
  }
  if (skippedNoOwner > 0) {
    logger.warn(`COVEs skipped (no allowlisted owner derivable from RFC): ${skippedNoOwner}, by RFC: ${JSON.stringify(skippedRfcs)}`);
  }

  if (!rows.length) return 0;

  // Idempotency: delete existing rows for the (pedimento, company_id) pairs
  // present in this batch, then insert fresh. Per-(pedimento, company_id)
  // delete rather than per-pedimento avoids touching other tenants' rows.
  const seenKeys = new Set();
  for (const r of rows) {
    const k = `${r.pedimento}|${r.company_id}`;
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    await sb.from('coves').delete().eq('pedimento', r.pedimento).eq('company_id', r.company_id);
  }
  const { error } = await sb.from('coves').insert(rows);
  if (error) throw new Error(`Save COVEs: ${error.message}`);
  logger.info(`Inserted ${rows.length} COVEs across ${seenKeys.size} (pedimento, company) groups`);
  return rows.length;
}

// ──────────────────────────────────────────────────────────────────────────
// aduanet_facturas — per-COVE row carrying pedimento-level contribuciones
//
// Schema mapped from production aduanet_facturas (verified 2026-04-29):
//   pedimento, patente, aduana, referencia, nombre_cliente, clave_cliente,
//   rfc, fecha_pago, operacion, marca_numero, peso, cve_documento,
//   tipo_cambio, fletes, seguro, embalaje, otros_incrementos,
//   totales_incrementales, valor_total, valor_usd, dta, igi, iva, ieps,
//   num_factura, cove, fecha_factura, incoterm, moneda, proveedor,
//   tx_id, tenant_id, company_id, tenant_slug, created_at
//
// One row per COVE (factura) per pedimento. DTA/IGI/IVA/IEPS values are
// pedimento-level totals from at008 — they're CARRIED on each COVE row of
// the pedimento (matches the existing 459-row distribution where multiple
// facturas under the same pedimento share the same contribuciones values).
//
// Idempotency: delete existing (pedimento, company_id) tuples for the
// pedimentos in this batch, then insert fresh. No table-level unique
// constraint exists, so onConflict upsert is unsafe.
async function saveAduanetFacturas(coves, pedimentoMeta, contribuciones) {
  if (!coves.length) return 0;

  const rows = [];
  let skippedNoOwner = 0;
  const skippedRfcs = {};
  for (const c of coves) {
    const rfc = c.parent_rfc || pedimentoMeta?.rfc_importador || null;
    const companyId = deriveCompanyId({ rfc });
    if (!companyId) {
      skippedNoOwner++;
      const k = rfc || '(no rfc)';
      skippedRfcs[k] = (skippedRfcs[k] || 0) + 1;
      continue;
    }
    const claveCliente = deriveClaveCliente({ companyId });
    rows.push({
      pedimento: c.pedimento,
      patente: c.parent_patente || PATENTE,
      aduana: c.parent_aduana || ADUANA,
      referencia: c.parent_referencia || null,
      nombre_cliente: pedimentoMeta?.nombre_cliente || null,
      clave_cliente: claveCliente,
      rfc: rfc,
      fecha_pago: pedimentoMeta?.fecha_pago ? isoDate(pedimentoMeta.fecha_pago) : null,
      operacion: c.parent_operacion || null,
      cve_documento: pedimentoMeta?.clave_pedimento || null,
      tipo_cambio: pedimentoMeta?.tipo_cambio || null,
      fletes: 0,
      seguro: 0,
      embalaje: 0,
      otros_incrementos: 0,
      totales_incrementales: 0,
      valor_total: c.val_moneda ?? c.val_dolares ?? null,
      valor_usd: c.val_dolares ?? null,
      dta: contribuciones?.dta || null,
      igi: contribuciones?.igi || null,
      iva: contribuciones?.iva || null,
      ieps: contribuciones?.ieps || null,
      num_factura: c.factura || null,
      cove: c.cove_numero || null,
      fecha_factura: c.fecha || null,
      incoterm: c.incoterm || null,
      moneda: c.moneda || null,
      proveedor: c.proveedor || null,
      company_id: companyId,
    });
  }
  if (skippedNoOwner > 0) {
    logger.warn(`aduanet_facturas skipped (no allowlisted owner derivable from RFC): ${skippedNoOwner}, by RFC: ${JSON.stringify(skippedRfcs)}`);
  }

  if (!rows.length) return 0;

  // Idempotency by (pedimento, company_id). Each tuple is deleted once
  // before the bulk insert, so re-running the scraper for the same
  // pedimento doesn't accumulate duplicates.
  const seenKeys = new Set();
  for (const r of rows) {
    const k = `${r.pedimento}|${r.company_id}`;
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    await sb.from('aduanet_facturas').delete().eq('pedimento', r.pedimento).eq('company_id', r.company_id);
  }
  const { error } = await sb.from('aduanet_facturas').insert(rows);
  if (error) throw new Error(`Save aduanet_facturas: ${error.message}`);
  logger.info(`Inserted ${rows.length} aduanet_facturas rows across ${seenKeys.size} (pedimento, company) groups`);
  return rows.length;
}

async function logRun(result) {
  const { error } = await sb.from('scrape_runs').insert({
    status: result.error ? 'error' : 'success',
    pedimentos_count: result.pedimentosCount,
    coves_count: result.covesCount,
    error_msg: result.error || null,
    duration_ms: result.durationMs,
    ran_at: new Date().toISOString(),
  });
  if (error) logger.warn(`Could not log run: ${error.message}`);
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
async function run(opts = {}) {
  const startTime = Date.now();
  const result = { pedimentosCount: 0, covesCount: 0, partidasCount: 0, aduanetFacturasCount: 0, error: null };

  try {
    // 0. Build the active-companies allowlist (clave + RFC → company_id)
    await loadTenantMaps();

    // 1. Login
    const cookies = await login();

    // 2. Search pedimentos
    const pedimentos = await searchPedimentos(cookies, {
      from: opts.from,
      to: opts.to,
      pedimentoNum: opts.pedimento,
    });

    // 3. For each pedimento, extract partidas + COVEs + contribuciones from XML
    const allPartidas = []; // { pedimentoId, partidas[] }
    const allCoves = [];    // each COVE carries parent meta for tenant derivation
    const facturasBatches = []; // { coves, pedimentoMeta, contribuciones }

    for (const ped of pedimentos) {
      try {
        const { partidas, coves, pedimentoMeta, contribuciones, contribucionesPresent } = await extractPartidas(cookies, ped);
        ped.meta = pedimentoMeta;
        if (partidas.length) allPartidas.push({ pedimentoId: ped.pedimento_id, partidas });

        // Attach parent context to each COVE so downstream writers (saveCoves,
        // saveAduanetFacturas) can derive company_id without needing the
        // pedimento object.
        const enrichedCoves = coves.map(c => ({
          ...c,
          parent_rfc: pedimentoMeta?.rfc_importador || null,
          parent_patente: ped.patente,
          parent_aduana: ped.aduana,
          parent_referencia: ped.referencia,
          parent_operacion: ped.tipo_operacion,
        }));
        allCoves.push(...enrichedCoves);

        // Build a per-pedimento aduanet_facturas batch. Carry the pedimento
        // metadata + at008 contribuciones so saveAduanetFacturas can write
        // one row per COVE with the right tax totals copied across.
        if (enrichedCoves.length > 0) {
          facturasBatches.push({
            coves: enrichedCoves,
            pedimentoMeta: { ...pedimentoMeta, nombre_cliente: ped.raw_row?.[7] || null },
            contribuciones: contribucionesPresent ? contribuciones : null,
          });
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        logger.warn(`Failed extracting details for ${ped.numero_pedimento}: ${e.message}`);
      }
    }

    // 4. Save pedimentos FIRST (partidas have FK dependency)
    result.pedimentosCount = await savePedimentos(pedimentos);

    // 5. Save partidas (now that parent pedimentos exist)
    let totalPartidas = 0;
    for (const { pedimentoId, partidas } of allPartidas) {
      try {
        totalPartidas += await savePartidas(pedimentoId, partidas);
      } catch (e) {
        logger.warn(`Failed saving partidas for ${pedimentoId}: ${e.message}`);
      }
    }

    // 6. Save COVEs (deduplicate by cove_numero, keep parent context)
    const coveMap = new Map();
    for (const c of allCoves) {
      if (c.cove_numero) coveMap.set(c.cove_numero, c);
    }
    const mergedCoves = Array.from(coveMap.values());
    result.covesCount = await saveCoves(mergedCoves);
    result.partidasCount = totalPartidas;

    // 7. Save aduanet_facturas (per-COVE row + at008 contribuciones)
    let totalFacturas = 0;
    for (const batch of facturasBatches) {
      try {
        totalFacturas += await saveAduanetFacturas(batch.coves, batch.pedimentoMeta, batch.contribuciones);
      } catch (e) {
        logger.warn(`Failed saving aduanet_facturas for pedimento batch: ${e.message}`);
      }
    }
    result.aduanetFacturasCount = totalFacturas;

    logger.info(`Done: ${result.pedimentosCount} pedimentos, ${result.partidasCount} partidas, ${result.covesCount} COVEs, ${result.aduanetFacturasCount} aduanet_facturas`);
  } catch (e) {
    result.error = e.message;
    logger.error(`FATAL: ${e.message}`, { stack: e.stack });
  }

  result.durationMs = Date.now() - startTime;
  await logRun(result);
  return result;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pedimento' && args[i + 1]) opts.pedimento = args[++i];
    if (args[i] === '--from' && args[i + 1]) opts.from = args[++i];
    if (args[i] === '--to' && args[i + 1]) opts.to = args[++i];
  }

  run(opts).then(r => {
    if (r.error) {
      logger.error(r.error);
      process.exit(1);
    }
    process.exit(0);
  });
}

module.exports = { login, searchPedimentos, extractPartidas, searchCoves, run };
