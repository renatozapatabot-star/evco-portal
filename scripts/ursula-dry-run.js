#!/usr/bin/env node
/**
 * ursula-dry-run.js — pre-flight validator for Ursula's first login.
 *
 * Runs 14 checkpoints against the live portal (iPhone 14 Pro viewport,
 * headless Chromium). Writes /tmp/ursula-dry-run-report.md + 3 screenshots.
 * Reports PASS/FAIL per checkpoint + touch-target violations.
 *
 * Does NOT fix anything. It tells you what's broken so you can fix before
 * sending the WhatsApp credentials.
 *
 * Usage:
 *   DRY_RUN_PASSWORD=evco2026 node scripts/ursula-dry-run.js
 *   DRY_RUN_URL=https://portal.renatozapata.com \
 *   DRY_RUN_PASSWORD=evco2026 node scripts/ursula-dry-run.js
 *
 * Idempotent. Safe to re-run. Exit 0 = READY, 1 = NOT_READY.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const fs = require('fs')
const path = require('path')

let chromium, devices
try {
  ;({ chromium, devices } = require('playwright'))
} catch (e) {
  console.error('[fatal] playwright not installed. Run: npm install --save-dev playwright && npx playwright install chromium')
  process.exit(1)
}

const URL_BASE = process.env.DRY_RUN_URL || 'https://portal.renatozapata.com'
const PASSWORD = process.env.DRY_RUN_PASSWORD
const PAGE_LOAD_BUDGET_MS = 3000
const INICIO_LOAD_BUDGET_MS = 2000
const TOUCH_TARGET_MIN_PX = 60

if (!PASSWORD) {
  console.error('[fatal] DRY_RUN_PASSWORD env var required (do NOT hardcode the credential)')
  process.exit(1)
}

// ─── results collector ──────────────────────────────────────────────────
const results = []
const touchViolations = []

function pass(name, detail = '') {
  results.push({ name, status: 'PASS', detail })
  console.log(`  ✅ PASS${detail ? ' — ' + detail : ''}`)
}
function fail(name, detail = '') {
  results.push({ name, status: 'FAIL', detail })
  console.log(`  ❌ FAIL — ${detail}`)
}
async function check(name, fn) {
  console.log(`\n[${new Date().toISOString()}] ▶ ${name}`)
  try {
    const detail = await fn()
    pass(name, detail ?? '')
  } catch (e) {
    fail(name, e.message || String(e))
  }
}

// ─── English word sniff (checkpoint 11) ─────────────────────────────────
const ENGLISH_FLAGS = ['Settings', 'Home', 'Loading', 'Error', 'Submit', 'Cancel']
function findEnglishViolations(text) {
  const hits = []
  for (const word of ENGLISH_FLAGS) {
    // Whole-word, case-sensitive
    const re = new RegExp(`\\b${word}\\b`)
    if (re.test(text)) hits.push(word)
  }
  return hits
}

// ─── main ───────────────────────────────────────────────────────────────
;(async () => {
  console.log(`\n🦅 Ursula dry run — ${new Date().toISOString()}`)
  console.log(`   URL: ${URL_BASE}`)
  console.log(`   Viewport: iPhone 14 Pro (393×852)\n`)

  const browser = await chromium.launch({ headless: true })
  // Playwright exposes "iPhone 14 Pro" in recent versions; fall back to
  // iPhone 13 Pro (same 393×852) if not present in this install.
  const deviceName = devices['iPhone 14 Pro'] ? 'iPhone 14 Pro' : 'iPhone 13 Pro'
  const context = await browser.newContext({
    ...devices[deviceName],
    locale: 'es-MX',
    timezoneId: 'America/Chicago',
  })
  const page = await context.newPage()

  // ─── Checkpoint 1: page loads under 3s ────────────────────────────────
  let loginLoadMs = null
  await check('1. Login page loads under 3 seconds', async () => {
    const t0 = Date.now()
    await page.goto(URL_BASE + '/login', { waitUntil: 'networkidle', timeout: 10000 })
    loginLoadMs = Date.now() - t0
    if (loginLoadMs > PAGE_LOAD_BUDGET_MS) {
      throw new Error(`${loginLoadMs}ms exceeds ${PAGE_LOAD_BUDGET_MS}ms budget`)
    }
    return `${loginLoadMs}ms`
  })

  // ─── Checkpoint 2: login form renders, accepts input ─────────────────
  await check('2. Login form renders, password field accepts input', async () => {
    const passwordInput = page.locator('#login-code')
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 })
    await passwordInput.fill(PASSWORD)
    const value = await passwordInput.inputValue()
    if (value !== PASSWORD) throw new Error('input did not retain filled value')
    return 'password field accepted input'
  })

  // ─── Submit login ──────────────────────────────────────────────────────
  let inicioLoadMs = null
  await check('3. After login, /inicio loads under 2 seconds', async () => {
    const t0 = Date.now()
    await Promise.all([
      page.waitForURL(/\/(inicio|admin|operador)/, { timeout: 15000 }),
      page.locator('button.login-submit').click(),
    ])
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    inicioLoadMs = Date.now() - t0
    const currentUrl = page.url()
    if (!currentUrl.includes('/inicio') && !currentUrl.endsWith('/')) {
      throw new Error(`expected redirect to /inicio, got ${currentUrl}`)
    }
    if (inicioLoadMs > INICIO_LOAD_BUDGET_MS) {
      throw new Error(`${inicioLoadMs}ms exceeds ${INICIO_LOAD_BUDGET_MS}ms budget (URL: ${currentUrl})`)
    }
    return `${inicioLoadMs}ms → ${currentUrl}`
  })

  // If not on /inicio, navigate there explicitly (admin/broker redirect elsewhere)
  if (!page.url().includes('/inicio')) {
    console.log(`  ↪ navigating to /inicio explicitly (landed on ${page.url()})`)
    await page.goto(URL_BASE + '/inicio', { waitUntil: 'networkidle' })
  }

  // Screenshot /inicio
  try { await page.screenshot({ path: '/tmp/ursula-inicio.png', fullPage: true }) } catch {}

  // ─── Checkpoint 4: 4 hero KPIs with visible numbers ──────────────────
  let firstKpiLabel = null
  await check('4. Hero KPIs render (4 tiles, visible numbers)', async () => {
    // Hero wrapper has class `aguila-cockpit-hero` (per CockpitInicio styles)
    const heroContainer = page.locator('.aguila-cockpit-hero').first()
    const hasHero = await heroContainer.count()
    if (!hasHero) {
      // Fallback: try first grid of KPI-shaped glass cards
      const tiles = await page.locator('.aguila-glass-card').all()
      if (tiles.length < 4) throw new Error(`found ${tiles.length} tiles, expected ≥ 4`)
    }
    // Grab the text content of the first 4 direct children
    const tileTexts = await page.evaluate(() => {
      const hero = document.querySelector('.aguila-cockpit-hero')
      if (!hero) return []
      return Array.from(hero.children).slice(0, 4).map(el => (el.textContent || '').trim())
    })
    if (tileTexts.length !== 4) throw new Error(`got ${tileTexts.length} tiles, expected 4`)
    const badValues = []
    for (let i = 0; i < 4; i++) {
      const t = tileTexts[i]
      if (!t) { badValues.push(`tile ${i + 1}: empty`); continue }
      if (/\bNaN\b/.test(t)) badValues.push(`tile ${i + 1}: NaN`)
      if (/^\s*—\s*$/.test(t)) badValues.push(`tile ${i + 1}: em-dash placeholder only`)
    }
    if (badValues.length > 0) throw new Error(badValues.join('; '))
    return `4 tiles: [${tileTexts.map(t => t.slice(0, 30).replace(/\s+/g, ' ')).join(' | ')}]`
  })

  // ─── Checkpoint 5: "Próximo cruce" or "Último cruce" label ───────────
  await check('5. "Próximo cruce" OR "Último cruce" label visible', async () => {
    const heroText = await page.locator('.aguila-cockpit-hero').first().innerText().catch(() => '')
    const hasProximo = /Próximo cruce/i.test(heroText)
    const hasUltimo = /Último cruce/i.test(heroText)
    if (!hasProximo && !hasUltimo) {
      throw new Error('neither "Próximo cruce" nor "Último cruce" label found in hero')
    }
    firstKpiLabel = hasProximo ? 'Próximo cruce' : 'Último cruce'
    return `found "${firstKpiLabel}"`
  })

  // ─── Checkpoint 6: 6 nav cards ────────────────────────────────────────
  await check('6. 6 nav cards render with primary number + secondary text', async () => {
    const cards = await page.locator('.nav-cards-grid > *').all()
    if (cards.length !== 6) throw new Error(`got ${cards.length} cards, expected 6`)
    const issues = []
    for (let i = 0; i < cards.length; i++) {
      const text = (await cards[i].innerText().catch(() => '')).trim()
      if (!text) { issues.push(`card ${i + 1}: empty`); continue }
      if (/\bundefined\b|\bnull\b/i.test(text)) {
        issues.push(`card ${i + 1}: contains undefined/null (${text.slice(0, 40)})`)
      }
    }
    if (issues.length > 0) throw new Error(issues.join('; '))
    return '6 cards, no undefined/null in rendered text'
  })

  // ─── Checkpoint 7: tap "Próximo cruce" KPI → modal opens ──────────────
  if (firstKpiLabel === 'Próximo cruce') {
    await check('7. Tap "Próximo cruce" → timeline modal opens with 5 steps + close X', async () => {
      const trigger = page.locator('button[aria-label="Ver línea de tiempo del próximo embarque"]').first()
      await trigger.waitFor({ state: 'visible', timeout: 5000 })
      await trigger.click()
      const dialog = page.locator('[role="dialog"][aria-labelledby="timeline-modal-title"]')
      await dialog.waitFor({ state: 'visible', timeout: 5000 })
      const steps = await dialog.locator('ol > li').count()
      if (steps !== 5) throw new Error(`modal has ${steps} steps, expected 5`)
      const closeBtn = dialog.locator('button[aria-label="Cerrar"]').first()
      const closeVisible = await closeBtn.isVisible()
      if (!closeVisible) throw new Error('close X button not visible')
      try { await page.screenshot({ path: '/tmp/ursula-modal.png', fullPage: false }) } catch {}
      return `modal open, ${steps} steps, close button visible`
    })

    // ─── Checkpoint 8: close modal → focus returns ─────────────────────
    await check('8. Close modal via X → cockpit regains focus, KPI visible', async () => {
      await page.locator('[role="dialog"] button[aria-label="Cerrar"]').first().click()
      await page.waitForTimeout(200) // let close transition settle
      const dialogStill = await page.locator('[role="dialog"][aria-labelledby="timeline-modal-title"]').count()
      if (dialogStill > 0) {
        const stillVisible = await page.locator('[role="dialog"][aria-labelledby="timeline-modal-title"]').isVisible().catch(() => false)
        if (stillVisible) throw new Error('modal still visible after close')
      }
      const kpiVisible = await page.locator('button[aria-label="Ver línea de tiempo del próximo embarque"]').first().isVisible()
      if (!kpiVisible) throw new Error('KPI not visible after close')
      return 'modal dismissed, KPI visible'
    })
  } else {
    // Skip 7 + 8 with explicit SKIP result (no active shipment → not tappable)
    results.push({ name: '7. Tap "Próximo cruce" → timeline modal opens', status: 'SKIP', detail: `label is "${firstKpiLabel}" — no active shipment, modal is intentionally not wired` })
    results.push({ name: '8. Close modal via X', status: 'SKIP', detail: 'depends on 7' })
    console.log(`\n  ⏭  SKIP checkpoints 7 + 8 — label is "${firstKpiLabel}"`)
  }

  // ─── Checkpoint 9: nav to Tráficos (actually /embarques per v11) ─────
  await check('9. Tap Embarques nav card → list loads, rows OR empty state visible', async () => {
    // The unified nav uses /embarques (v11 rename) — try that first, fall back to /traficos
    const embarqueLink = page.locator('a[href*="/embarques"], a[href*="/traficos"]').first()
    await embarqueLink.waitFor({ state: 'visible', timeout: 5000 })
    await embarqueLink.click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    const bodyText = (await page.locator('body').innerText()).trim()
    if (!bodyText) throw new Error('list page body is empty')
    // Accept either "tráficos" table rows OR any empty-state message
    const hasContent = /\d/.test(bodyText) || /sin|empty|vacío|no hay|aparecerá/i.test(bodyText)
    if (!hasContent) throw new Error('list page shows neither data nor empty state')
    return `loaded ${page.url()}`
  })

  // ─── Checkpoint 10: tráfico detail renders estatus in plain Spanish ──
  await check('10. First embarque detail → estatus in plain Spanish (no raw codes)', async () => {
    // Find the first embarque row link — many routes possible
    const firstRow = page.locator('a[href*="/embarques/"], a[href*="/traficos/"]').filter({ hasNot: page.locator('[href$="/embarques"], [href$="/traficos"]') }).first()
    const rowExists = await firstRow.count()
    if (rowExists === 0) {
      // No active embarques to drill into — acceptable empty-season state
      return 'no embarque rows to drill into (acceptable quiet-season state)'
    }
    await firstRow.click()
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    try { await page.screenshot({ path: '/tmp/ursula-detail.png', fullPage: true }) } catch {}
    const text = await page.locator('body').innerText()
    // Raw codes that should have been translated: E1 standalone, RECONOCIMIENTO
    // Careful: "E1" appears in pedimento regex, tenant slugs, etc. — look for
    // it only in an estatus-label position (following "Estatus" or similar).
    const rawCodePatterns = [
      /Estatus[:\s]+E1\b/,
      /Estatus[:\s]+RECONOCIMIENTO\b/,
      /Estatus[:\s]+SEMAFORO_/,
    ]
    const hits = rawCodePatterns.filter(re => re.test(text))
    if (hits.length > 0) {
      throw new Error(`raw estatus code(s) leaked to UI: ${hits.map(r => r.source).join(', ')}`)
    }
    return 'no raw estatus codes leaked'
  })

  // ─── Checkpoint 11: no English strings on visited pages ──────────────
  // Scan the current page (detail) + re-navigate /inicio to scan that too
  await check('11. No English common-word strings on visited pages', async () => {
    const violationsByUrl = []
    const pagesToScan = [page.url()]
    await page.goto(URL_BASE + '/inicio', { waitUntil: 'networkidle' })
    pagesToScan.push(page.url())

    for (const url of pagesToScan) {
      if (page.url() !== url) {
        await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {})
      }
      const text = await page.locator('body').innerText()
      const hits = findEnglishViolations(text)
      if (hits.length > 0) violationsByUrl.push(`${url}: ${hits.join(', ')}`)
    }
    if (violationsByUrl.length > 0) throw new Error(violationsByUrl.join(' | '))
    return `scanned ${pagesToScan.length} page(s), zero English flags`
  })

  // Make sure we're on /inicio for remaining checks
  if (!page.url().includes('/inicio')) {
    await page.goto(URL_BASE + '/inicio', { waitUntil: 'networkidle' })
  }

  // ─── Checkpoint 12: no "CRUD" in rendered HTML ────────────────────────
  await check('12. No "CRUD" in rendered HTML', async () => {
    const html = await page.content()
    if (/\bCRUD\b/.test(html)) throw new Error('"CRUD" found in page HTML')
    return 'clean'
  })

  // ─── Checkpoint 13: no "AGUILA" in visible UI text ───────────────────
  await check('13. No "AGUILA" in visible UI text (internal CSS namespace allowed)', async () => {
    const visibleText = await page.locator('body').innerText()
    if (/\bAGUILA\b/i.test(visibleText)) throw new Error('"AGUILA" found in visible text')
    return 'clean'
  })

  // ─── Checkpoint 14: footer "Patente 3596" ─────────────────────────────
  await check('14. Footer "Patente 3596" visible on /inicio', async () => {
    const bodyText = await page.locator('body').innerText()
    if (!/Patente\s*3596/.test(bodyText)) throw new Error('"Patente 3596" not visible on /inicio')
    return 'visible'
  })

  // ─── Touch target audit (≥ 60px) ──────────────────────────────────────
  console.log(`\n[${new Date().toISOString()}] ▶ Touch target audit (/inicio, ≥ ${TOUCH_TARGET_MIN_PX}px)`)
  const smallTargets = await page.evaluate((minPx) => {
    const selectors = ['button', 'a[href]', '[role="button"]']
    const results = []
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const rect = el.getBoundingClientRect()
        // Skip hidden elements
        if (rect.width === 0 || rect.height === 0) continue
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue
        if (rect.height < minPx) {
          let loc = el.getAttribute('aria-label') || el.getAttribute('id') || el.textContent?.trim().slice(0, 30) || sel
          results.push({ selector: sel, label: loc, height: Math.round(rect.height) })
        }
      }
    }
    return results
  }, TOUCH_TARGET_MIN_PX)
  for (const t of smallTargets) {
    touchViolations.push(`${t.selector} "${t.label}" — height ${t.height}px`)
  }
  console.log(`  ${smallTargets.length === 0 ? '✅' : '⚠️'} ${smallTargets.length} touch target violation(s)`)

  await browser.close()

  // ─── Report ──────────────────────────────────────────────────────────
  const passCount = results.filter(r => r.status === 'PASS').length
  const failCount = results.filter(r => r.status === 'FAIL').length
  const skipCount = results.filter(r => r.status === 'SKIP').length
  const ready = failCount === 0 && touchViolations.length === 0

  const blockers = []
  results.filter(r => r.status === 'FAIL').forEach((r, i) => blockers.push(`${r.name} — ${r.detail}`))
  if (touchViolations.length > 0) {
    blockers.push(`Touch target audit — ${touchViolations.length} elements under ${TOUCH_TARGET_MIN_PX}px`)
  }

  const report = `# Ursula Dry Run Report

**Timestamp:** ${new Date().toISOString()}
**URL:** ${URL_BASE}
**Viewport:** iPhone 14 Pro (393×852, es-MX, America/Chicago)

## Checkpoints

${results.map((r, i) => {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'SKIP' ? '⏭' : '❌'
  return `${i + 1}. ${icon} **${r.name}**${r.detail ? `\n   - ${r.detail}` : ''}`
}).join('\n')}

**Summary:** ${passCount} pass · ${failCount} fail · ${skipCount} skip

## Touch target violations (/inicio, minimum ${TOUCH_TARGET_MIN_PX}px)

${touchViolations.length === 0 ? '_None — all interactive elements meet the 60px target._' : touchViolations.map(v => `- ${v}`).join('\n')}

## Screenshots

- \`/tmp/ursula-inicio.png\` — cockpit
- \`/tmp/ursula-modal.png\` — timeline modal (only if checkpoint 7 ran)
- \`/tmp/ursula-detail.png\` — embarque detail (only if checkpoint 10 drilled in)

## Overall: ${ready ? '**READY** ✅' : '**NOT_READY** ❌'}

${!ready ? '### Blockers (priority order)\n\n' + blockers.map((b, i) => `${i + 1}. ${b}`).join('\n') : '_All checkpoints clean. Safe to send credentials to Ursula._'}
`

  fs.writeFileSync('/tmp/ursula-dry-run-report.md', report)
  console.log(`\n📝 Report written to /tmp/ursula-dry-run-report.md`)
  console.log(`   Overall: ${ready ? 'READY ✅' : 'NOT_READY ❌'}`)
  process.exit(ready ? 0 : 1)
})().catch(err => {
  console.error('\n💥 Fatal error during dry run:', err)
  try {
    fs.writeFileSync('/tmp/ursula-dry-run-report.md',
      `# Ursula Dry Run — FATAL\n\n**Timestamp:** ${new Date().toISOString()}\n**URL:** ${URL_BASE}\n\n\`\`\`\n${err.stack || err.message || String(err)}\n\`\`\`\n\n## Overall: **NOT_READY** ❌\n`)
  } catch {}
  process.exit(1)
})
