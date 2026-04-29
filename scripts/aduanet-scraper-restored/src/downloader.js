#!/usr/bin/env node
/**
 * ADUANET XML Downloader
 * - Reads all aduanet:// records from expediente_documentos
 * - Downloads XML from pxml.php for each pedimento
 * - Uploads to Supabase Storage
 * - Updates file_url to https:// storage URL
 * 
 * Run: node src/downloader.js
 */
require('dotenv').config();
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required');
const CONCURRENCY = 3; // parallel downloads
const DELAY_MS = 800; // ms between batches

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString().replace('T',' ').slice(0,19), msg }) + '\n');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function rawReq(opts, body) {
  return new Promise((res, rej) => {
    const r = https.request(opts, resp => {
      const c = []; resp.on('data', d => c.push(d));
      resp.on('end', () => res({ buf: Buffer.concat(c), status: resp.statusCode, headers: resp.headers, sc: resp.headers['set-cookie'] || [] }));
    });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
}
function doGet(path, cookies) {
  return rawReq({ hostname: 'www.aduanetm3.net', path, method: 'GET', port: 443,
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36', ...(cookies ? { Cookie: cookies } : {}) } });
}
function doPost(path, data, cookies) {
  const body = Object.entries(data).map(([k, v]) => encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
  return rawReq({ hostname: 'www.aduanetm3.net', path, method: 'POST', port: 443,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0', 'Content-Length': Buffer.byteLength(body), ...(cookies ? { Cookie: cookies } : {}) } }, body);
}
function mergeCookies(existing, newCookies) {
  const c = {};
  if (existing) existing.split('; ').forEach(x => { const i = x.indexOf('='); if (i > 0) c[x.slice(0, i)] = x.slice(i + 1); });
  newCookies.forEach(s => { const kv = s.split(';')[0]; const i = kv.indexOf('='); if (i > 0) c[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
  return Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function authenticate() {
  const r1 = await doGet('/loginI.php'); let ck = mergeCookies('', r1.sc);
  const r2 = await doPost('/login_auth.php', { accion: 'getUrl', idra: 'RZGA01' }, ck); ck = mergeCookies(ck, r2.sc);
  const user = process.env.ADUANET_USER || process.env.ADUANET_USERNAME;
  const pass = process.env.ADUANET_PASSWORD || process.env.ADUANET_PASS;
  if (!user || !pass) throw new Error('ADUANET_USER and ADUANET_PASSWORD env vars required');
  const r3 = await doPost('/loginV.php', { accion: 'validLogin', userid: user, userpwd: pass, idra: 'RZGA01', sistema: 'am3' }, ck); ck = mergeCookies(ck, r3.sc);
  if (!r3.buf.toString().includes('VALID')) throw new Error('Auth failed');
  await doGet('/herramientas/home.php', ck);
  log('Auth ✅');
  return ck;
}

async function downloadXML(cookies, aduana, pedimento, referencia) {
  const path = `/pedimentos/pxml.php?aduana=${aduana}&pedimento=${pedimento}&patente=3596&referencia=${encodeURIComponent(referencia || '')}`;
  const r = await doGet(path, cookies);
  if (r.status !== 200 || r.buf.length < 100) return null;
  const text = r.buf.toString();
  if (!text.includes('<registro>') && !text.includes('<at001>')) return null;
  return r.buf;
}

async function uploadToStorage(buf, pedimentoId, docType) {
  // Use pedimento_id as path key (sanitized)
  const safeId = pedimentoId.replace(/[\s\/]+/g, '_');
  const path = `evco/aduanet/${safeId}_${docType}.xml`;
  
  const { data, error } = await sb.storage.from('expediente-documents').upload(path, buf, {
    contentType: 'text/xml',
    upsert: true,
  });
  if (error) throw new Error('Storage upload failed: ' + error.message);
  
  // Get public URL
  const { data: urlData } = sb.storage.from('expediente-documents').getPublicUrl(path);
  return urlData.publicUrl;
}

async function processBatch(cookies, records) {
  let ok = 0, skip = 0, fail = 0;
  
  for (const rec of records) {
    try {
      // Extract pedimento number and referencia from metadata
      const meta = rec.metadata || {};
      const pedNum = rec.pedimento_id.split(' ').pop(); // "26 24 3596 6500507" → "6500507"
      const aduana = meta.aduana || '240';
      const ref = meta.ref || '';
      
      // Download XML
      const xmlBuf = await downloadXML(cookies, aduana, pedNum, ref);
      if (!xmlBuf) { skip++; continue; }
      
      // Upload to storage
      const publicUrl = await uploadToStorage(xmlBuf, rec.pedimento_id, rec.doc_type);
      
      // Update record — do NOT change file_name (part of unique constraint)
      const { error } = await sb.from('expediente_documentos')
        .update({
          file_url: publicUrl,
          metadata: { ...meta, downloaded_at: new Date().toISOString(), source: 'aduanet_xml' }
        })
        .eq('id', rec.id);
      
      if (error) throw error;
      ok++;
    } catch (e) {
      log(`FAIL ${rec.pedimento_id}: ${e.message}`);
      fail++;
    }
  }
  return { ok, skip, fail };
}

async function run() {
  log('ADUANET XML Downloader starting...');
  
  // Get all aduanet:// records
  let all = [], page = 0, size = 500;
  while (true) {
    const { data, error } = await sb.from('expediente_documentos')
      .select('id, pedimento_id, doc_type, file_url, metadata')
      .like('file_url', 'aduanet://%')
      .eq('company_id', 'evco')
      .eq('doc_type', 'pedimento_detallado') // only pedimentos have pxml.php, not DODAs
      .range(page * size, (page + 1) * size - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < size) break;
    page++;
  }
  log(`Found ${all.length} pedimento_detallado records to download`);
  
  if (all.length === 0) {
    log('Nothing to do');
    return;
  }
  
  const cookies = await authenticate();
  
  let totalOk = 0, totalSkip = 0, totalFail = 0;
  
  for (let i = 0; i < all.length; i += CONCURRENCY) {
    const batch = all.slice(i, i + CONCURRENCY);
    const { ok, skip, fail } = await processBatch(cookies, batch);
    totalOk += ok; totalSkip += skip; totalFail += fail;
    
    if (i % 30 === 0) {
      log(`Progress: ${i}/${all.length} | ✅${totalOk} ⏭️${totalSkip} ❌${totalFail}`);
    }
    await sleep(DELAY_MS);
  }
  
  log(`Done: ✅${totalOk} downloaded | ⏭️${totalSkip} skipped | ❌${totalFail} failed`);
}

run().then(() => process.exit(0)).catch(e => { log('FATAL: ' + e.message); process.exit(1); });
