/**
 * ADUANET M3 Scraper v2 — HTTP-based (no Playwright needed)
 * Auth: loginI.php → loginV.php (confirmed working)
 * Data: GET reportePedimentosTransmitidos.php + reporteCove1.php
 */
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const BASE = 'https://www.aduanetm3.net';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = '52762e3c-bd8a-49b8-9a32-296e526b7238';
const COMPANY_ID = 'evco';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(JSON.stringify({ timestamp: new Date().toISOString().replace('T',' ').slice(0,19), msg })); }

// HTTP helpers
function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ text: Buffer.concat(chunks).toString(), headers: res.headers, status: res.statusCode }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

function parseCookies(headers, existing = {}) {
  const c = { ...existing };
  (headers['set-cookie'] || []).forEach(s => {
    const [kv] = s.split(';');
    const [k, v] = kv.split('=');
    if (k) c[k.trim()] = v || '';
  });
  return c;
}

function cookieStr(cookies) {
  return Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; ');
}

async function get(path, params, cookies) {
  const qs = params ? '?' + Object.entries(params).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
  const opts = {
    hostname: 'www.aduanetm3.net', path: path + qs, method: 'GET', port: 443,
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36', 'Cookie': cookieStr(cookies || {}) }
  };
  return req(opts);
}

async function post(path, data, cookies, extra = {}) {
  const body = Object.entries(data).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const opts = {
    hostname: 'www.aduanetm3.net', path, method: 'POST', port: 443,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      'Content-Length': Buffer.byteLength(body), 'Cookie': cookieStr(cookies || {}), ...extra }
  };
  return req(opts, body);
}

async function authenticate() {
  log('Authenticating with ADUANET M3...');
  const r1 = await get('/loginI.php', null, {});
  let cookies = parseCookies(r1.headers);
  const r2 = await post('/login_auth.php', { accion: 'getUrl', idra: 'RZGA01' }, cookies);
  cookies = parseCookies(r2.headers, cookies);
  const user = process.env.ADUANET_USER || process.env.ADUANET_USERNAME;
  const pass = process.env.ADUANET_PASSWORD || process.env.ADUANET_PASS;
  if (!user || !pass) throw new Error('ADUANET_USER and ADUANET_PASSWORD env vars required');
  const r3 = await post('/loginV.php', { accion: 'validLogin', userid: user, userpwd: pass, idra: 'RZGA01', sistema: 'am3' }, cookies);
  cookies = parseCookies(r3.headers, cookies);
  if (!r3.text.includes('VALID')) throw new Error('Auth failed: ' + r3.text.slice(0, 100));
  log('Auth successful ✅');
  await get('/herramientas/home.php', null, cookies); // establish session
  return cookies;
}

function parseHtmlTable(html) {
  const rows = [];
  const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  rowMatches.forEach(row => {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map(td => td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    if (cells.length >= 5 && cells.some(c => c.length > 1)) rows.push(cells);
  });
  return rows;
}

function dateStr(daysBack) {
  const d = new Date(); d.setDate(d.getDate() - daysBack);
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}

async function scrapePedimentos(cookies, fromDate, toDate) {
  log(`Scraping pedimentos from ${fromDate} to ${toDate}...`);
  await get('/reportes/reportePedimentosTransmitidos.php', null, cookies);
  const r = await get('/reportes/reportePedimentosTransmitidos.php', { FECHAINI: fromDate, FECHAFIN: toDate, PATENTE: '3596', ADUANA: '240', accion: 'GetHTML' }, cookies);
  const rows = parseHtmlTable(r.text);
  log(`Raw rows from pedimentos report: ${rows.length}`);
  
  const pedimentos = rows.filter(r => r[5] === 'pedimento' || r[5] === 'r1pedimento' || r[5] === 'doda').map(r => ({
    num: r[3], ref: r[4], tipo: r[5], patente: r[1], aduana: r[2]
  }));
  log(`Pedimentos: ${pedimentos.filter(p=>p.tipo==='pedimento'||p.tipo==='r1pedimento').length}, DODAs: ${pedimentos.filter(p=>p.tipo==='doda').length}`);
  return rows;
}

async function scrapeCoves(cookies, fromDate, toDate) {
  log(`Scraping COVEs from ${fromDate} to ${toDate}...`);
  const r = await get('/reportes/reporteCove1.php', { FECHAINI: fromDate, FECHAFIN: toDate, PATENTE: '3596', ADUANA: '240', accion: 'GetHTML' }, cookies);
  const rows = parseHtmlTable(r.text);
  log(`COVE rows: ${rows.length}`);
  return rows;
}

async function main() {
  const fromDate = dateStr(90);
  const toDate = dateStr(0);
  log(`Starting ADUANET scrape | ${fromDate} → ${toDate}`);
  
  const cookies = await authenticate();
  const pedRows = await scrapePedimentos(cookies, fromDate, toDate);
  const coveRows = await scrapeCoves(cookies, fromDate, toDate);
  
  log(`Done: ${pedRows.length} ped rows, ${coveRows.length} cove rows`);
  
  // TODO: Parse and upsert to Supabase expediente_documentos
}

main().catch(e => { log('FATAL: ' + e.message); process.exit(1); });
