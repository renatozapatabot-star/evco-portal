#!/usr/bin/env node
/**
 * perf-baseline.js — measures TTFB / FCP / LCP / DOMContentLoaded
 * for the critical cockpit paths (cold + warm) and writes
 * /tmp/perf-baseline.md.
 *
 * Uses Playwright's Performance API (via `page.evaluate(() => performance.getEntriesByType('paint'))`)
 * so we get real browser timings, not just HTTP timings.
 *
 * Usage:
 *   DRY_RUN_PASSWORD=evco2026 node scripts/perf-baseline.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const fs = require('fs')

let chromium, devices
try {
  ;({ chromium, devices } = require('playwright'))
} catch (e) {
  console.error('[fatal] playwright not installed')
  process.exit(1)
}

const URL_BASE = process.env.DRY_RUN_URL || 'https://portal.renatozapata.com'
const PASSWORD = process.env.DRY_RUN_PASSWORD
if (!PASSWORD) {
  console.error('[fatal] DRY_RUN_PASSWORD required')
  process.exit(1)
}

async function measure(page, url) {
  // New page context = cold-ish (browser reuses connection but nothing else)
  const t0 = Date.now()
  const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 })
  const totalMs = Date.now() - t0

  // Extract Paint + Navigation + LCP via PerformanceObserver
  const timings = await page.evaluate(() => {
    return new Promise((resolve) => {
      const out = {
        ttfb: null, fcp: null, lcp: null, domcontentloaded: null, loaded: null,
      }

      // Navigation timing
      const nav = performance.getEntriesByType('navigation')[0]
      if (nav) {
        out.ttfb = Math.round(nav.responseStart - nav.requestStart)
        out.domcontentloaded = Math.round(nav.domContentLoadedEventEnd - nav.fetchStart)
        out.loaded = Math.round(nav.loadEventEnd - nav.fetchStart)
      }

      // Paint timings
      const paints = performance.getEntriesByType('paint')
      const fcp = paints.find((p) => p.name === 'first-contentful-paint')
      if (fcp) out.fcp = Math.round(fcp.startTime)

      // LCP — PerformanceObserver; wait up to 2s
      let lcpValue = null
      try {
        const obs = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          if (entries.length) lcpValue = Math.round(entries[entries.length - 1].startTime)
        })
        obs.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch {}
      setTimeout(() => {
        out.lcp = lcpValue
        resolve(out)
      }, 1800)
    })
  })

  return { http: response.status(), totalMs, ...timings }
}

;(async () => {
  console.log(`🏁 perf-baseline — ${new Date().toISOString()}`)
  const browser = await chromium.launch({ headless: true })
  const deviceName = devices['iPhone 14 Pro'] ? 'iPhone 14 Pro' : 'iPhone 13 Pro'
  const context = await browser.newContext({
    ...devices[deviceName],
    locale: 'es-MX',
    timezoneId: 'America/Chicago',
  })
  const page = await context.newPage()

  // Login once
  await page.goto(URL_BASE + '/login', { waitUntil: 'networkidle', timeout: 15000 })
  await page.locator('#login-code').fill(PASSWORD)
  await Promise.all([
    page.waitForURL(/\/(inicio|admin|operador)/, { timeout: 15000 }),
    page.locator('button.login-submit').click(),
  ])
  console.log(`✓ authenticated\n`)

  // Trigger a COLD server by hitting a page rarely visited in last few min,
  // then warm measure by re-visiting.
  // We measure: /inicio (cold), /inicio (warm), /embarques (warm), /pedimentos (warm)
  const measurements = []

  // Cold-ish /inicio
  console.log('▶ /inicio (cold-ish — fresh context)')
  const coldInicio = await measure(page, URL_BASE + '/inicio')
  console.log(`    HTTP ${coldInicio.http} · total ${coldInicio.totalMs}ms · TTFB ${coldInicio.ttfb}ms · FCP ${coldInicio.fcp}ms · LCP ${coldInicio.lcp}ms · DOMContentLoaded ${coldInicio.domcontentloaded}ms`)
  measurements.push({ path: '/inicio', cold: true, ...coldInicio })

  // Warm /inicio
  console.log('▶ /inicio (warm — reload)')
  const warmInicio = await measure(page, URL_BASE + '/inicio')
  console.log(`    HTTP ${warmInicio.http} · total ${warmInicio.totalMs}ms · TTFB ${warmInicio.ttfb}ms · FCP ${warmInicio.fcp}ms · LCP ${warmInicio.lcp}ms · DOMContentLoaded ${warmInicio.domcontentloaded}ms`)
  measurements.push({ path: '/inicio', cold: false, ...warmInicio })

  // /embarques
  console.log('▶ /embarques (warm)')
  const embarques = await measure(page, URL_BASE + '/embarques')
  console.log(`    HTTP ${embarques.http} · total ${embarques.totalMs}ms · TTFB ${embarques.ttfb}ms · FCP ${embarques.fcp}ms · LCP ${embarques.lcp}ms · DOMContentLoaded ${embarques.domcontentloaded}ms`)
  measurements.push({ path: '/embarques', cold: false, ...embarques })

  // /pedimentos
  console.log('▶ /pedimentos (warm)')
  const pedimentos = await measure(page, URL_BASE + '/pedimentos')
  console.log(`    HTTP ${pedimentos.http} · total ${pedimentos.totalMs}ms · TTFB ${pedimentos.ttfb}ms · FCP ${pedimentos.fcp}ms · LCP ${pedimentos.lcp}ms · DOMContentLoaded ${pedimentos.domcontentloaded}ms`)
  measurements.push({ path: '/pedimentos', cold: false, ...pedimentos })

  await browser.close()

  // ─── Write report ──────────────────────────────────────────────────
  const lines = []
  lines.push('# Perf baseline')
  lines.push('')
  lines.push(`**Run:** ${new Date().toISOString()}`)
  lines.push(`**URL:** ${URL_BASE}`)
  lines.push('')
  lines.push('## Budgets')
  lines.push('')
  lines.push('| Path | TTFB | FCP | LCP | DCL | Cold budget | Warm budget |')
  lines.push('|------|------|-----|-----|-----|-------------|-------------|')
  for (const m of measurements) {
    const tag = m.cold ? 'cold' : 'warm'
    lines.push(`| ${m.path} (${tag}) | ${m.ttfb ?? '—'}ms | ${m.fcp ?? '—'}ms | ${m.lcp ?? '—'}ms | ${m.domcontentloaded ?? '—'}ms | TTFB<1000 FCP<1500 LCP<2500 | TTFB<500 FCP<750 LCP<1250 |`)
  }
  lines.push('')
  lines.push('## Verdict')
  lines.push('')
  for (const m of measurements) {
    const ttfb = m.ttfb ?? 9999
    const fcp = m.fcp ?? 9999
    const lcp = m.lcp ?? 9999
    const ttfbBudget = m.cold ? 1000 : 500
    const fcpBudget = m.cold ? 1500 : 750
    const lcpBudget = m.cold ? 2500 : 1250
    const ttfbOk = ttfb <= ttfbBudget
    const fcpOk = fcp <= fcpBudget
    const lcpOk = lcp <= lcpBudget
    const tag = m.cold ? 'cold' : 'warm'
    lines.push(`- **${m.path} (${tag})** — TTFB ${ttfbOk ? '✅' : '⚠️'} ${ttfb}ms · FCP ${fcpOk ? '✅' : '⚠️'} ${fcp}ms · LCP ${lcpOk ? '✅' : '⚠️'} ${lcp}ms`)
  }
  lines.push('')

  fs.writeFileSync('/tmp/perf-baseline.md', lines.join('\n'))
  console.log(`\n📝 /tmp/perf-baseline.md`)
})().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
