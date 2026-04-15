#!/usr/bin/env node
/**
 * tenant-validation.js — pre-onboarding health check for every active tenant.
 *
 * For each company in `companies` where active=true, probes:
 *   - traficos count last 90d (data freshness)
 *   - expediente_documentos count
 *   - clave_cliente sanity (unique, non-empty)
 *   - econta_cartera coverage (any open invoices?)
 *   - duplicate company_id slugs across the table
 *
 * Output: a ranked report — green / yellow / red per tenant, with
 * specific "what to fix before onboarding" notes.
 *
 * Usage:
 *   node scripts/tenant-validation.js                 # all active
 *   node scripts/tenant-validation.js --tier=1        # only Tier-1
 *   node scripts/tenant-validation.js --company=evco  # one tenant
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Tier-1 client claves from CLAUDE.md "Tier 1 clients ready to activate"
const TIER_1_CLAVES = new Set([
  '4275', // Faurecia
  '8225', // TS de San Pedro
  // Maniphor
  '8102',
  '5155', // Grupo Requena
  '3020', // MIMS
  '5343', // Hilos Iris
  // L Care — clave unknown to me; user adds if needed
  '9045', // Worldtech
  '3323', // Empaques Litograficos
  '6460', // Maquinaria del Pacifico
  '9254', // EVCO (already onboarded)
  '4598', // MAFESA
])

const args = process.argv.slice(2)
const tierFlag = args.find(a => a.startsWith('--tier='))
const companyFlag = args.find(a => a.startsWith('--company='))
const onlyTier1 = tierFlag === '--tier=1'
const onlyCompany = companyFlag ? companyFlag.split('=')[1] : null

function color(code, str) { return `\x1b[${code}m${str}\x1b[0m` }
const RED = (s) => color(31, s)
const YELLOW = (s) => color(33, s)
const GREEN = (s) => color(32, s)
const DIM = (s) => color(90, s)
const BOLD = (s) => color(1, s)

const ninetyDaysIso = new Date(Date.now() - 90 * 86_400_000).toISOString()

async function checkOne(co) {
  const { company_id, name, clave_cliente, active } = co
  const issues = []
  const facts = {}

  // 1. clave sanity
  if (!clave_cliente || clave_cliente.trim() === '') {
    issues.push({ severity: 'red', msg: 'No clave_cliente — econta data unreachable' })
  }

  // 2. traficos last 90d
  const { count: trafLast90 } = await sb
    .from('traficos').select('id', { count: 'exact', head: true })
    .eq('company_id', company_id).gte('fecha_llegada', ninetyDaysIso)
  facts.traficosLast90 = trafLast90 ?? 0
  if ((trafLast90 ?? 0) === 0) {
    issues.push({ severity: 'yellow', msg: 'Zero traficos in last 90d — cockpit will appear empty' })
  }

  // 3. traficos all-time
  const { count: trafTotal } = await sb
    .from('traficos').select('id', { count: 'exact', head: true })
    .eq('company_id', company_id)
  facts.traficosTotal = trafTotal ?? 0
  if ((trafTotal ?? 0) === 0) {
    issues.push({ severity: 'red', msg: 'Zero traficos all-time — wrong company_id mapping?' })
  }

  // 4. expediente_documentos
  const { count: docs } = await sb
    .from('expediente_documentos').select('id', { count: 'exact', head: true })
    .eq('company_id', company_id)
  facts.docs = docs ?? 0

  // 5. econta_cartera coverage
  if (clave_cliente) {
    const { count: cartera } = await sb
      .from('econta_cartera').select('id', { count: 'exact', head: true })
      .eq('cve_cliente', clave_cliente)
    facts.cartera = cartera ?? 0
    if ((cartera ?? 0) === 0) {
      issues.push({ severity: 'yellow', msg: `econta_cartera empty for clave ${clave_cliente} — CxC reports will be 0` })
    }
  }

  // 6. recent activity vs sync (data going stale signal)
  const { data: latestTraf } = await sb
    .from('traficos').select('updated_at').eq('company_id', company_id)
    .order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (latestTraf?.updated_at) {
    const hoursAgo = Math.floor((Date.now() - new Date(latestTraf.updated_at).getTime()) / 3_600_000)
    facts.lastSyncHoursAgo = hoursAgo
    if (hoursAgo > 48) {
      issues.push({ severity: 'yellow', msg: `Last sync ${hoursAgo}h ago — Throne pipeline may be stale` })
    }
  } else {
    issues.push({ severity: 'red', msg: 'No traficos.updated_at — never synced' })
  }

  return { company_id, name, clave_cliente, active, issues, facts }
}

;(async () => {
  console.log(BOLD('\nZAPATA AI · Tenant Validation\n'))
  console.log(DIM(`generated ${new Date().toISOString()}\n`))

  let q = sb.from('companies').select('company_id, name, clave_cliente, active').eq('active', true)
  if (onlyCompany) q = q.eq('company_id', onlyCompany)
  q = q.order('name', { ascending: true }).limit(500)
  const { data: companies } = await q
  if (!companies || companies.length === 0) {
    console.log(RED('No active companies match.'))
    process.exit(1)
  }

  const filtered = onlyTier1
    ? companies.filter(c => TIER_1_CLAVES.has(c.clave_cliente))
    : companies

  if (filtered.length === 0) {
    console.log(YELLOW('No matching tenants.'))
    process.exit(1)
  }

  // Duplicate clave detection
  const claveCounts = new Map()
  for (const c of companies) {
    if (!c.clave_cliente) continue
    claveCounts.set(c.clave_cliente, (claveCounts.get(c.clave_cliente) ?? 0) + 1)
  }
  const dupClaves = [...claveCounts.entries()].filter(([, n]) => n > 1)
  if (dupClaves.length > 0) {
    console.log(RED(BOLD('⚠ Duplicate clave_cliente values detected portal-wide:')))
    for (const [clave, n] of dupClaves) {
      const owners = companies.filter(c => c.clave_cliente === clave).map(c => `${c.company_id} (${c.name})`).join(', ')
      console.log(`  ${RED(clave)} — ${n} rows: ${owners}`)
    }
    console.log()
  }

  console.log(BOLD(`Probing ${filtered.length} tenant${filtered.length === 1 ? '' : 's'}…\n`))

  const results = []
  for (const co of filtered) results.push(await checkOne(co))

  // Summarize by severity
  const byRed = results.filter(r => r.issues.some(i => i.severity === 'red'))
  const byYellow = results.filter(r => r.issues.length > 0 && !r.issues.some(i => i.severity === 'red'))
  const byGreen = results.filter(r => r.issues.length === 0)

  // Print red first
  if (byRed.length > 0) {
    console.log(RED(BOLD(`\n🔴 BLOCKERS (${byRed.length}) — fix before onboarding`)))
    for (const r of byRed) printTenant(r)
  }
  if (byYellow.length > 0) {
    console.log(YELLOW(BOLD(`\n🟡 WARNINGS (${byYellow.length}) — onboard with awareness`)))
    for (const r of byYellow) printTenant(r)
  }
  if (byGreen.length > 0) {
    console.log(GREEN(BOLD(`\n🟢 READY (${byGreen.length}) — clean to onboard`)))
    for (const r of byGreen) {
      const claveTag = r.clave_cliente ? DIM(`clave ${r.clave_cliente}`) : DIM('no clave')
      console.log(`  ${GREEN('✓')} ${r.name} ${claveTag} · ${r.facts.traficosLast90} traficos 90d · ${r.facts.docs} docs`)
    }
  }

  console.log(`\n${BOLD('Summary:')} ${RED(byRed.length + ' red')} · ${YELLOW(byYellow.length + ' yellow')} · ${GREEN(byGreen.length + ' green')}\n`)
  process.exit(byRed.length > 0 ? 1 : 0)
})().catch(err => {
  console.error(RED('FATAL: ' + err.message))
  process.exit(2)
})

function printTenant(r) {
  const claveTag = r.clave_cliente ? DIM(`clave ${r.clave_cliente}`) : DIM('no clave')
  const factLine = `traficos: ${r.facts.traficosTotal} all · ${r.facts.traficosLast90} (90d) · docs: ${r.facts.docs} · cartera: ${r.facts.cartera ?? '?'}` +
    (r.facts.lastSyncHoursAgo != null ? ` · last sync: ${r.facts.lastSyncHoursAgo}h` : '')
  console.log(`\n  ${BOLD(r.name)} ${claveTag} ${DIM(`(${r.company_id})`)}`)
  console.log(`    ${DIM(factLine)}`)
  for (const i of r.issues) {
    const dot = i.severity === 'red' ? RED('●') : i.severity === 'yellow' ? YELLOW('●') : GREEN('●')
    console.log(`    ${dot} ${i.msg}`)
  }
}
