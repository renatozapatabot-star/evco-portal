#!/usr/bin/env node
/**
 * weekend-regression-audit.js — scans every authenticated client page for
 * regressions introduced during the Friday marathon.
 *
 * For each page: measures load time, counts interactive elements, greps
 * rendered text for sentinel strings (undefined / null / NaN / raw estatus
 * codes / common English leaks), tracks console errors, and flags 404/500
 * responses.
 *
 * Does NOT fix anything. Writes /tmp/weekend-regression-report.md with
 * per-page PASS/WARN/FAIL verdicts.
 *
 * Usage:
 *   DRY_RUN_PASSWORD=evco2026 node scripts/weekend-regression-audit.js
 *   DRY_RUN_URL=https://portal.renatozapata.com DRY_RUN_PASSWORD=evco2026 \
 *     node scripts/weekend-regression-audit.js
 *
 * Exit 0 = clean, 1 = at least one FAIL.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const fs = require('fs')

let chromium, devices
try {
  ;({ chromium, devices } = require('playwright'))
} catch (e) {
  console.error('[fatal] playwright not installed.')
  process.exit(1)
}

const URL_BASE = process.env.DRY_RUN_URL || 'https://portal.renatozapata.com'
const PASSWORD = process.env.DRY_RUN_PASSWORD
if (!PASSWORD) {
  console.error('[fatal] DRY_RUN_PASSWORD env var required')
  process.exit(1)
}

// ─── Sentinel grep targets ───────────────────────────────────────────────
const PLACEHOLDER_SENTINELS = [
  /\bundefined\b/,
  /\bNaN\b/,
  /\[object Object\]/,
  /null\s*null/, // double-null, not "null" in legitimate locale copy
]

// Raw GlobalPC status shortcodes. Spanish words like "DESPACHO",
// "RECONOCIMIENTO", "MODULACIÓN" are legitimate UI labels and
// not leaks — only the short machine codes matter here.
const RAW_ESTATUS_CODES = [
  /\bE0\b/,
  /\bE1\b/,
  /\bE2\b/,
  /\bE3\b/,
]

const ENGLISH_LEAKS = [
  /\bSettings\b/,
  /\bHome\b/,
  /\bLoading\b/,
  /\bSubmit\b/,
  /\bCancel\b/,
  /\bError\b(?!:)/, // "Error:" is in some legitimate logs; strip that
  /\bWelcome\b/,
  /\bLogout\b/,
]

// Allowlist — UI copy where the token is legitimate
const SENTINEL_ALLOWLIST = [
  /Patente\s+3596/i,    // always visible in footer
  /RFC/i,               // "RFC" is Spanish
  /kg/i,                // unit
  /USD|MXN/,            // currency label
  /T-MEC/i,             // treaty name
]

// ─── Pages to audit (in order) ───────────────────────────────────────────
const PAGE_SPECS = [
  { path: '/inicio', label: 'Inicio cockpit' },
  { path: '/embarques', label: 'Embarques list' },
  { path: '/embarques/__FIRST__', label: 'Embarques detail (first row)' },
  { path: '/pedimentos', label: 'Pedimentos list' },
  { path: '/expedientes', label: 'Expedientes list' },
  { path: '/catalogo', label: 'Catálogo' },
  { path: '/entradas', label: 'Entradas' },
  { path: '/reportes', label: 'Reportes' },
  { path: '/ahorro', label: 'Ahorro T-MEC' },
  { path: '/mensajeria', label: 'Mensajería' },
]

// ─── Audit data collectors ───────────────────────────────────────────────
const pageResults = []

function verdict(issues) {
  if (issues.some((i) => i.severity === 'FAIL')) return 'FAIL'
  if (issues.some((i) => i.severity === 'WARN')) return 'WARN'
  return 'PASS'
}

function addIssue(list, severity, kind, detail) {
  list.push({ severity, kind, detail })
}

// ─── Main ────────────────────────────────────────────────────────────────
;(async () => {
  console.log(`\n🧪 weekend-regression-audit — ${new Date().toISOString()}`)
  console.log(`   URL: ${URL_BASE}`)
  console.log(`   Viewport: iPhone 14 Pro\n`)

  const browser = await chromium.launch({ headless: true })
  const deviceName = devices['iPhone 14 Pro'] ? 'iPhone 14 Pro' : 'iPhone 13 Pro'
  const context = await browser.newContext({
    ...devices[deviceName],
    locale: 'es-MX',
    timezoneId: 'America/Chicago',
  })
  const page = await context.newPage()

  // ─── Login ──────────────────────────────────────────────────────────────
  console.log('▶ Logging in')
  await page.goto(URL_BASE + '/login', { waitUntil: 'networkidle', timeout: 15000 })
  await page.locator('#login-code').fill(PASSWORD)
  await Promise.all([
    page.waitForURL(/\/(inicio|admin|operador)/, { timeout: 15000 }),
    page.locator('button.login-submit').click(),
  ])
  console.log(`  ✓ authenticated → ${page.url()}\n`)

  // ─── Resolve first embarque id for detail page ──────────────────────
  await page.goto(URL_BASE + '/embarques', { waitUntil: 'networkidle', timeout: 20000 })
  const firstEmbarqueHref = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a[href*="/embarques/"]'))
      .find((a) => /\/embarques\/[^/?#]+$/.test(a.getAttribute('href') || ''))
    return link?.getAttribute('href') || null
  })
  console.log(`  Resolved first embarque: ${firstEmbarqueHref || '(none — quiet season)'}\n`)

  // ─── Audit each page ────────────────────────────────────────────────
  for (const spec of PAGE_SPECS) {
    const issues = []
    let loadMs = null
    let buttonCount = 0
    let linkCount = 0
    const consoleErrors = []
    const consoleWarnings = []
    const networkFailures = []

    // Resolve special tokens
    let path = spec.path
    if (path.includes('__FIRST__')) {
      if (!firstEmbarqueHref) {
        pageResults.push({
          label: spec.label,
          path: spec.path,
          verdict: 'SKIP',
          reason: 'no embarque rows available (quiet season)',
          issues: [],
        })
        console.log(`▶ ${spec.label} — SKIP (no rows)\n`)
        continue
      }
      path = firstEmbarqueHref
    }

    console.log(`▶ ${spec.label} (${path})`)

    // Hook listeners BEFORE navigation
    const onConsole = (msg) => {
      const text = msg.text()
      if (msg.type() === 'error') consoleErrors.push(text)
      else if (msg.type() === 'warning') consoleWarnings.push(text)
    }
    const onResponse = (resp) => {
      try {
        const url = resp.url()
        const status = resp.status()
        if (status >= 400 && !url.includes('favicon')) {
          networkFailures.push({ url, status })
        }
      } catch {}
    }
    page.on('console', onConsole)
    page.on('response', onResponse)

    try {
      const t0 = Date.now()
      await page.goto(URL_BASE + path, { waitUntil: 'networkidle', timeout: 30000 })
      loadMs = Date.now() - t0

      // Redirect detection: if we asked for /mensajeria but landed on
      // /inicio (or /), the route is role-gated away from clients.
      // That's not a regression — it's by design — so we mark it SKIP
      // rather than re-auditing the landing page's content.
      const landed = new URL(page.url()).pathname
      const requested = new URL(URL_BASE + path).pathname
      if (landed !== requested && !requested.endsWith(landed)) {
        pageResults.push({
          label: spec.label,
          path,
          verdict: 'SKIP',
          reason: `redirected to ${landed} (route gated for this role)`,
          issues: [],
        })
        console.log(`  ⏭  SKIP — redirected to ${landed}\n`)
        page.off('console', onConsole)
        page.off('response', onResponse)
        continue
      }

      // Wait for the "main" container to have something rendered
      try {
        await page.locator('main').first().waitFor({ state: 'visible', timeout: 8000 })
      } catch {}

      // ─── Collect rendered text + element counts ──────────────────
      const pageData = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body
        const text = main.innerText || ''
        const buttons = document.querySelectorAll('button, [role="button"]').length
        const links = document.querySelectorAll('a[href]').length
        return { text, buttons, links }
      })
      buttonCount = pageData.buttons
      linkCount = pageData.links

      // ─── Sentinel grep ───────────────────────────────────────────
      const lowered = pageData.text
      function isAllowed(match) {
        return SENTINEL_ALLOWLIST.some((re) => re.test(match))
      }

      for (const re of PLACEHOLDER_SENTINELS) {
        const m = lowered.match(re)
        if (m && !isAllowed(m[0])) {
          // Extract surrounding context
          const idx = lowered.indexOf(m[0])
          const ctx = lowered.slice(Math.max(0, idx - 40), idx + m[0].length + 40).replace(/\s+/g, ' ')
          addIssue(issues, 'FAIL', 'placeholder-leak', `"${m[0]}" in: …${ctx}…`)
        }
      }

      for (const re of RAW_ESTATUS_CODES) {
        const m = lowered.match(re)
        if (m) {
          const idx = lowered.indexOf(m[0])
          const ctx = lowered.slice(Math.max(0, idx - 40), idx + m[0].length + 40).replace(/\s+/g, ' ')
          addIssue(issues, 'FAIL', 'raw-estatus-code', `"${m[0]}" in: …${ctx}…`)
        }
      }

      for (const re of ENGLISH_LEAKS) {
        const m = lowered.match(re)
        if (m && !isAllowed(m[0])) {
          const idx = lowered.indexOf(m[0])
          const ctx = lowered.slice(Math.max(0, idx - 40), idx + m[0].length + 40).replace(/\s+/g, ' ')
          addIssue(issues, 'WARN', 'english-leak', `"${m[0]}" in: …${ctx}…`)
        }
      }

      // ─── Load time ────────────────────────────────────────────────
      if (loadMs > 6000) addIssue(issues, 'WARN', 'slow-load', `${loadMs}ms (> 6000ms threshold)`)

      // ─── Console errors are FAIL, warnings are WARN ───────────────
      // Filter known-benign console noise:
      //  - React dev-only banners
      //  - Recharts hydration-race warnings: ResponsiveContainer logs
      //    "width(-1) and height(-1)" on the first render before its
      //    parent has been measured. The chart recovers on the next
      //    frame, but the warning persists in the console stream.
      //    Silencing the specific message keeps the signal:noise ratio
      //    honest.
      const BENIGN_CONSOLE = [
        /Download the React DevTools/i,
        /Fast Refresh/i,
        /\[webpack-hmr\]/i,
        /The width\(-?\d+\) and height\(-?\d+\) of chart should be greater than 0/i,
      ]
      for (const err of consoleErrors) {
        if (BENIGN_CONSOLE.some((re) => re.test(err))) continue
        addIssue(issues, 'FAIL', 'console-error', err.slice(0, 200))
      }
      for (const w of consoleWarnings) {
        if (BENIGN_CONSOLE.some((re) => re.test(w))) continue
        addIssue(issues, 'WARN', 'console-warning', w.slice(0, 200))
      }

      // ─── Network failures are FAIL (client-facing) ────────────────
      for (const nf of networkFailures) {
        addIssue(issues, 'FAIL', 'network-failure', `${nf.status} · ${nf.url}`)
      }
    } catch (err) {
      addIssue(issues, 'FAIL', 'navigation-crash', err.message || String(err))
    } finally {
      page.off('console', onConsole)
      page.off('response', onResponse)
    }

    const v = verdict(issues)
    pageResults.push({
      label: spec.label,
      path,
      verdict: v,
      loadMs,
      buttonCount,
      linkCount,
      issues,
    })

    const marker = v === 'PASS' ? '✅' : v === 'WARN' ? '⚠️ ' : '❌'
    console.log(`  ${marker} ${v} — ${issues.length} issue(s), ${loadMs}ms, ${buttonCount} buttons, ${linkCount} links\n`)
  }

  await browser.close()

  // ─── Write report ────────────────────────────────────────────────────
  const lines = []
  lines.push('# Weekend Regression Audit')
  lines.push('')
  lines.push(`**Run:** ${new Date().toISOString()}`)
  lines.push(`**URL:** ${URL_BASE}`)
  lines.push(`**Viewport:** iPhone 14 Pro (393×852)`)
  lines.push('')

  const totalPages = pageResults.length
  const pass = pageResults.filter((p) => p.verdict === 'PASS').length
  const warn = pageResults.filter((p) => p.verdict === 'WARN').length
  const fail = pageResults.filter((p) => p.verdict === 'FAIL').length
  const skip = pageResults.filter((p) => p.verdict === 'SKIP').length
  const totalIssues = pageResults.reduce((a, p) => a + (p.issues?.length || 0), 0)

  lines.push('## Summary')
  lines.push('')
  lines.push(`- Pages: ${totalPages} · PASS ${pass} · WARN ${warn} · FAIL ${fail} · SKIP ${skip}`)
  lines.push(`- Total issues: ${totalIssues}`)
  lines.push('')

  // Worst offenders
  const worst = [...pageResults]
    .filter((p) => p.issues?.length)
    .sort((a, b) => (b.issues?.length || 0) - (a.issues?.length || 0))
    .slice(0, 3)
  if (worst.length) {
    lines.push('**Worst offenders:**')
    for (const p of worst) lines.push(`- ${p.label} (${p.path}) · ${p.issues.length} issue(s)`)
    lines.push('')
  }

  lines.push('## Per-page detail')
  lines.push('')
  for (const p of pageResults) {
    lines.push(`### ${p.verdict === 'PASS' ? '✅' : p.verdict === 'WARN' ? '⚠️' : p.verdict === 'FAIL' ? '❌' : '⏭ '} ${p.label}`)
    lines.push('')
    lines.push(`- Path: \`${p.path}\``)
    if (p.verdict === 'SKIP') {
      lines.push(`- Skipped: ${p.reason}`)
      lines.push('')
      continue
    }
    lines.push(`- Load: ${p.loadMs ?? 'n/a'}ms`)
    lines.push(`- Buttons: ${p.buttonCount} · Links: ${p.linkCount}`)
    if (!p.issues?.length) {
      lines.push(`- Issues: none`)
    } else {
      lines.push(`- Issues (${p.issues.length}):`)
      for (const i of p.issues) {
        lines.push(`  - **${i.severity}** · \`${i.kind}\` — ${i.detail}`)
      }
    }
    lines.push('')
  }

  const reportPath = '/tmp/weekend-regression-report.md'
  fs.writeFileSync(reportPath, lines.join('\n'))
  console.log(`\n📝 Report: ${reportPath}`)
  console.log(`   Summary: PASS ${pass} · WARN ${warn} · FAIL ${fail} · SKIP ${skip} · ${totalIssues} total issues`)

  process.exit(fail > 0 ? 1 : 0)
})().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
