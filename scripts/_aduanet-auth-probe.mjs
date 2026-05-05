#!/usr/bin/env node
/**
 * _aduanet-auth-probe.mjs — Non-destructive auth probe for aduanetm3.net.
 *
 * Replays the 3-step login flow used by the restored scripts in
 * scripts/aduanet-scraper-restored/src/{aduanet,index}.js with verbose
 * step-by-step HTTP logging. Read-only; no Supabase writes.
 *
 * What it captures per step:
 *   - request URL + method
 *   - request body (form-urlencoded)
 *   - response status
 *   - response Set-Cookie headers
 *   - response Location header
 *   - response body first 200 chars
 *
 * Then evaluates whether `VALID` appears in the loginV.php response —
 * the same predicate aduanet.js uses to decide success.
 */
import { config } from 'dotenv';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '..', '.env.local') });

const HOST = 'www.aduanetm3.net';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const USER = process.env.ADUANET_USER || process.env.ADUANET_USERNAME;
const PASS = process.env.ADUANET_PASSWORD || process.env.ADUANET_PASS;
const IDRA = process.env.ADUANET_IDRA || 'RZGA01';

if (!USER || !PASS) {
  console.error('Missing ADUANET_USER / ADUANET_PASSWORD in .env.local');
  process.exit(1);
}
console.log(`Credentials: USER=${USER.slice(0, 4)}*** PASS=${'*'.repeat(PASS.length)} IDRA=${IDRA}`);
console.log(`Host: https://${HOST}`);
console.log('');

function rawReq(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, resp => {
      const chunks = [];
      resp.on('data', d => chunks.push(d));
      resp.on('end', () => resolve({
        status: resp.statusCode,
        text: Buffer.concat(chunks).toString(),
        sc: resp.headers['set-cookie'] || [],
        location: resp.headers['location'] || null,
        contentType: resp.headers['content-type'] || null,
      }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

function doGet(p, cookies) {
  return rawReq({
    hostname: HOST, path: p, method: 'GET', port: 443,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(cookies ? { Cookie: cookies } : {}),
    },
  });
}

function doPost(p, data, cookies) {
  const body = Object.entries(data).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return rawReq({
    hostname: HOST, path: p, method: 'POST', port: 443,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': USER_AGENT,
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

function dumpStep(label, req, res) {
  console.log(`▶ ${label}`);
  console.log(`  → ${req.method} https://${HOST}${req.path}`);
  if (req.body) console.log(`     body: ${req.body}`);
  if (req.cookies) console.log(`     cookie: ${req.cookies.slice(0, 200)}${req.cookies.length > 200 ? '…' : ''}`);
  console.log(`  ← ${res.status} ${res.contentType || ''}`);
  if (res.sc.length) {
    console.log('     set-cookie:');
    res.sc.forEach(c => console.log(`       · ${c}`));
  }
  if (res.location) console.log(`     location: ${res.location}`);
  const preview = res.text.replace(/\s+/g, ' ').slice(0, 240);
  console.log(`     body[0..240]: ${preview}${res.text.length > 240 ? '…' : ''}`);
  console.log('');
}

(async () => {
  let ck = '';

  // ── STEP 1 — GET /loginI.php ──
  const r1 = await doGet('/loginI.php');
  dumpStep('STEP 1 — GET /loginI.php', { method: 'GET', path: '/loginI.php', cookies: ck }, r1);
  ck = mergeCookies('', r1.sc);
  console.log(`  cookies after step 1: ${ck}`);
  console.log('');

  // ── STEP 2 — POST /login_auth.php { accion: 'getUrl', idra: IDRA } ──
  const r2body = { accion: 'getUrl', idra: IDRA };
  const r2 = await doPost('/login_auth.php', r2body, ck);
  dumpStep('STEP 2 — POST /login_auth.php { accion: getUrl, idra }', {
    method: 'POST', path: '/login_auth.php',
    body: Object.entries(r2body).map(([k, v]) => `${k}=${v}`).join('&'),
    cookies: ck,
  }, r2);
  ck = mergeCookies(ck, r2.sc);
  console.log(`  cookies after step 2: ${ck}`);
  console.log('');

  // ── STEP 3 — POST /loginV.php { accion: 'validLogin', userid, userpwd, idra, sistema: 'am3' } ──
  const r3body = { accion: 'validLogin', userid: USER, userpwd: PASS, idra: IDRA, sistema: 'am3' };
  const r3 = await doPost('/loginV.php', r3body, ck);
  dumpStep('STEP 3 — POST /loginV.php { accion: validLogin, userid, userpwd, idra, sistema }', {
    method: 'POST', path: '/loginV.php',
    body: 'accion=validLogin&userid=' + encodeURIComponent(USER) + '&userpwd=***&idra=' + IDRA + '&sistema=am3',
    cookies: ck,
  }, r3);
  ck = mergeCookies(ck, r3.sc);
  console.log(`  cookies after step 3: ${ck}`);
  console.log('');

  // ── STEP 4 — Decide auth outcome (matches restored aduanet.js logic) ──
  console.log('═══ AUTH OUTCOME ═══');
  const validInBody = r3.text.includes('VALID');
  console.log(`  loginV body contains "VALID": ${validInBody}`);
  console.log(`  loginV body length: ${r3.text.length} chars`);
  console.log(`  loginV body (full first 600 chars): ${r3.text.slice(0, 600)}`);
  console.log('');

  if (validInBody) {
    console.log('✅ Auth would succeed by `VALID`-text predicate.');
  } else {
    console.log('❌ Auth would fail by `VALID`-text predicate.');
  }

  // ── STEP 5 — Try GET /herramientas/home.php to see post-auth state ──
  console.log('');
  const r4 = await doGet('/herramientas/home.php', ck);
  dumpStep('STEP 5 — GET /herramientas/home.php (post-auth)', {
    method: 'GET', path: '/herramientas/home.php', cookies: ck,
  }, r4);

  // ── STEP 6 — Diagnostic: scrape the login_auth.php HTML to look for hidden inputs / new fields ──
  console.log('═══ DIAGNOSTIC: HIDDEN FORM FIELDS ON loginI.php ═══');
  const loginPageHtml = r1.text;
  const hiddenInputs = [...loginPageHtml.matchAll(/<input\s+[^>]*type=["']?hidden["']?[^>]*>/gi)];
  console.log(`  Hidden inputs found: ${hiddenInputs.length}`);
  hiddenInputs.slice(0, 20).forEach((m, i) => console.log(`    ${i + 1}. ${m[0]}`));
  if (hiddenInputs.length > 20) console.log(`    … +${hiddenInputs.length - 20} more`);
  console.log('');

  // Look for csrf/token-like patterns
  const tokenMatches = [...loginPageHtml.matchAll(/(?:csrf|token|nonce|_t)[\w-]*["'\s>=]+["']([^"']+)/gi)];
  console.log(`  CSRF/token-like matches: ${tokenMatches.length}`);
  tokenMatches.slice(0, 10).forEach(m => console.log(`    · ${m[0].slice(0, 100)}`));

  // Form action check
  const formMatches = [...loginPageHtml.matchAll(/<form[^>]*action=["']([^"']+)["']/gi)];
  console.log(`  Form actions found:`);
  formMatches.forEach(m => console.log(`    · ${m[1]}`));
  console.log('');

  console.log('═══ END PROBE ═══');
})().catch(err => {
  console.error('FATAL', err.stack || err.message);
  process.exit(1);
});
