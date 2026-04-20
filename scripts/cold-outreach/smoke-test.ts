#!/usr/bin/env npx tsx
/**
 * Standalone smoke tests for the cold-outreach templates + helpers.
 * Exits non-zero on any failure. Run before every live send:
 *
 *   npx tsx scripts/cold-outreach/smoke-test.ts
 *
 * Not registered with vitest (the project config only scans src/**),
 * and adding it there would modify shared config. This file stays
 * self-contained so it runs without touching vitest or the CI pipeline.
 */

import { industryHook, subject, bodyText, bodyHtml, unsubUrl, unsubHeaders, type Recipient, type CTA } from './templates'

let passed = 0
let failed = 0
const failures: string[] = []

function assert(cond: boolean, label: string) {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    failures.push(label)
    console.log(`  ✗ ${label}`)
  }
}

function group(name: string, fn: () => void) {
  console.log(`\n${name}`)
  fn()
}

// ── Fixtures ────────────────────────────────────────────────────────
const fakeCta: CTA = {
  email: 'ai@renatozapata.com',
  phone: '+1 (956) 555-1234',
  whatsapp: '+52 867 555 4321',
  portalUrl: 'portal.renatozapata.com',
}

const baseRecipient: Recipient = {
  email: 'juan@magna.com',
  company: 'Magna Coahuila',
  firstName: 'Juan',
  industry: 'Automotive Tier 1',
  state: 'Coahuila',
  city: 'Ramos Arizpe',
  unsubToken: 'a1b2c3d4e5f6a7b8',
  campaignId: 'cold-2026-04-21',
}

// ── Tests ───────────────────────────────────────────────────────────

group('industryHook · returns right variant per industry', () => {
  const autoHook = industryHook('Automotive Tier 1 harness')
  assert(/autom/i.test(autoHook), 'automotive hook mentions automotive context')
  assert(/fracci/i.test(autoHook), 'automotive hook mentions fracción')

  const electHook = industryHook('Electronics manufacturing services (EMS)')
  assert(/electr[oó]nic/i.test(electHook), 'electronics hook mentions electrónica')

  const chemHook = industryHook('Plastic injection and modified plastic compounds')
  assert(/qu[íi]mic|NOM|COA/i.test(chemHook), 'chemicals hook mentions chemicals keyword')

  const defHook = industryHook(undefined)
  assert(/3\.8/.test(defHook), 'default hook mentions 3.8 second demo')

  const emptyHook = industryHook('')
  assert(emptyHook === defHook, 'empty string falls back to default')

  const randomHook = industryHook('banking services')
  assert(randomHook === defHook, 'unknown industry falls back to default')
})

group('subject · includes company name, no noise', () => {
  const s = subject(baseRecipient)
  assert(s.includes('Magna Coahuila'), 'subject contains company')
  assert(s.length < 80, `subject under 80 chars (actual: ${s.length})`)
  assert(!s.includes('!'), 'subject has no exclamation mark')
  assert(!/URGENTE|GRATIS|PROMO/i.test(s), 'subject has no spam trigger words')
})

group('bodyText · greeting, hook, CTA, unsub all present', () => {
  const t = bodyText(baseRecipient, fakeCta)
  assert(t.includes('Hola Juan'), 'greets by first name')
  assert(t.includes('Patente 3596'), 'mentions patente')
  assert(t.includes('Aduana 240'), 'mentions aduana')
  assert(t.includes('1941'), 'mentions establishment year')
  assert(t.includes('Renato Zapata III'), 'signed by Director General')
  assert(t.includes('Director General'), 'role present')
  assert(t.includes('portal.renatozapata.com'), 'portal URL present')
  assert(t.includes('ai@renatozapata.com'), 'unsub mailto present')
  assert(t.length < 1200, `body text under 1200 chars (actual: ${t.length})`)
})

group('bodyText · greets Equipo de compras when firstName absent', () => {
  const r = { ...baseRecipient, firstName: undefined }
  const t = bodyText(r, fakeCta)
  assert(t.includes('Equipo de compras'), 'falls back to "Equipo de compras"')
  assert(!t.includes('undefined'), 'no undefined leaked into copy')
})

group('bodyHtml · escapes injected HTML in company / firstName', () => {
  const evil: Recipient = {
    ...baseRecipient,
    company: 'Evil <script>alert(1)</script> Co',
    firstName: 'Juan"><img src=x>',
  }
  const h = bodyHtml(evil, fakeCta)
  assert(!h.includes('<script>'), 'raw <script> not present')
  assert(!h.includes('onerror=') && !h.includes('<img src=x'), 'raw <img> not present')
  assert(h.includes('&lt;script&gt;'), 'script tag escaped')
  assert(h.includes('&lt;img'), 'img tag escaped')
})

group('bodyHtml · contains required structural elements', () => {
  const h = bodyHtml(baseRecipient, fakeCta)
  assert(h.startsWith('<!DOCTYPE html>'), 'valid HTML doctype')
  assert(h.includes('RENATO ZAPATA &amp; CO.'), 'wordmark rendered')
  assert(h.includes('Patente 3596'), 'letterhead present')
  assert(h.includes('darse de baja'), 'unsubscribe link text present')
  assert(h.includes('List-Unsubscribe') === false, 'header lives in unsubHeaders, not body')
})

group('unsubUrl · mailto with encoded token', () => {
  const u = unsubUrl('ABC123', 'portal.renatozapata.com')
  assert(u.startsWith('mailto:'), 'is mailto link')
  assert(u.includes('UNSUBSCRIBE'), 'subject encodes UNSUBSCRIBE')
  assert(u.includes('ABC123'), 'token embedded')
  assert(u.includes('ai@renatozapata.com'), 'goes to ai@ inbox')
})

group('unsubHeaders · RFC 8058 compliance', () => {
  const h = unsubHeaders(baseRecipient, fakeCta)
  assert(!!h['List-Unsubscribe'], 'List-Unsubscribe header present')
  assert(/^<mailto:/.test(h['List-Unsubscribe'] || ''), 'List-Unsubscribe value wraps mailto in angle brackets')
  assert(h['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click', 'List-Unsubscribe-Post is One-Click')
})

group('industry regex · safe on edge inputs', () => {
  assert(industryHook('Automotive').includes('autom'), 'short "Automotive" matches auto')
  assert(industryHook('AUTOMOTIVE TIER 1').includes('autom'), 'uppercase matches auto')
  assert(industryHook('auto-parts').includes('autom'), 'hyphen form matches auto')
  // Make sure we don't cross-match — "electronics" should NOT look automotive
  const e = industryHook('Electronics EMS')
  assert(e.includes('electr'), 'electronics matches electronics, not auto')
  assert(!e.includes('autom'), 'electronics hook does not contain autom substring')
})

group('bodyHtml · campaign id appears in footer reference', () => {
  const h = bodyHtml(baseRecipient, fakeCta)
  assert(h.includes('cold-2026-04-21'), 'campaign id rendered as footer reference')
})

group('phone/whatsapp/calendly CTA · optional', () => {
  const minimalCta: CTA = { email: 'ai@renatozapata.com', portalUrl: 'portal.renatozapata.com' }
  const t = bodyText(baseRecipient, minimalCta)
  assert(t.includes('ai@renatozapata.com'), 'email channel always present')
  assert(!t.includes('undefined'), 'optional channels do not leak undefined')
})

// ── Summary ─────────────────────────────────────────────────────────
console.log('')
console.log('─────────────────────────────────────')
console.log(`  ${passed} passed  ·  ${failed} failed`)
console.log('─────────────────────────────────────')

if (failed > 0) {
  console.log('\n  Failures:')
  for (const f of failures) console.log(`    ✗ ${f}`)
  process.exit(1)
}
console.log('\n  ✓ All smoke tests green. Templates ready for live send.')
process.exit(0)
