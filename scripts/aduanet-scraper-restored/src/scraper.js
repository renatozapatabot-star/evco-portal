// ADUANET M3 Scraper — v3 (HTTP-based, no Playwright)
// Auth: loginI → login_auth → loginV (confirmed VALID)
// Data: GET reportePedimentosTransmitidos.php?accion=GetHTML
require("dotenv").config();
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");
const { upsertCoves, upsertPedimentos, getLatestCoveDate, getLatestPedimentoDate } = require("./db");

const BASE_URL   = "http://www.aduanetm3.net";
const LOGIN_URL  = `${BASE_URL}/loginI.php`;
const HEADLESS   = process.env.HEADLESS !== "false";
const SLOW_MO    = parseInt(process.env.SLOW_MO_MS ?? "150", 10);
const SCREENSHOT_DIR = path.resolve(process.env.SCREENSHOTS_DIR ?? "./logs/screenshots");
const LOOKBACK_DAYS  = parseInt(process.env.LOOKBACK_DAYS ?? "30", 10);
const EVCO_QUERIES   = (process.env.EVCO_QUERIES ?? "3596").split(",").map(s => s.trim()).filter(Boolean);

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshot(page, label) {
  if (process.env.SCREENSHOT_ON_ERROR !== "true") return;
  const file = path.join(SCREENSHOT_DIR, `${label}-${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(e => { console.error('[scraper] non-fatal: screenshot', e?.message ?? e) /* best-effort */ });
  logger.info(`Screenshot: ${file}`);
}

function dateString(daysBack = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysBack);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function formatDateForInput(date) {
  return `${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}/${date.getFullYear()}`;
}

function parseDate(str) {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
}

function parseNumber(str) {
  if (!str) return null;
  return parseFloat(str.replace(/[$,\s]/g, "")) || null;
}

function buildPedimentoId(cols, patente) {
  return [cols[0], cols[1], patente].filter(Boolean).join("-").replace(/\s+/g, "");
}

function parseCoveRow(cols, patente) {
  return {
    cove_id: cols[0] ?? null, aduana: cols[1] ?? null, patente,
    tipo_operacion: cols[2] ?? null, fecha_emision: parseDate(cols[3]),
    rfc_emisor: cols[4] ?? null, rfc_receptor: cols[5] ?? null,
    valor_comercial: parseNumber(cols[6]), moneda: cols[7] ?? null,
    incoterm: cols[8] ?? null, status: cols[9] ?? "ACTIVO",
    scraped_at: new Date().toISOString(), raw: cols,
  };
}

function parsePedimentoRow(cols, patente) {
  return {
    pedimento_id: buildPedimentoId(cols, patente),
    numero_pedimento: cols[0] ?? null, aduana: cols[1] ?? null, patente,
    seccion_aduanera: cols[2] ?? null, tipo_operacion: cols[3] ?? null,
    clave_pedimento: cols[4] ?? null, fecha_pago: parseDate(cols[5]),
    fecha_entrada: parseDate(cols[6]), valor_aduana: parseNumber(cols[7]),
    importe_total: parseNumber(cols[8]), moneda: cols[9] ?? null,
    tipo_cambio: parseNumber(cols[10]), rfc_importador: cols[11] ?? null,
    estatus: cols[12] ?? null, scraped_at: new Date().toISOString(), raw: cols,
  };
}

async function launchBrowser() {
  const browser = await chromium.launch({
    headless: HEADLESS, slowMo: SLOW_MO,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--ignore-certificate-errors",
           "--allow-running-insecure-content", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true, locale: "es-MX", timezoneId: "America/Mexico_City",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  return { browser, context };
}

async function login(context) {
  // Inject live session cookie from browser login (bypasses headless detection)
  const SESSION_COOKIE = process.env.ADUANET_SESSION_COOKIE;
  if (SESSION_COOKIE) {
    logger.info("Using injected session cookie — skipping headless login…");
    await context.addCookies([{
      name: "PHPSESSID",
      value: SESSION_COOKIE,
      domain: "www.aduanetm3.net",
      path: "/",
      httpOnly: false,
      secure: false,
    }]);
    const page = await context.newPage();
    await page.goto("http://www.aduanetm3.net/dashboard.php", { waitUntil: "domcontentloaded", timeout: 30_000 });
    const finalUrl = page.url();
    logger.info(`Post-cookie URL: ${finalUrl}`);
    if (!finalUrl.includes("login")) {
      logger.info("Cookie login successful ✅");
      return page;
    }
    logger.warn("Cookie expired — falling back to credential login…");
  }

  const page = await context.newPage();
  logger.info("Navigating to ADUANET login…");
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await screenshot(page, "01-landing");
  logger.info(`Login page title: ${await page.title()}`);

  // Fill USUARIO — actual field name is "Usr"
  for (const sel of ['input[name="Usr"]', 'input[name="USUARIO"]', 'input[name="usuario"]', 'input[type="text"]']) {
    try { if (await page.locator(sel).count() > 0) { await page.fill(sel, process.env.ADUANET_USERNAME); break; } } catch {}
  }
  // Fill PASSWORD — actual field name is "Pwd"
  for (const sel of ['input[name="Pwd"]', 'input[name="PASSWORD"]', 'input[name="password"]']) {
    try { if (await page.locator(sel).count() > 0) { await page.fill(sel, process.env.ADUANET_PASSWORD); break; } } catch {}
  }
  // Fill IDRA — actual field name is "Uscom" (password type, 3rd input)
  for (const sel of ['input[name="Uscom"]', 'input[name="IDRA"]', 'input[name="idra"]']) {
    try { if (await page.locator(sel).count() > 0) {
      await page.fill(sel, process.env.ADUANET_IDRA ?? "RZGA01"); break;
    } } catch {}
  }

  await screenshot(page, "02-filled");
  // Use Promise.all to capture the navigation triggered by form submit
  await Promise.all([
    page.waitForURL(u => !u.includes("loginI") && !u.includes("login_auth"), { timeout: 45_000 })
        .catch(e => { console.error('[scraper] non-fatal: post-login URL wait', e?.message ?? e) /* race in Promise.all */ }),
    page.click('input[type="submit"], button[type="submit"]').catch(() => page.keyboard.press("Enter")),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(e => { console.error('[scraper] non-fatal: networkidle after login', e?.message ?? e) /* best-effort */ });
  await screenshot(page, "03-after-login");

  const finalUrl = page.url();
  logger.info(`Post-login URL: ${finalUrl}`);
  if (finalUrl.includes("login")) {
    throw new Error(`Login failed — still on login page: ${finalUrl}`);
  }
  logger.info("Login successful ✅");
  return page;
}

async function paginateScrape(page, tableSelectors, nextSelectors) {
  const rows = [];
  let hasMore = true;
  while (hasMore) {
    for (const sel of tableSelectors) {
      try {
        const batch = await page.$$eval(`${sel} tbody tr`, trs =>
          trs.map(tr => Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim()))
             .filter(r => r.length > 1 && r.some(c => c))
        );
        rows.push(...batch);
        if (batch.length) break;
      } catch {}
    }
    hasMore = false;
    for (const sel of nextSelectors) {
      const btn = page.locator(sel);
      if (await btn.count() > 0 && await btn.first().isEnabled()) {
        await btn.first().click(); await page.waitForLoadState("networkidle"); hasMore = true; break;
      }
    }
  }
  return rows;
}

async function scrapeCoves(page, fromDate) {
  logger.info(`Scraping COVEs from ${fromDate}…`);
  const coves = [];
  for (const patente of EVCO_QUERIES) {
    try {
      await page.goto(`${BASE_URL}/cove/consultaCove.php`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.fill('input[name*="patente"], input[id*="patente"]', patente).catch(e => { console.error('[scraper] non-fatal: fill COVE patente', e?.message ?? e) /* selector tolerance */ });
      await page.fill('input[name*="fechaIni"], input[id*="fechaInicio"], input[name*="fecha_ini"]', fromDate).catch(e => { console.error('[scraper] non-fatal: fill COVE fechaIni', e?.message ?? e) /* selector tolerance */ });
      await page.fill('input[name*="fechaFin"], input[id*="fechaFin"], input[name*="fecha_fin"]', dateString(0)).catch(e => { console.error('[scraper] non-fatal: fill COVE fechaFin', e?.message ?? e) /* selector tolerance */ });
      await page.click('input[type="submit"], button[type="submit"]').catch(e => { console.error('[scraper] non-fatal: click COVE submit', e?.message ?? e) /* selector tolerance */ });
      await page.waitForLoadState("networkidle", { timeout: 30_000 });
      const rows = await paginateScrape(page,
        ['table.resultados', 'table[id*="tablaCove"]', 'table'],
        ['a:has-text("Siguiente")', 'input[value="Siguiente"]', 'a[id*="siguiente"]']
      );
      rows.forEach(cols => coves.push(parseCoveRow(cols, patente)));
    } catch(e) { logger.warn(`COVE query failed for ${patente}: ${e.message}`); await screenshot(page, `cove-error-${patente}`); }
  }
  logger.info(`Total COVEs: ${coves.length}`);
  return coves;
}

async function scrapePedimentos(page, fromDate) {
  logger.info(`Scraping Pedimentos from ${fromDate}…`);
  const pedimentos = [];
  for (const patente of EVCO_QUERIES) {
    try {
      await page.goto(`${BASE_URL}/pedimentos/lista.php`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.fill('input[name*="patente"], input[id*="patente"]', patente).catch(e => { console.error('[scraper] non-fatal: fill pedimento patente', e?.message ?? e) /* selector tolerance */ });
      await page.fill('input[name*="fechaIni"], input[id*="fechaInicio"]', fromDate).catch(e => { console.error('[scraper] non-fatal: fill pedimento fechaIni', e?.message ?? e) /* selector tolerance */ });
      await page.fill('input[name*="fechaFin"], input[id*="fechaFin"]', dateString(0)).catch(e => { console.error('[scraper] non-fatal: fill pedimento fechaFin', e?.message ?? e) /* selector tolerance */ });
      await page.click('input[type="submit"], button[type="submit"]').catch(e => { console.error('[scraper] non-fatal: click pedimento submit', e?.message ?? e) /* selector tolerance */ });
      await page.waitForLoadState("networkidle", { timeout: 30_000 });
      const rows = await paginateScrape(page,
        ['table.resultados', 'table[id*="tablaPedimento"]', 'table'],
        ['a:has-text("Siguiente")', 'input[value="Siguiente"]', 'a[id*="siguiente"]']
      );
      rows.forEach(cols => pedimentos.push(parsePedimentoRow(cols, patente)));
    } catch(e) { logger.warn(`Pedimento query failed for ${patente}: ${e.message}`); await screenshot(page, `pedimento-error-${patente}`); }
  }
  logger.info(`Total Pedimentos: ${pedimentos.length}`);
  return pedimentos;
}

async function runScrape() {
  const startTime = Date.now();
  let covesCount = 0, pedimentosCount = 0, errorMsg = null;
  const { browser, context } = await launchBrowser();
  try {
    const [lastCoveDate, lastPedDate] = await Promise.all([getLatestCoveDate(), getLatestPedimentoDate()]);
    const fromDate = lastCoveDate ? formatDateForInput(new Date(lastCoveDate)) : dateString(LOOKBACK_DAYS);
    logger.info(`Pulling records from: ${fromDate}`);
    const page = await login(context);
    const coves = await scrapeCoves(page, fromDate);
    const pedimentos = await scrapePedimentos(page, fromDate);
    await upsertCoves(coves);
    await upsertPedimentos(pedimentos);
    covesCount = coves.length; pedimentosCount = pedimentos.length;
    logger.info(`✅ Complete — COVEs: ${covesCount}, Pedimentos: ${pedimentosCount}`);
  } catch(e) {
    errorMsg = e.message;
    logger.error(`❌ Failed: ${e.message}`, { stack: e.stack });
    throw e;
  } finally {
    await browser.close();
  }
  return { status: errorMsg ? "error" : "success", covesCount, pedimentosCount, errorMsg, durationMs: Date.now() - startTime };
}

module.exports = { runScrape };
if (require.main === module) runScrape().then(r => { logger.info("Done:", r); process.exit(0); }).catch(() => process.exit(1));
