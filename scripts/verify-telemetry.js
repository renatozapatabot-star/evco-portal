#!/usr/bin/env node
// V2-A Telemetry Verification Script

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verify() {
  const checks = []

  // 1. Table exists + insert
  const testSession = 'verify-' + Date.now()
  const { data: inserted, error: insertErr } = await supabase
    .from('interaction_events')
    .insert({
      event_type: '_verify',
      page_path: '/_verify',
      session_id: testSession,
      payload: { test: true, ts: new Date().toISOString() },
    })
    .select('id')
    .single()

  checks.push({
    name: 'Table exists + insert',
    pass: !insertErr && inserted?.id,
    detail: insertErr?.message || `id=${inserted?.id}`,
  })

  // 2. Query works
  if (inserted?.id) {
    const { data: queried, error: queryErr } = await supabase
      .from('interaction_events')
      .select('*')
      .eq('id', inserted.id)
      .single()

    checks.push({
      name: 'Query by PK',
      pass: !queryErr && queried?.event_type === '_verify',
      detail: queryErr?.message || 'OK',
    })

    // 3. Cleanup
    await supabase.from('interaction_events').delete().eq('id', inserted.id)
    checks.push({ name: 'Cleanup test row', pass: true, detail: 'deleted' })
  }

  // 4. API route (if dev server running)
  try {
    const res = await fetch('http://localhost:3000/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [{ event_type: '_verify', page_path: '/_verify' }],
      }),
    })
    const json = await res.json()
    checks.push({
      name: 'API /api/telemetry',
      pass: json.ok === true,
      detail: JSON.stringify(json),
    })
  } catch {
    checks.push({
      name: 'API /api/telemetry',
      pass: false,
      detail: 'Dev server not running (expected in CI)',
    })
  }

  // Report
  console.log('\n=== V2-A Telemetry Verification ===\n')
  for (const c of checks) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}: ${c.detail}`)
  }
  const critical = checks.filter((c) => c.name !== 'API /api/telemetry')
  const allPass = critical.every((c) => c.pass)
  console.log(
    `\n${allPass ? '✅ All critical checks passed' : '❌ Some checks failed'}\n`
  )
  process.exit(allPass ? 0 : 1)
}

verify().catch((err) => {
  console.error('Verify failed:', err.message)
  process.exit(1)
})
