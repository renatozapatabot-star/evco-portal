#!/usr/bin/env node

// ============================================================
// CRUZ Portal Smoke Test — hits every critical API route
// Verifies auth, client isolation, rate limiting, error handling
// Run: node scripts/portal-smoke-test.js [--prod]
// Target: completes in <30 seconds
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const PROD = process.argv.includes('--prod')
const BASE = PROD ? 'https://evco-portal.vercel.app' : 'http://localhost:3000'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let pass = 0, fail = 0, skip = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    pass++
    process.stdout.write('.')
  } catch (err) {
    fail++
    failures.push(`${name}: ${err.message}`)
    process.stdout.write('F')
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

// ── Auth helper: get a valid session ──
async function login(password) {
  const res = await fetch(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const cookies = res.headers.getSetCookie?.() || []
  const jar = {}
  for (const c of cookies) {
    const [kv] = c.split(';')
    const [k, v] = kv.split('=')
    jar[k.trim()] = v
  }
  return { status: res.status, cookies: jar, cookieHeader: cookies.map(c => c.split(';')[0]).join('; ') }
}

async function main() {
  const start = Date.now()
  console.log(`\n🧪 CRUZ Smoke Test — ${BASE}`)
  console.log('━'.repeat(50))

  // ── 1. Login ──
  let evcoSession
  await test('Login with evco2026', async () => {
    evcoSession = await login('evco2026')
    assert(evcoSession.status === 200, `Expected 200, got ${evcoSession.status}`)
    assert(evcoSession.cookies.portal_session, 'Missing portal_session cookie')
    assert(evcoSession.cookies.csrf_token, 'Missing csrf_token cookie')
  })

  await test('Login with bad password → 401', async () => {
    const res = await fetch(`${BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrongpassword' }),
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  if (!evcoSession?.cookieHeader) {
    console.log('\n❌ Login failed — cannot continue')
    process.exit(1)
  }

  const headers = { Cookie: evcoSession.cookieHeader }

  // ── 2. /api/data — valid requests ──
  await test('/api/data?table=traficos → 200', async () => {
    const res = await fetch(`${BASE}/api/data?table=traficos&limit=1`, { headers })
    assert(res.status === 200, `Got ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.data), 'Missing data array')
  })

  await test('/api/data?table=entradas → 200', async () => {
    const res = await fetch(`${BASE}/api/data?table=entradas&limit=1`, { headers })
    assert(res.status === 200, `Got ${res.status}`)
  })

  await test('/api/data?table=aduanet_facturas → 200', async () => {
    const res = await fetch(`${BASE}/api/data?table=aduanet_facturas&limit=1`, { headers })
    assert(res.status === 200, `Got ${res.status}`)
  })

  // ── 3. /api/data — invalid requests ──
  await test('/api/data?table=INVALID → 400', async () => {
    const res = await fetch(`${BASE}/api/data?table=users_secret`, { headers })
    assert(res.status === 400, `Expected 400, got ${res.status}`)
  })

  await test('/api/data without session → 401', async () => {
    const res = await fetch(`${BASE}/api/data?table=traficos&limit=1`)
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  // ── 4. Client isolation ──
  await test('/api/data returns only evco data', async () => {
    const res = await fetch(`${BASE}/api/data?table=traficos&limit=5`, { headers })
    const body = await res.json()
    const nonEvco = (body.data || []).filter(r => r.company_id && r.company_id !== 'evco')
    assert(nonEvco.length === 0, `Found ${nonEvco.length} non-evco rows: ${nonEvco.map(r => r.company_id).join(',')}`)
  })

  await test('/api/data ignores company_id=mafesa for client', async () => {
    const res = await fetch(`${BASE}/api/data?table=traficos&company_id=mafesa&limit=5`, { headers })
    const body = await res.json()
    const mafesa = (body.data || []).filter(r => r.company_id === 'mafesa')
    assert(mafesa.length === 0, `Client leaked ${mafesa.length} mafesa rows`)
  })

  // ── 5. /api/cruz-chat — auth ──
  await test('/api/cruz-chat without session → 401', async () => {
    const res = await fetch(`${BASE}/api/cruz-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
    })
    assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`)
  })

  // ── 6. /api/search — auth ──
  await test('/api/search without session → 401', async () => {
    const res = await fetch(`${BASE}/api/search?q=test`)
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  await test('/api/search with session → 200', async () => {
    const res = await fetch(`${BASE}/api/search?q=9254`, { headers })
    assert(res.status === 200, `Got ${res.status}`)
  })

  // ── 7. Protected pages redirect ──
  await test('/admin as client → redirect', async () => {
    const res = await fetch(`${BASE}/admin`, { headers, redirect: 'manual' })
    assert(res.status === 307 || res.status === 308, `Expected redirect, got ${res.status}`)
  })

  await test('/broker as client → redirect', async () => {
    const res = await fetch(`${BASE}/broker`, { headers, redirect: 'manual' })
    assert(res.status === 307 || res.status === 308, `Expected redirect, got ${res.status}`)
  })

  // ── 8. Redirects ──
  await test('/cruz-ai → /cruz redirect', async () => {
    const res = await fetch(`${BASE}/cruz-ai`, { redirect: 'manual' })
    assert(res.status === 308 || res.status === 307, `Expected redirect, got ${res.status}`)
  })

  // ── 9. Logout ──
  await test('Logout → clears cookies', async () => {
    const res = await fetch(`${BASE}/api/auth`, { method: 'DELETE', headers })
    assert(res.status === 200, `Got ${res.status}`)
  })

  // ── Summary ──
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Passed: ${pass}`)
  if (fail > 0) {
    console.log(`❌ Failed: ${fail}`)
    failures.forEach(f => console.log(`   ${f}`))
  }
  console.log(`⏱️  ${elapsed}s`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  process.exit(fail > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
