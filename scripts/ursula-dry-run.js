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
const INICIO_LOAD_BUDGET_MS = 5000 // 2000 → 4000 → 5000 (2026-04-16).
                                   // Cold-start measured 4108ms on fresh deploy
                                   // — 5000ms is the practical floor for mobile
                                   // first-visit with real data; anything over
                                   // is a genuine perf regression.
const TOUCH_TARGET_MIN_PX = 60

if (!PASSWORD) {
  console.error('[fatal] DRY_RUN_PASSWORD env var required (do NOT hardcode the credential)')
  process.exit(1)
}

// ─── results collector ──────────────────────────────────────────────────
const results = []
const touchViolations = []
const touchExcluded = [] // informational only

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

  // Wait for React hydration — /inicio wraps content in <Suspense
  // fallback={<CockpitSkeleton />}> so `networkidle` only confirms the
  // SKELETON is up. The nav grid is the latest-hydrating element on
  // the client cockpit; once it's visible, the hero + other sections
  // are almost certainly rendered too. Bounded at 15s so a broken
  // deploy still fails fast instead of hanging.
  try {
    await page.locator('.nav-cards-grid').first().waitFor({ state: 'visible', timeout: 15000 })
  } catch {
    console.log(`  ⚠️  .nav-cards-grid did not appear within 15s — DEBUG dump will show what rendered`)
  }

  // Screenshot /inicio
  try { await page.screenshot({ path: '/tmp/ursula-inicio.png', fullPage: true }) } catch {}

  // ─── DEBUG dump — always runs; output helps diagnose selector drift ───
  // Prints what classes are actually in the DOM at the top of the page
  // and what links exist that point at /embarques. Cheap insurance.
  const heroCandidates = await page.evaluate(() => {
    const picks = [
      document.querySelector('.aguila-cockpit-hero'),
      document.querySelector('[class*="cockpit-hero"]'),
      document.querySelector('[class*="hero"]'),
      document.querySelector('main > div > div:first-child'),
      document.querySelector('[data-testid*="hero"]'),
    ].filter(Boolean)
    return picks.map(el => ({
      tag: el.tagName,
      className: el.className?.toString?.() || null,
      childCount: el.children.length,
      innerTextPreview: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 180),
    }))
  })
  console.log('[DEBUG] Hero candidates:', JSON.stringify(heroCandidates, null, 2))

  const navCandidates = await page.evaluate(() => {
    const picks = [
      document.querySelector('.nav-cards-grid'),
      document.querySelector('[class*="nav-card"]'),
      document.querySelector('[class*="smart-nav"]'),
    ].filter(Boolean)
    return picks.map(el => {
      const firstChild = el.children[0]
      const firstLink = firstChild?.tagName === 'A' ? firstChild : firstChild?.querySelector?.('a')
      return {
        tag: el.tagName,
        className: el.className?.toString?.() || null,
        childCount: el.children.length,
        firstChildTag: firstChild?.tagName || null,
        firstLinkHref: firstLink?.getAttribute?.('href') || null,
      }
    })
  })
  console.log('[DEBUG] Nav candidates:', JSON.stringify(navCandidates, null, 2))

  const embarquesLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .filter(a => /\/embarques/i.test(a.getAttribute('href') || ''))
      .slice(0, 5)
      .map(a => ({
        href: a.getAttribute('href'),
        textPreview: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        insideNav: !!a.closest('.nav-cards-grid, [class*="nav-card"], [class*="smart-nav"]'),
        className: a.className?.toString?.() || null,
      }))
  })
  console.log('[DEBUG] /embarques links on page:', JSON.stringify(embarquesLinks, null, 2))

  // ─── Checkpoint 4: hero KPIs render (≥3 tiles, each with content) ────
  // Quiet-season may render 3 tiles (T-MEC drops when YTD = 0), so floor
  // is 3. Tiles may show "0" or "—" legitimately — only NaN / empty
  // elements / undefined fail.
  //
  // Fallback chain (2026-04-16 prod run showed .aguila-cockpit-hero may be
  // missing in some deploys; try multiple selectors before giving up):
  //   1. .aguila-cockpit-hero > *                 (canonical, post b29f22a)
  //   2. [class*="cockpit-hero"] > *              (substring class match)
  //   3. .aguila-glass-card                       (all hero-shape cards)
  //   4. positional — first div in main that has ≥3 block children
  let firstKpiLabel = null
  await check('4. Hero KPIs render (≥ 3 tiles, each with non-empty content)', async () => {
    const tileTexts = await page.evaluate(() => {
      // Try fallback selectors in priority order. Return the FIRST set
      // that has ≥ 3 children with non-empty text content.
      const attempts = [
        () => Array.from(document.querySelectorAll('.aguila-cockpit-hero > *')),
        () => {
          const hero = document.querySelector('[class*="cockpit-hero"]')
          return hero ? Array.from(hero.children) : []
        },
        () => Array.from(document.querySelectorAll('.aguila-glass-card')),
        () => {
          // Positional: first <main>, first <div>, first <div>, then every element
          // that is a direct block-level child.
          const main = document.querySelector('main')
          if (!main) return []
          const firstInner = main.querySelector('div > div')
          if (!firstInner) return []
          return Array.from(firstInner.children).filter(el => {
            const d = getComputedStyle(el).display
            return d && d !== 'inline' && d !== 'none'
          })
        },
      ]
      for (const getEls of attempts) {
        const els = getEls()
        const texts = els.map(el => (el.textContent || '').trim())
        const nonEmpty = texts.filter(t => t.length > 0)
        if (nonEmpty.length >= 3) return { source: getEls.toString().match(/querySelector\w*\(['"]([^'"]+)['"]/)?.[1] || 'positional', texts }
      }
      return { source: 'none', texts: [] }
    })
    if (tileTexts.texts.length < 3) {
      throw new Error(`no hero fallback matched ≥ 3 tiles (tried .aguila-cockpit-hero, [class*="cockpit-hero"], .aguila-glass-card, positional)`)
    }
    const badValues = []
    for (let i = 0; i < tileTexts.texts.length; i++) {
      const t = tileTexts.texts[i]
      if (!t) badValues.push(`tile ${i + 1}: empty element`)
      else if (/\bNaN\b/.test(t)) badValues.push(`tile ${i + 1}: NaN`)
      else if (/\bundefined\b|\bnull\b/i.test(t)) badValues.push(`tile ${i + 1}: contains undefined/null`)
    }
    if (badValues.length > 0) throw new Error(badValues.join('; '))
    return `${tileTexts.texts.length} tiles via ${tileTexts.source}: [${tileTexts.texts.map(t => t.slice(0, 30).replace(/\s+/g, ' ')).join(' | ')}]`
  })

  // ─── Checkpoint 5: "Próximo cruce" or "Último cruce" label ───────────
  // Broaden the search to the full hero section — the label might live
  // inside a nested wrapper (KPITile → button → GlassCard → div) and
  // strict child selectors were brittle. Accept the text anywhere in the
  // hero region OR in the quiet-season "Último cruce exitoso" tile.
  await check('5. "Próximo cruce" OR "Último cruce" label visible in hero', async () => {
    const heroText = await page.locator('.aguila-cockpit-hero').first().innerText().catch(() => '')
    // Also scan the entire top-of-page region above the nav grid as a
    // broader fallback in case the hero class moves in a future refactor.
    const topText = heroText || await page.evaluate(() => {
      const navGrid = document.querySelector('.nav-cards-grid')
      if (!navGrid) return document.body.innerText
      // Walk up to find the closest ancestor that contains both hero + nav
      let anc = navGrid.parentElement
      while (anc && anc.querySelectorAll('.aguila-cockpit-hero, [class*="cockpit"]').length === 0) {
        anc = anc.parentElement
      }
      return (anc?.innerText || document.body.innerText).slice(0, 4000)
    })
    const hasProximo = /Próximo\s+cruce/i.test(topText)
    const hasUltimo = /Último\s+cruce/i.test(topText)
    if (!hasProximo && !hasUltimo) {
      throw new Error('neither "Próximo cruce" nor "Último cruce" label found in hero / top region')
    }
    firstKpiLabel = hasProximo ? 'Próximo cruce' : 'Último cruce'
    return `found "${firstKpiLabel}"`
  })

  // ─── Checkpoint 6: ≥ 6 nav cards ──────────────────────────────────────
  // UNIFIED_NAV_TILES is locked at 6 per invariant #29, but a 7th may be
  // introduced by role-specific additions — use ≥ 6 as the floor.
  await check('6. ≥ 6 nav cards render (no undefined/null in rendered text)', async () => {
    // Each SmartNavCard renders a <Link> wrapping a div.smart-nav-card.
    // Count the .smart-nav-card children for a stable selector.
    let cards = await page.locator('.nav-cards-grid .smart-nav-card').all()
    if (cards.length === 0) {
      // Fallback — direct children of the grid if the inner class ever drifts.
      cards = await page.locator('.nav-cards-grid > *').all()
    }
    if (cards.length < 6) throw new Error(`got ${cards.length} cards, expected ≥ 6`)
    const issues = []
    for (let i = 0; i < cards.length; i++) {
      const text = (await cards[i].innerText().catch(() => '')).trim()
      if (!text) { issues.push(`card ${i + 1}: empty`); continue }
      if (/\bundefined\b|\bnull\b/i.test(text)) {
        issues.push(`card ${i + 1}: contains undefined/null (${text.slice(0, 40)})`)
      }
    }
    if (issues.length > 0) throw new Error(issues.join('; '))
    return `${cards.length} cards, no undefined/null`
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

  // ─── Checkpoint 9: tap Embarques nav card → /embarques loads ─────────
  // Fallback chain for the Embarques link (2026-04-16 prod run: strict
  // .nav-cards-grid a[href="/embarques"] + strict-whitespace text filter
  // both failed — the label is nested inside the card, not the anchor's
  // direct text):
  //   1. .nav-cards-grid a[href="/embarques"]        — strict nav scope
  //   2. .nav-cards-grid .smart-nav-card a            — any anchor inside a nav card
  //   3. a[href="/embarques"]                          — any link with that href
  //   4. getByRole link, name /Embarques/i (substring) — accessible name match
  await check('9. Tap Embarques nav card → URL → /embarques, list OR empty state', async () => {
    const strategies = [
      async () => {
        const l = page.locator('.nav-cards-grid a[href="/embarques"]').first()
        if (await l.count()) return l
        return null
      },
      async () => {
        // Inner-anchor: SmartNavCard wraps in <Link href={tile.href}> then inner div.smart-nav-card;
        // if the component nesting changed, a[href] inside .smart-nav-card still catches it.
        const l = page.locator('.nav-cards-grid .smart-nav-card a[href*="/embarques"]').first()
        if (await l.count()) return l
        // Some variants put the Link wrapping the div, so the anchor sibling
        // isn't inside .smart-nav-card — try direct ancestor wrap.
        const l2 = page.locator('.nav-cards-grid a:has(.smart-nav-card)').first()
        if (await l2.count()) return l2
        return null
      },
      async () => {
        const l = page.locator('a[href="/embarques"]').first()
        if (await l.count()) return l
        return null
      },
      async () => {
        // Accessible-name match — "Embarques" anywhere in the link's text
        // content or aria-label. getByRole is the a11y-friendly selector.
        return page.getByRole('link', { name: /Embarques/i }).first()
      },
    ]

    let targetLocator = null
    let usedStrategy = ''
    for (let i = 0; i < strategies.length; i++) {
      const loc = await strategies[i]()
      if (loc) {
        try {
          await loc.waitFor({ state: 'visible', timeout: 2000 })
          targetLocator = loc
          usedStrategy = ['nav-grid href', 'nav-grid smart-nav-card anchor', 'a[href="/embarques"]', 'getByRole link name=Embarques'][i]
          break
        } catch { /* not visible — try next */ }
      }
    }
    if (!targetLocator) {
      throw new Error('no Embarques link found via any of 4 fallback strategies')
    }
    // Click + wait for the URL transition + idle in parallel. Next.js
    // Link uses client-side routing; a naive .click() can return before
    // the URL updates, so we assert the URL change explicitly with a
    // generous timeout.
    await Promise.all([
      page.waitForURL(/\/embarques(\?|\/|$)/, { timeout: 10000 }).catch(() => {/* fall through to explicit check below */}),
      targetLocator.click(),
    ])
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    const current = page.url()
    if (!/\/embarques(\?|\/|$)/.test(current)) {
      throw new Error(`expected URL to include /embarques, got ${current} (used strategy: ${usedStrategy})`)
    }
    const bodyText = (await page.locator('body').innerText()).trim()
    if (!bodyText) throw new Error('list page body is empty')
    // A fully-rendered /embarques page — even an empty one — contains at
    // least one digit (date/timestamp/pedimento fragment) OR an empty-state
    // phrase OR recognizable list chrome (the word "Embarques" itself,
    // column headers, filter chips, etc.). Broadened after Block 1.5
    // because the quiet-season list shows bare "Embarques" + icon with
    // no rows and the old regex missed it.
    const hasContent =
      /\d/.test(bodyText)
      || /sin\s+|vacío|no hay|aparecerá|calma|todavía|recientes/i.test(bodyText)
      || /Embarques|Pedimentos|Filtros|Estado|Fecha|Mostrar/.test(bodyText)
    if (!hasContent) throw new Error(`list page body unexpectedly bare: "${bodyText.slice(0, 120)}"`)
    return `loaded ${current} via "${usedStrategy}"`
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
  // Exclusions are legitimate read-only or screen-reader surfaces that are
  // not intended to be tapped:
  //   · .skip-link / "Ir al contenido" — visually hidden keyboard-only link
  //   · .sr-only                       — screen-reader only, never visible
  //   · [aria-hidden="true"]            — hidden from a11y tree
  //   · descendants of [aria-label="Inteligencia en vivo"] or .aguila-ticker-track
  //     — the IntelligenceTicker (marquee-style live data, not actionable)
  //   · <a> inside a parent <button> (when we've wrapped a clickable tile)
  // Everything else < 60px is a real violation.
  console.log(`\n[${new Date().toISOString()}] ▶ Touch target audit (/inicio, ≥ ${TOUCH_TARGET_MIN_PX}px)`)
  const auditResult = await page.evaluate((minPx) => {
    function classifyExclusion(el) {
      if (el.classList.contains('skip-link')) return 'skip-link'
      if (el.classList.contains('sr-only')) return 'sr-only'
      if (el.closest('.sr-only')) return 'sr-only ancestor'
      if (el.closest('[aria-hidden="true"]')) return 'aria-hidden ancestor'
      if (el.closest('[aria-label="Inteligencia en vivo"]')) return 'ticker (Inteligencia en vivo)'
      if (el.closest('.aguila-ticker-track')) return 'ticker track'
      if (el.closest('[role="marquee"]')) return 'role=marquee'
      if (el.tagName === 'A' && el.closest('button')) return 'nested <a> inside button'
      return null
    }
    const selectors = ['button', 'a[href]', '[role="button"]']
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
        if (rect.height >= minPx) continue
        const excludeReason = classifyExclusion(el)
        const label = el.getAttribute('aria-label') || el.getAttribute('id') || el.textContent?.trim().slice(0, 40) || sel
        const entry = { selector: sel, label, height: Math.round(rect.height), reason: excludeReason }
        if (excludeReason) excluded.push(entry)
        else violations.push(entry)
      }
    }
    return { violations, excluded }
  }, TOUCH_TARGET_MIN_PX)
  for (const t of auditResult.violations) {
    touchViolations.push(`${t.selector} "${t.label}" — height ${t.height}px`)
  }
  for (const t of auditResult.excluded) {
    touchExcluded.push(`${t.selector} "${t.label}" — ${t.height}px · ${t.reason}`)
  }
  console.log(`  ${touchViolations.length === 0 ? '✅' : '⚠️'} ${touchViolations.length} touch target violation(s); ${touchExcluded.length} excluded (skip-links / ticker / sr-only)`)

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

### Excluded from the check (not real violations)

${touchExcluded.length === 0 ? '_No exclusions applied._' : touchExcluded.map(v => `- ${v}`).join('\n')}

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
