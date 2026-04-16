#!/usr/bin/env node
/**
 * lcp-inspector.js — reveals which element on /inicio becomes the LCP
 * candidate. Walks the LCP observer buffer and logs the winning entry.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const { chromium, devices } = require('playwright')

const URL_BASE = process.env.DRY_RUN_URL || 'https://portal.renatozapata.com'
const PASSWORD = process.env.DRY_RUN_PASSWORD

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ...devices['iPhone 14 Pro'],
    locale: 'es-MX',
    timezoneId: 'America/Chicago',
  })
  const page = await context.newPage()
  await page.goto(URL_BASE + '/login', { waitUntil: 'networkidle' })
  await page.locator('#login-code').fill(PASSWORD)
  await Promise.all([
    page.waitForURL(/\/(inicio|admin|operador)/, { timeout: 15000 }),
    page.locator('button.login-submit').click(),
  ])

  await page.goto(URL_BASE + '/inicio', { waitUntil: 'load', timeout: 30000 })

  // Wait for LCP to stabilize (~3-4s after load)
  const lcpInfo = await page.evaluate(() =>
    new Promise((resolve) => {
      const candidates = []
      try {
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            candidates.push({
              startTime: Math.round(e.startTime),
              size: e.size,
              url: e.url || null,
              elementTag: e.element?.tagName || null,
              elementClass: e.element?.className?.toString?.().slice(0, 80) || null,
              elementId: e.element?.id || null,
              elementText: (e.element?.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
            })
          }
        })
        obs.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch (e) {}
      setTimeout(() => resolve(candidates), 5000)
    })
  )

  await browser.close()

  console.log(`LCP candidate progression (last wins):`)
  for (const c of lcpInfo) {
    console.log(`  ${c.startTime}ms  size=${c.size}  <${c.elementTag}${c.elementId ? ` id=${c.elementId}` : ''}${c.elementClass ? ` class="${c.elementClass}"` : ''}>  "${c.elementText}"`)
  }
})().catch((err) => { console.error(err); process.exit(1) })
