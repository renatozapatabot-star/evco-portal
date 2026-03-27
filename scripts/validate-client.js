const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Pass client config as args or use defaults (EVCO)
const CLIENT_NAME = process.argv[2] || 'EVCO Plastics'
const COMPANY_ID  = process.argv[3] || 'evco'
const CLAVE       = process.argv[4] || '9254'
const PORTAL_URL  = process.argv[5] || 'https://evco-portal.vercel.app'

function pass(label) { console.log(`  ✅ ${label}`) }
function fail(label, detail) { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`) }
function warn(label, detail) { console.log(`  ⚠️  ${label}${detail ? ': ' + detail : ''}`) }
function header(label) { console.log(`\n── ${label} ──`) }

async function validateClient() {
  console.log(`\n🦀 CRUZ CLIENT VALIDATOR`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Client:     ${CLIENT_NAME}`)
  console.log(`Company ID: ${COMPANY_ID}`)
  console.log(`Clave:      ${CLAVE}`)
  console.log(`Portal:     ${PORTAL_URL}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  let passed = 0
  let failed = 0
  let warned = 0

  // ── ENV VARIABLES ──────────────────────────────────────
  header('ENV VARIABLES')

  const requiredEnv = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]
  const optionalEnv = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'TELEGRAM_BOT_TOKEN',
    'BANXICO_TOKEN',
    'GLOBALPC_WSDL_URL',
    'GLOBALPC_USER',
    'GLOBALPC_PASS',
    'REVALIDATE_SECRET',
  ]

  for (const key of requiredEnv) {
    if (process.env[key]) { pass(key); passed++ }
    else { fail(key, 'REQUIRED — portal will not work'); failed++ }
  }
  for (const key of optionalEnv) {
    if (process.env[key]) { pass(key); passed++ }
    else { warn(key, 'optional but recommended'); warned++ }
  }

  // ── SUPABASE DATA ──────────────────────────────────────
  header('SUPABASE DATA')

  // Check traficos
  const { data: traf, error: trafErr } = await supabase
    .from('traficos').select('trafico, estatus').eq('company_id', COMPANY_ID).limit(5)
  if (trafErr) { fail('traficos table', trafErr.message); failed++ }
  else if (traf.length === 0) { warn('traficos', `No records for company_id="${COMPANY_ID}"`); warned++ }
  else { pass(`traficos (${traf.length} sample rows found)`); passed++ }

  // Check entradas
  const { data: ent, error: entErr } = await supabase
    .from('entradas').select('cve_entrada').eq('company_id', COMPANY_ID).limit(3)
  if (entErr) { fail('entradas table', entErr.message); failed++ }
  else if (ent.length === 0) { warn('entradas', `No records for company_id="${COMPANY_ID}"`); warned++ }
  else { pass(`entradas (${ent.length} sample rows found)`); passed++ }

  // Check aduanet_facturas
  const { data: fact, error: factErr } = await supabase
    .from('aduanet_facturas').select('referencia').eq('clave_cliente', CLAVE).limit(3)
  if (factErr) { fail('aduanet_facturas table', factErr.message); failed++ }
  else if (fact.length === 0) { warn('aduanet_facturas', `No records for clave_cliente="${CLAVE}"`); warned++ }
  else { pass(`aduanet_facturas (${fact.length} sample rows found)`); passed++ }

  // ── ROW COUNTS ─────────────────────────────────────────
  header('ROW COUNTS')

  const counts = await Promise.all([
    supabase.from('traficos').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    supabase.from('entradas').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    supabase.from('aduanet_facturas').select('*', { count: 'exact', head: true }).eq('clave_cliente', CLAVE),
    supabase.from('coves').select('*', { count: 'exact', head: true }),
  ])

  const [trafCount, entCount, factCount, covesCount] = counts
  console.log(`  traficos:         ${(trafCount.count || 0).toLocaleString()}`)
  console.log(`  entradas:         ${(entCount.count || 0).toLocaleString()}`)
  console.log(`  aduanet_facturas: ${(factCount.count || 0).toLocaleString()}`)
  console.log(`  coves:            ${(covesCount.count || 0).toLocaleString()}`)

  // ── PORTAL ─────────────────────────────────────────────
  header('PORTAL')

  try {
    const res = await fetch(PORTAL_URL, { signal: AbortSignal.timeout(10000) })
    if (res.status === 200) { pass(`Portal responding (HTTP ${res.status})`); passed++ }
    else { fail(`Portal HTTP ${res.status}`, PORTAL_URL); failed++ }
  } catch (e) {
    fail('Portal unreachable', e.message); failed++
  }

  // ── SCRIPTS ────────────────────────────────────────────
  header('SCRIPTS')

  const fsModule = require('fs')
  const scripts = [
    'scripts/morning-report.js',
    'scripts/evco-weekly-audit.js',
    'scripts/telegram-bot.js',
    'scripts/tipo-cambio-monitor.js',
    'scripts/entradas-anomaly.js',
    'scripts/proveedor-intelligence.js',
    'scripts/globalpc-sync.js',
    'scripts/heartbeat.js',
  ]

  for (const s of scripts) {
    if (fsModule.existsSync(s)) { pass(s); passed++ }
    else { warn(s, 'not yet created'); warned++ }
  }

  // ── SUMMARY ────────────────────────────────────────────
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`VALIDATION COMPLETE`)
  console.log(`  ✅ Passed:  ${passed}`)
  console.log(`  ⚠️  Warned:  ${warned}`)
  console.log(`  ❌ Failed:  ${failed}`)

  if (failed === 0 && warned <= 3) {
    console.log(`\n🟢 ${CLIENT_NAME} portal is READY`)
  } else if (failed === 0) {
    console.log(`\n🟡 ${CLIENT_NAME} portal is functional but ${warned} items need attention`)
  } else {
    console.log(`\n🔴 ${CLIENT_NAME} portal has ${failed} critical issue(s) — fix before going live`)
  }

  console.log(`\nTo validate a new client:`)
  console.log(`  node scripts/validate-client.js "Client Name" company_id clave https://portal-url.vercel.app`)
}

validateClient().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
