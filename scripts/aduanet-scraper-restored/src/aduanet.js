#!/usr/bin/env node
/**
 * ADUANET Scraper — Login, Search by Pedimento, Extract Partidas + COVEs → Supabase
 *
 * Usage:
 *   node src/aduanet.js                         # full scrape (LOOKBACK_DAYS)
 *   node src/aduanet.js --pedimento 6500507     # single pedimento lookup
 *   node src/aduanet.js --from 01/01/2025       # custom date range
 */
require('dotenv').config();
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

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

  logger.info(`Pedimento ${numero_pedimento}: ${partidas.length} partidas, ${coves.length} COVEs`);
  return { partidas, coves, pedimentoMeta };
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

async function saveCoves(coves, pedimentoId) {
  if (!coves.length) return 0;
  // Match existing coves table schema: cove_numero is the unique COVE identifier
  const rows = coves.map(c => ({
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
    company_id: 'evco',
  }));

  // No unique constraint on cove_numero — delete existing for this pedimento, then insert fresh
  const pedNums = [...new Set(rows.map(r => r.pedimento).filter(Boolean))];
  for (const ped of pedNums) {
    await sb.from('coves').delete().eq('pedimento', ped).eq('company_id', 'evco');
  }
  const { error } = await sb.from('coves').insert(rows);
  if (error) throw new Error(`Save COVEs: ${error.message}`);
  logger.info(`Upserted ${rows.length} COVEs`);
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
  const result = { pedimentosCount: 0, covesCount: 0, partidasCount: 0, error: null };

  try {
    // 1. Login
    const cookies = await login();

    // 2. Search pedimentos
    const pedimentos = await searchPedimentos(cookies, {
      from: opts.from,
      to: opts.to,
      pedimentoNum: opts.pedimento,
    });

    // 3. For each pedimento, extract partidas + COVEs from XML
    const allPartidas = []; // { pedimentoId, partidas[] }
    const allCoves = [];

    for (const ped of pedimentos) {
      try {
        const { partidas, coves, pedimentoMeta } = await extractPartidas(cookies, ped);
        ped.meta = pedimentoMeta;
        if (partidas.length) allPartidas.push({ pedimentoId: ped.pedimento_id, partidas });
        allCoves.push(...coves);
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

    // 6. Save COVEs (deduplicate by cove_numero)
    const coveMap = new Map();
    for (const c of allCoves) {
      if (c.cove_numero) coveMap.set(c.cove_numero, c);
    }
    const mergedCoves = Array.from(coveMap.values());
    result.covesCount = await saveCoves(mergedCoves);
    result.partidasCount = totalPartidas;

    logger.info(`Done: ${result.pedimentosCount} pedimentos, ${result.partidasCount} partidas, ${result.covesCount} COVEs`);
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
