#!/usr/bin/env node
/**
 * Pre-flight probe — fetch ONE recent pedimento's XML to disk so we can
 * see the actual at017 (contribuciones) section structure before extending
 * src/aduanet.js to write aduanet_facturas. Read-only; no Supabase writes.
 */
import { config } from 'dotenv';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '..', '.env.local') });

const HOST = 'www.aduanetm3.net';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const USER = process.env.ADUANET_USER || process.env.ADUANET_USERNAME;
const PASS = process.env.ADUANET_PASSWORD || process.env.ADUANET_PASS;
const IDRA = process.env.ADUANET_IDRA || 'RZGA01';
const PATENTE = process.env.EVCO_QUERIES || '3596';
const ADUANA  = process.env.ADUANA || '240';

function rawReq(opts, body) {
  return new Promise((res, rej) => {
    const r = https.request(opts, resp => {
      const chunks = [];
      resp.on('data', d => chunks.push(d));
      resp.on('end', () => res({
        text: Buffer.concat(chunks).toString(),
        status: resp.statusCode,
        sc: resp.headers['set-cookie'] || [],
      }));
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}
function doGet(p, c) { return rawReq({ hostname: HOST, port: 443, path: p, method: 'GET', headers: { 'User-Agent': UA, ...(c ? { Cookie: c } : {}) } }); }
function doPost(p, d, c) {
  const body = Object.entries(d).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return rawReq({ hostname: HOST, port: 443, path: p, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': UA, 'Content-Length': Buffer.byteLength(body), ...(c ? { Cookie: c } : {}) } }, body);
}
function mergeCookies(existing, fresh) {
  const c = {};
  if (existing) existing.split('; ').forEach(x => { const i = x.indexOf('='); if (i > 0) c[x.slice(0, i)] = x.slice(i + 1); });
  fresh.forEach(s => { const kv = s.split(';')[0]; const i = kv.indexOf('='); if (i > 0) c[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
  return Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; ');
}
function ddmmyyyy(daysBack = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function parseHtmlRows(html) {
  const rows = [];
  (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []).forEach(row => {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(td => td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    if (cells.length >= 3 && cells.some(c => c.length > 0)) rows.push(cells);
  });
  return rows;
}

(async () => {
  // Auth
  const r1 = await doGet('/loginI.php');
  let ck = mergeCookies('', r1.sc);
  const r2 = await doPost('/login_auth.php', { accion: 'getUrl', idra: IDRA }, ck);
  ck = mergeCookies(ck, r2.sc);
  const r3 = await doPost('/loginV.php', { accion: 'validLogin', userid: USER, userpwd: PASS, idra: IDRA, sistema: 'am3' }, ck);
  ck = mergeCookies(ck, r3.sc);
  if (!r3.text.includes('VALID')) throw new Error('Auth failed: ' + r3.text.slice(0, 200));
  await doGet('/herramientas/home.php', ck);
  console.log('✓ Auth OK');

  // Search pedimentos last 7 days
  const from = ddmmyyyy(7), to = ddmmyyyy(0);
  await doGet('/reportes/reportePedimentosTransmitidos.php', ck);
  const qs = `?FECHAINI=${encodeURIComponent(from)}&FECHAFIN=${encodeURIComponent(to)}&PATENTE=${PATENTE}&ADUANA=${ADUANA}&accion=GetHTML`;
  const rep = await doGet('/reportes/reportePedimentosTransmitidos.php' + qs, ck);
  const rows = parseHtmlRows(rep.text);
  console.log(`✓ Report returned ${rows.length} rows`);

  // Find first row that's a real pedimento (has tipo='pedimento' or 'r1pedimento')
  let target = null;
  for (const row of rows) {
    if (row.length < 6) continue;
    const tipo = (row[5] || '').trim().toLowerCase();
    if (tipo === 'pedimento' || tipo === 'r1pedimento') {
      target = { aduana: row[2] || ADUANA, patente: row[1] || PATENTE, numero: (row[3] || '').trim(), referencia: row[4] || '', tipo };
      break;
    }
  }
  if (!target) {
    console.log('No pedimento rows found in last 7 days. Sample of first 5 rows:');
    rows.slice(0, 5).forEach((r, i) => console.log(' ', i, r.slice(0, 6).join(' | ')));
    process.exit(0);
  }
  console.log(`✓ Target pedimento: ${JSON.stringify(target)}`);

  // Fetch the XML detail
  const xmlPath = `/pedimentos/pxml.php?aduana=${target.aduana}&pedimento=${target.numero}&patente=${PATENTE}&referencia=${encodeURIComponent(target.referencia)}`;
  const xml = await doGet(xmlPath, ck);
  console.log(`✓ XML fetched: ${xml.text.length} bytes, status ${xml.status}`);

  const out = '/tmp/aduanet-sample-pedimento.xml';
  fs.writeFileSync(out, xml.text);
  console.log(`✓ Saved to ${out}`);

  // Survey: list all <atNNN> sections
  const sections = [...xml.text.matchAll(/<at(\d{3})>/g)].map(m => 'at' + m[1]);
  const uniq = [...new Set(sections)];
  console.log(`Sections present: ${uniq.join(', ')}`);

  // Print first 800 chars of at017 if present
  for (const s of ['at017', 'at014', 'at015', 'at018']) {
    const m = xml.text.match(new RegExp(`<${s}>([\\s\\S]*?)<\\/${s}>`));
    if (m) {
      console.log(`\n══ <${s}> first 1200 chars ══`);
      console.log(m[1].slice(0, 1200));
      // Count rows
      const rows = (m[1].match(/<row[^>]*>/g) || []).length;
      console.log(`(${rows} <row> elements in ${s})`);
    } else {
      console.log(`<${s}> NOT present in this pedimento's XML`);
    }
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
