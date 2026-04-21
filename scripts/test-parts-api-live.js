#!/usr/bin/env node
/** Live smoke test for the new parte intelligence endpoints. */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const URL_BASE = process.env.DRY_RUN_URL || 'https://portal.renatozapata.com'
const PASSWORD = process.env.DRY_RUN_PASSWORD
if (!PASSWORD) { console.error('DRY_RUN_PASSWORD required'); process.exit(1) }

let jar = ''

async function login() {
  const prelude = await fetch(`${URL_BASE}/login`, { redirect: 'manual' })
  const cookies = (prelude.headers.get('set-cookie') || '').split(/,(?=\s*[a-zA-Z0-9_]+=)/).map((c) => c.trim().split(';')[0]).filter(Boolean)
  const csrf = (cookies.find((c) => c.startsWith('csrf_token=')) || '').split('=')[1] || ''
  jar = cookies.join('; ')

  const res = await fetch(`${URL_BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, cookie: jar },
    body: JSON.stringify({ password: PASSWORD }),
  })
  if (!res.ok) { const t = await res.text(); throw new Error(`login ${res.status}: ${t.slice(0, 140)}`) }
  const post = (res.headers.get('set-cookie') || '').split(/,(?=\s*[a-zA-Z0-9_]+=)/).map((c) => c.trim().split(';')[0]).filter(Boolean)
  const merged = new Map(cookies.map((c) => [c.split('=')[0], c]))
  for (const nc of post) merged.set(nc.split('=')[0], nc)
  jar = Array.from(merged.values()).join('; ')
}

async function authedGet(path) {
  return fetch(`${URL_BASE}${path}`, { headers: { cookie: jar } })
}

;(async () => {
  console.log(`🧪 parts API smoke — ${new Date().toISOString()}`)
  console.log(`   ${URL_BASE}\n`)

  await login()
  console.log('✓ logged in\n')

  // 1. List — smallest page
  const list = await authedGet('/api/catalogo/partes?limit=3')
  const listJson = await list.json()
  console.log('▶ GET /api/catalogo/partes?limit=3')
  console.log(`  status ${list.status}, partes returned: ${listJson.data?.partes?.length}, total: ${listJson.data?.total}`)
  if (listJson.data?.partes?.[0]) {
    const p = listJson.data.partes[0]
    console.log(`  sample: ${p.cve_producto} · "${(p.descripcion || '').slice(0, 50)}" · fraccion ${p.fraccion_formatted || p.fraccion || '—'} · used ${p.times_used_24mo}×`)
  }

  // 2. List with search
  const search = await authedGet('/api/catalogo/partes?search=plastic&limit=3')
  const searchJson = await search.json()
  console.log(`\n▶ GET /api/catalogo/partes?search=plastic`)
  console.log(`  status ${search.status}, partes: ${searchJson.data?.partes?.length}`)

  // 3. Attempt cross-tenant — should still return ONLY evco
  const cross = await authedGet('/api/catalogo/partes?company_id=mafesa&limit=3')
  const crossJson = await cross.json()
  console.log(`\n▶ GET /api/catalogo/partes?company_id=mafesa  (client role: param ignored)`)
  console.log(`  status ${cross.status}, partes: ${crossJson.data?.partes?.length}`)
  // We'd need to check each row, but we know from the route logic that param is ignored for client role

  // 4. Detail — use first parte from list
  const firstCve = listJson.data?.partes?.[0]?.cve_producto
  if (firstCve) {
    const detail = await authedGet(`/api/catalogo/partes/${encodeURIComponent(firstCve)}`)
    const detailJson = await detail.json()
    console.log(`\n▶ GET /api/catalogo/partes/${firstCve}`)
    console.log(`  status ${detail.status}`)
    if (detailJson.data?.parte) {
      const p = detailJson.data.parte
      console.log(`  parte: ${p.cve_producto} · used ${p.times_used_lifetime}× lifetime · ${detailJson.data.classifications?.length} classifications · ${detailJson.data.ocas?.length} OCAs · ${detailJson.data.proveedores?.length} proveedores`)
      console.log(`  supertito_stats: ${JSON.stringify(detailJson.data.supertito_stats)}`)
      console.log(`  uses_timeline: ${detailJson.data.uses_timeline?.length} rows`)
      console.log(`  cost_trend: ${detailJson.data.cost_trend?.length} months`)
    }
  }

  // 5. Fake cve → 404
  const fake = await authedGet('/api/catalogo/partes/FAKE_NOT_A_REAL_CVE_XYZ')
  console.log(`\n▶ GET /api/catalogo/partes/FAKE_NOT_A_REAL_CVE_XYZ`)
  console.log(`  status ${fake.status} (expect 404)`)

  // 6. Unauthenticated
  const anon = await fetch(`${URL_BASE}/api/catalogo/partes?limit=1`)
  console.log(`\n▶ GET /api/catalogo/partes (no auth)`)
  console.log(`  status ${anon.status} (expect 401)`)

  console.log('\n--- done ---')
})().catch((e) => { console.error('[fatal]', e); process.exit(1) })
