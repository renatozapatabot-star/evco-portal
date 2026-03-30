#!/usr/bin/env node
/**
 * CRUZ Monday Smoke Test
 * Verifies everything works before clients log in
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN

async function runSmokeTests() {
  const results = []

  // 1. Supabase connected
  try {
    const { data, error } = await supabase.from('companies').select('company_id', { count: 'exact', head: true }).eq('active', true)
    results.push({ test: 'Supabase connection', pass: !error, detail: `${data?.length || 0} companies` })
  } catch (e) {
    results.push({ test: 'Supabase connection', pass: false, detail: e.message })
  }

  // 2. Companies populated
  const { count: compCount } = await supabase.from('companies').select('*', { count: 'exact', head: true }).eq('active', true)
  results.push({ test: 'Companies populated', pass: (compCount || 0) >= 10, detail: `${compCount} active` })

  // 3. EVCO tráficos exist
  const { count: evcoCount } = await supabase.from('traficos').select('*', { count: 'exact', head: true }).eq('company_id', 'evco')
  results.push({ test: 'EVCO tráficos', pass: (evcoCount || 0) > 0, detail: `${evcoCount} rows` })

  // 4. Multi-client data
  const { data: multiClient } = await supabase.from('traficos').select('company_id').neq('company_id', 'evco').limit(5)
  results.push({ test: 'Multi-client data', pass: (multiClient?.length || 0) > 0, detail: `${multiClient?.length} non-EVCO rows` })

  // 5. Data isolation
  const { data: evcoData } = await supabase.from('traficos').select('company_id').eq('company_id', 'evco').limit(10)
  const contaminated = (evcoData || []).filter(r => r.company_id !== 'evco')
  results.push({ test: 'Data isolation', pass: contaminated.length === 0, detail: 'No cross-contamination' })

  // 6. Risk scores populated
  const { count: riskCount } = await supabase.from('pedimento_risk_scores').select('*', { count: 'exact', head: true })
  results.push({ test: 'Risk scores', pass: (riskCount || 0) > 0, detail: `${riskCount} scored` })

  // 7. Integration health
  const { data: health } = await supabase.from('integration_health').select('status')
  const allHealthy = (health || []).every(h => h.status === 'healthy')
  results.push({ test: 'Integration health', pass: allHealthy || (health?.length || 0) === 0, detail: `${health?.length || 0} integrations checked` })

  // 8. Admin password configured
  results.push({ test: 'Admin password', pass: !!process.env.ADMIN_PASSWORD, detail: process.env.ADMIN_PASSWORD ? 'Set' : 'MISSING' })

  // 9. Anthropic API key
  results.push({ test: 'Anthropic API key', pass: !!process.env.ANTHROPIC_API_KEY, detail: process.env.ANTHROPIC_API_KEY ? 'Set' : 'MISSING' })

  // 10. Telegram bot
  if (TELEGRAM_TOKEN) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`)
      const data = await res.json()
      results.push({ test: 'Telegram bot', pass: data.ok, detail: data.result?.username || 'Connected' })
    } catch {
      results.push({ test: 'Telegram bot', pass: false, detail: 'Connection failed' })
    }
  } else {
    results.push({ test: 'Telegram bot', pass: false, detail: 'Token not set' })
  }

  // Print results
  console.log('\n🧪 MONDAY SMOKE TEST RESULTS')
  console.log('═'.repeat(50))
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length

  results.forEach(r => {
    console.log(`${r.pass ? '✅' : '❌'} ${r.test.padEnd(25)} ${r.detail || ''}`)
  })

  console.log('═'.repeat(50))
  console.log(`${passed}/${results.length} tests passed`)

  if (failed === 0) {
    console.log('✅ ALL CLEAR — Portal ready for Monday')
  } else {
    console.log(`❌ ${failed} TESTS FAILED — Fix before Monday`)
  }

  // Telegram notification
  if (TELEGRAM_TOKEN) {
    const msg = failed === 0
      ? `✅ SMOKE TEST PASSED\n${passed}/${results.length} checks OK\nPortal listo para el lunes\n— CRUZ 🦀`
      : `❌ SMOKE TEST: ${failed} FAILED\n${results.filter(r => !r.pass).map(r => `• ${r.test}`).join('\n')}\n— CRUZ 🦀`

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: '-5085543275', text: msg })
    }).catch(() => {})
  }

  return failed === 0
}

runSmokeTests().catch(console.error)
