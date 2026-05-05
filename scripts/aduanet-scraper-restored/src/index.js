#!/usr/bin/env node
/**
 * ADUANET M3 Scraper v3 — HTTP-based (no Playwright, no headless browser)
 * Runs every 2 AM and 2 PM via cron
 * Auth: loginI.php → loginV.php (VALID confirmation)
 * Data: GET reportePedimentosTransmitidos.php?accion=GetHTML
 */
require('dotenv').config();
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required');
const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || '1461', 10); // 4 years default

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString().replace('T',' ').slice(0,19), msg }) + '\n');
}

function rawReq(opts, body) {
  return new Promise((res, rej) => {
    const r = https.request(opts, resp => {
      const c = []; resp.on('data', d => c.push(d));
      resp.on('end', () => res({ text: Buffer.concat(c).toString(), sc: resp.headers['set-cookie'] || [] }));
    });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
}

function doGet(path, cookies) {
  return rawReq({ hostname: 'www.aduanetm3.net', path, method: 'GET', port: 443,
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36', ...(cookies ? { Cookie: cookies } : {}) } });
}

function doPost(path, data, cookies) {
  const body = Object.entries(data).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return rawReq({ hostname: 'www.aduanetm3.net', path, method: 'POST', port: 443,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      'Content-Length': Buffer.byteLength(body), ...(cookies ? { Cookie: cookies } : {}) } }, body);
}

function mergeCookies(existing, newCookies) {
  const c = {};
  if (existing) existing.split('; ').forEach(x => { const i = x.indexOf('='); if (i > 0) c[x.slice(0, i)] = x.slice(i + 1); });
  newCookies.forEach(s => { const kv = s.split(';')[0]; const i = kv.indexOf('='); if (i > 0) c[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
  return Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; ');
}

function parseRows(html) {
  const rows = [];
  (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []).forEach(row => {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map(td => td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    if (cells.length >= 5 && cells.some(c => c.length > 1)) rows.push(cells);
  });
  return rows;
}

function dateParam(daysBack) {
  const d = new Date(); d.setDate(d.getDate() - daysBack);
  // ADUANET uses DD/MM/YYYY format
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

async function run() {
  log('ADUANET scraper starting...');
  
  // Auth
  const r1 = await doGet('/loginI.php'); let ck = mergeCookies('', r1.sc);
  const r2 = await doPost('/login_auth.php', { accion: 'getUrl', idra: 'RZGA01' }, ck); ck = mergeCookies(ck, r2.sc);
  const user = process.env.ADUANET_USER || process.env.ADUANET_USERNAME;
  const pass = process.env.ADUANET_PASSWORD || process.env.ADUANET_PASS;
  if (!user || !pass) throw new Error('ADUANET_USER and ADUANET_PASSWORD env vars required');
  const r3 = await doPost('/loginV.php', { accion: 'validLogin', userid: user, userpwd: pass, idra: 'RZGA01', sistema: 'am3' }, ck); ck = mergeCookies(ck, r3.sc);
  if (!r3.text.includes('VALID')) throw new Error('Auth failed: ' + r3.text.slice(0, 80));
  log('Auth successful ✅');
  
  const r4 = await doGet('/herramientas/home.php', ck); ck = mergeCookies(ck, r4.sc);
  await doGet('/reportes/reportePedimentosTransmitidos.php', ck);
  
  // Pull pedimentos
  const from = dateParam(LOOKBACK_DAYS), to = dateParam(0);
  log(`Pulling records from ${from} to ${to}`);
  const qs = `?FECHAINI=${encodeURIComponent(from)}&FECHAFIN=${encodeURIComponent(to)}&PATENTE=3596&ADUANA=240&accion=GetHTML`;
  const rp = await doGet('/reportes/reportePedimentosTransmitidos.php' + qs, ck);
  const rows = parseRows(rp.text);
  log(`Pedimentos report: ${rows.length} rows`);
  
  const now = new Date().toISOString();
  const seen = new Set();
  const docs = [];
  
  rows.forEach(row => {
    if (row.length < 6) return;
    const tipo = row[5].trim();
    const ref = row[4] || '';
    // DODAs have empty row[3]; their ID is in row[4]
    const seqNum = (tipo === 'doda' ? row[4] : row[3] || '').trim();
    if (!tipo || !seqNum) return;
    let docType = tipo === 'pedimento' || tipo === 'r1pedimento' ? 'pedimento_detallado' : tipo === 'doda' ? 'doda' : null;
    if (!docType) return;
    const pedId = '26 24 3596 ' + seqNum;
    const key = pedId + '|' + docType + '|' + seqNum;
    if (seen.has(key)) return; seen.add(key);
    docs.push({ pedimento_id: pedId, doc_type: docType, file_name: `${tipo}_${seqNum}.ref`,
      file_url: `aduanet://${docType}/${seqNum}`, company_id: 'evco',
      uploaded_by: 'aduanet_scraper', uploaded_at: now,
      metadata: { patente: '3596', aduana: '240', ref, source: 'aduanet_scraper' } });
  });
  
  log(`Total Pedimentos: ${docs.filter(d => d.doc_type === 'pedimento_detallado').length}`);
  log(`Total DODAs: ${docs.filter(d => d.doc_type === 'doda').length}`);
  
  // Clear old aduanet records, insert fresh
  await sb.from('expediente_documentos').delete().eq('company_id', 'evco').like('file_url', 'aduanet://%');
  let ok = 0;
  for (let i = 0; i < docs.length; i += 100) {
    const { error } = await sb.from('expediente_documentos').insert(docs.slice(i, i + 100));
    if (error) { log('Insert error: ' + error.message); break; }
    ok += Math.min(100, docs.length - i);
  }
  log(`Inserted ${ok} / ${docs.length} docs ✅`);
}

run().then(() => { log('Done'); process.exit(0); }).catch(e => { log('FATAL: ' + e.message); process.exit(1); });
