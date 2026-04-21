#!/usr/bin/env node
/**
 * tap-target-sweep.js — visits every authenticated client page,
 * measures every interactive element's bounding box, flags anything
 * under 60 × 60 px (CLAUDE.md mobile rule). Writes
 * /tmp/tap-target-sweep.md.
 *
 * Does NOT fix. Reports only. Humans decide per violation whether to
 * bump the target or wrap a larger parent.
 *
 * Usage: DRY_RUN_PASSWORD=evco2026 node scripts/tap-target-sweep.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const fs = require('fs')

let chromium, devices
try {
  ;({ chromium, devices } = require('playwright'))
} catch {
  console.error('playwright not installed — run: npm install --save-dev playwright')
  process.exit(1)
}

const URL_BASE = process.env.DRY_RUN_URL || 'https://portal.renatozapata.com'
const PASSWORD = process.env.DRY_RUN_PASSWORD
if (!PASSWORD) { console.error('DRY_RUN_PASSWORD required'); process.exit(1) }

const PAGES = [
  '/inicio',
  '/embarques',
  '/pedimentos',
  '/expedientes',
  '/catalogo',
  '/entradas',
  '/reportes',
]
const MIN_PX = 60

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const deviceName = devices['iPhone 14 Pro'] ? 'iPhone 14 Pro' : 'iPhone 13 Pro'
  const context = await browser.newContext({
    ...devices[deviceName],
    locale: 'es-MX',
    timezoneId: 'America/Chicago',
  })
  const page = await context.newPage()

  console.log(`\n📐 Tap-target sweep — ${new Date().toISOString()}`)
  console.log(`   URL: ${URL_BASE}`)
  console.log(`   Viewport: iPhone 14 Pro (393×852)\n`)

  // Login
  await page.goto(URL_BASE + '/login', { waitUntil: 'networkidle' })
  await page.locator('#login-code').fill(PASSWORD)
  await Promise.all([
    page.waitForURL(/\/(inicio|admin|operador)/, { timeout: 15000 }),
    page.locator('button.login-submit').click(),
  ])
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  const allViolations = []
  const allExcluded = []

  for (const path of PAGES) {
    console.log(`\n  ▶ ${path}`)
    try {
      await page.goto(URL_BASE + path, { waitUntil: 'networkidle', timeout: 15000 })
    } catch (err) {
      console.log(`    ⚠️  load error: ${err.message?.slice(0, 80) || err}`)
      allViolations.push({ path, tag: 'PAGE', label: '(page failed to load)', height: 0, width: 0 })
      continue
    }
    // Give Suspense boundaries a chance to hydrate
    try {
      await page.waitForSelector('main, [role="main"], [class*="cockpit"]', { state: 'visible', timeout: 5000 })
    } catch { /* best-effort */ }

    const result = await page.evaluate((minPx) => {
      function classifyExclusion(el) {
        if (el.classList.contains('skip-link')) return 'skip-link'
        if (el.classList.contains('sr-only')) return 'sr-only'
        if (el.closest('.sr-only')) return 'sr-only ancestor'
        if (el.closest('[aria-hidden="true"]')) return 'aria-hidden ancestor'
        if (el.closest('[aria-label="Inteligencia en vivo"]')) return 'ticker'
        if (el.closest('.aguila-ticker-track')) return 'ticker track'
        if (el.closest('.aguila-ticker-root')) return 'ticker root'
        if (el.closest('[role="marquee"]')) return 'role=marquee'
        if (el.tagName === 'A' && el.closest('button')) return 'nested <a> inside button'
        return null
      }
      const selectors = ['button', 'a[href]', '[role="button"]', 'input[type="submit"]']
      const violations = []
      const excluded = []
      const seen = new WeakSet()
      for (const sel of selectors) {
        for (const el of document.querySelectorAll(sel)) {
          if (seen.has(el)) continue
          seen.add(el)
          const rect = el.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0) continue
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue
          if (rect.height >= minPx && rect.width >= minPx) continue
          const reason = classifyExclusion(el)
          const label =
            el.getAttribute('aria-label')
            || el.getAttribute('title')
            || el.getAttribute('id')
            || (el.textContent || '').trim().slice(0, 50)
            || sel
          const entry = {
            tag: el.tagName.toLowerCase(),
            label,
            height: Math.round(rect.height),
            width: Math.round(rect.width),
            reason,
          }
          if (reason) excluded.push(entry)
          else violations.push(entry)
        }
      }
      return { violations, excluded }
    }, MIN_PX)

    for (const v of result.violations) allViolations.push({ path, ...v })
    for (const e of result.excluded) allExcluded.push({ path, ...e })
    console.log(`    ${result.violations.length} real · ${result.excluded.length} excluded`)
  }

  await browser.close()

  const md = [
    `# Tap-target sweep — ${new Date().toISOString()}`,
    ``,
    `**URL:** ${URL_BASE}`,
    `**Viewport:** iPhone 14 Pro (393 × 852, es-MX)`,
    `**Minimum:** ${MIN_PX} × ${MIN_PX} px`,
    `**Pages audited:** ${PAGES.length}`,
    ``,
    `## Real violations (${allViolations.length})`,
    ``,
    allViolations.length === 0
      ? '_None — every interactive element meets the 60 × 60 rule._'
      : [
          '| page | tag | label | w × h |',
          '|---|---|---|---|',
          ...allViolations.map((v) => `| ${v.path} | ${v.tag} | ${String(v.label).replace(/\|/g, '\\|').slice(0, 40)} | ${v.width}×${v.height} |`),
        ].join('\n'),
    ``,
    `## Excluded from the check (${allExcluded.length})`,
    ``,
    allExcluded.length === 0
      ? '_No exclusions applied._'
      : [
          '| page | tag | label | w × h | reason |',
          '|---|---|---|---|---|',
          ...allExcluded.map((v) => `| ${v.path} | ${v.tag} | ${String(v.label).replace(/\|/g, '\\|').slice(0, 40)} | ${v.width}×${v.height} | ${v.reason} |`),
        ].join('\n'),
    ``,
  ].join('\n')
  fs.writeFileSync('/tmp/tap-target-sweep.md', md)
  console.log(`\n📝 Report: /tmp/tap-target-sweep.md`)
  console.log(`   ${allViolations.length} violations · ${allExcluded.length} excluded across ${PAGES.length} pages`)
  process.exit(0)
})().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
