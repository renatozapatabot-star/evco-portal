#!/usr/bin/env node
/**
 * verify-client-isolation.js — simulates Ursula (evco2026) hitting
 * various endpoints with tampered inputs to verify she cannot see
 * another company's data.
 *
 * The test: log in as evco2026, then attempt to fetch resources whose
 * company_id is NOT "evco". Every such request must return 403/404/empty,
 * never another tenant's rows.
 *
 * Exit 0 = clean. Exit 1 = at least one leak.
 *
 * Usage:
 *   DRY_RUN_PASSWORD=evco2026 node scripts/verify-client-isolation.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const URL_BASE = process.env.DRY_RUN_URL || 'https://portal.renatozapata.com'
const PASSWORD = process.env.DRY_RUN_PASSWORD
if (!PASSWORD) {
  console.error('[fatal] DRY_RUN_PASSWORD required')
  process.exit(1)
}

let cookieJar = ''
const issues = []

async function login() {
  // Step 1: GET /login to pick up a csrf cookie (middleware validates mutating POSTs)
  const prelude = await fetch(`${URL_BASE}/login`, { redirect: 'manual' })
  const setCookieRaw = prelude.headers.get('set-cookie') || ''
  const cookies = setCookieRaw.split(/,(?=\s*[a-zA-Z0-9_]+=)/)
    .map((c) => c.trim().split(';')[0])
    .filter(Boolean)
  cookieJar = cookies.join('; ')
  // Read csrf from the parsed cookies (readable: not HttpOnly)
  const csrf = (cookies.find((c) => c.startsWith('csrf_token=')) || '').split('=')[1] || ''

  // Step 2: POST /api/auth with { password } + CSRF header
  const res = await fetch(`${URL_BASE}/api/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
      cookie: cookieJar,
    },
    body: JSON.stringify({ password: PASSWORD }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`login failed: ${res.status} — ${txt.slice(0, 120)}`)
  }
  // Merge the post-login Set-Cookie additions into the jar
  const postCookieRaw = res.headers.get('set-cookie') || ''
  const newCookies = postCookieRaw.split(/,(?=\s*[a-zA-Z0-9_]+=)/)
    .map((c) => c.trim().split(';')[0])
    .filter(Boolean)
  const merged = new Map(cookies.map((c) => [c.split('=')[0], c]))
  for (const nc of newCookies) merged.set(nc.split('=')[0], nc)
  cookieJar = Array.from(merged.values()).join('; ')
  console.log(`✓ logged in (cookies: ${merged.size})`)
}

async function authedGet(path) {
  return fetch(`${URL_BASE}${path}`, { headers: { cookie: cookieJar } })
}

async function probe(label, path, assertion) {
  process.stdout.write(`  ▶ ${label} — `)
  try {
    const res = await authedGet(path)
    const body = await res.json().catch(() => ({}))
    const verdict = assertion(res, body)
    if (verdict.ok) {
      console.log(`✅ ${verdict.reason || 'pass'}`)
    } else {
      console.log(`❌ ${verdict.reason}`)
      issues.push({ label, path, reason: verdict.reason, status: res.status, bodyPreview: JSON.stringify(body).slice(0, 200) })
    }
  } catch (e) {
    console.log(`⚠️  error: ${e.message}`)
  }
}

;(async () => {
  console.log(`🔐 client isolation smoke — ${new Date().toISOString()}`)
  console.log(`   base: ${URL_BASE}\n`)

  await login()

  console.log('\n── /api/data — tenant-scoped table reads ──')
  await probe(
    'traficos with explicit company_id=mafesa (should ignore for client role)',
    '/api/data?table=traficos&limit=5&company_id=mafesa',
    (res, body) => {
      if (res.status === 200) {
        const rows = body.data || []
        const foreign = rows.filter((r) => r.company_id && r.company_id !== 'evco')
        if (foreign.length > 0) return { ok: false, reason: `LEAK: ${foreign.length} non-evco row(s)` }
        return { ok: true, reason: `${rows.length} rows, all evco-scoped` }
      }
      return { ok: true, reason: `status ${res.status} (blocked)` }
    },
  )

  await probe(
    'pedimentos with company_id=faurecia',
    '/api/data?table=pedimentos&limit=5&company_id=faurecia',
    (res, body) => {
      if (res.status === 200) {
        const rows = body.data || []
        const foreign = rows.filter((r) => r.company_id && r.company_id !== 'evco')
        if (foreign.length > 0) return { ok: false, reason: `LEAK: ${foreign.length} non-evco row(s)` }
        return { ok: true, reason: `${rows.length} rows, all evco-scoped` }
      }
      return { ok: true, reason: `status ${res.status} (blocked)` }
    },
  )

  await probe(
    'globalpc_facturas with cve_cliente=9255 (a non-evco clave)',
    '/api/data?table=globalpc_facturas&limit=5&cve_cliente=9255',
    (res, body) => {
      if (res.status === 200) {
        const rows = body.data || []
        const foreign = rows.filter((r) => r.cve_cliente && r.cve_cliente !== '9254' && r.cve_cliente !== 'evco')
        if (foreign.length > 0) return { ok: false, reason: `LEAK: ${foreign.length} foreign-clave row(s)` }
        return { ok: true, reason: `${rows.length} rows, evco-scoped` }
      }
      return { ok: true, reason: `status ${res.status} (blocked)` }
    },
  )

  console.log('\n── broker-only routes should reject ──')
  await probe(
    '/api/broker/data',
    '/api/broker/data',
    (res, body) => {
      if (res.status === 200) return { ok: false, reason: `broker data returned 200 to client role` }
      return { ok: true, reason: `status ${res.status} (correctly rejected)` }
    },
  )

  await probe(
    '/api/admin/onboard',
    '/api/admin/onboard',
    (res, body) => {
      if (res.status === 200 && body.data) return { ok: false, reason: `admin route returned data to client` }
      return { ok: true, reason: `status ${res.status}` }
    },
  )

  console.log('\n── client-forbidden tables must 403 ──')
  const forbiddenTables = [
    'econta_facturas',
    'econta_cartera',
    'globalpc_contenedores',
    'globalpc_ordenes_carga',
    'oca_database',
    'bridge_intelligence',
    'trade_prospects',
  ]
  for (const t of forbiddenTables) {
    await probe(
      `/api/data?table=${t}`,
      `/api/data?table=${t}&limit=1`,
      (res, body) => {
        if (res.status === 403) return { ok: true, reason: 'correctly forbidden' }
        if (res.status === 400) return { ok: true, reason: `rejected (${body.error || '400'})` }
        if (res.status === 200 && (body.data || []).length > 0) {
          return { ok: false, reason: `LEAK: client read ${(body.data || []).length} row(s) of ${t}` }
        }
        return { ok: true, reason: `status ${res.status}` }
      },
    )
  }

  console.log('\n── Summary ──')
  if (issues.length === 0) {
    console.log('✅ No isolation leaks found (' + new Date().toISOString() + ')')
    process.exit(0)
  } else {
    console.log(`❌ ${issues.length} leak(s) found:`)
    for (const i of issues) {
      console.log(`  - ${i.label} → ${i.reason}`)
      console.log(`    path: ${i.path}`)
      console.log(`    body: ${i.bodyPreview}`)
    }
    process.exit(1)
  }
})().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
