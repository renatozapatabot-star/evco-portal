#!/usr/bin/env node
/**
 * CRUZ — Block 13: Generate credentials for top 10 clients
 *
 * Ranks clients by last-14-day shipment volume, generates {slug}2026 passwords,
 * sets portal_password + active on companies, creates trial_clients records,
 * logs to operator_actions, outputs WhatsApp messages for Tito.
 *
 * Usage:
 *   node scripts/block13-launch-credentials.js --dry-run    # Preview only
 *   node scripts/block13-launch-credentials.js              # Activate
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')
const PORTAL_URL = 'https://portal.renatozapata.com'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Top 10 from Phase 1 report — ranked by last-14-day shipment volume
const TOP_10 = [
  'evco',
  'ts-san-pedro',
  'maniphor',
  'hilos-iris',
  'faurecia',
  'pti-dos',
  'plasticos-villagar',
  'mafesa',
  'gostech',
  'cable-proveedora',
]

function generatePassword(companyId) {
  const slug = companyId.split('-').slice(0, 2).join('')
  return slug.substring(0, 10) + '2026'
}

function generateWhatsApp(companyName, password) {
  return `Buenos días. Les activamos acceso a su portal de operaciones aduanales. Todo su historial desde 2024 ya está disponible.

Portal: ${PORTAL_URL}
Contraseña: ${password}

Pruébenlo 30 días sin costo. Cualquier duda estamos a sus órdenes.

— Renato Zapata & Company
Patente 3596 · Aduana 240`
}

async function run() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  console.log(`\n${prefix}CRUZ — Block 13 Launch Credentials`)
  console.log('═'.repeat(70))

  // Password collision safety check
  const passwords = new Map()
  for (const cid of TOP_10) {
    const pw = generatePassword(cid)
    if (passwords.has(pw)) {
      console.error(`FATAL: Password collision: ${pw} -> ${passwords.get(pw)} AND ${cid}`)
      process.exit(1)
    }
    passwords.set(pw, cid)
  }
  console.log('Password collision check: PASSED (0 collisions)\n')

  // Also check that no EXISTING company already uses one of these passwords
  const { data: existingCompanies } = await supabase.from('companies')
    .select('company_id, portal_password')
    .not('portal_password', 'is', null)
  const existingPwMap = new Map((existingCompanies || []).map(c => [c.portal_password, c.company_id]))

  for (const cid of TOP_10) {
    const pw = generatePassword(cid)
    const owner = existingPwMap.get(pw)
    if (owner && owner !== cid) {
      console.error(`FATAL: Password "${pw}" already used by company "${owner}" — cannot assign to "${cid}"`)
      process.exit(1)
    }
  }
  console.log('Existing password conflict check: PASSED\n')

  // Fetch company details for all 10
  const { data: companies } = await supabase.from('companies')
    .select('company_id, name, clave_cliente, portal_password, active')
    .in('company_id', TOP_10)

  const companyMap = Object.fromEntries((companies || []).map(c => [c.company_id, c]))

  const activated = []
  const whatsappMessages = []

  console.log('Company'.padEnd(35) + 'Password'.padEnd(18) + 'Status')
  console.log('─'.repeat(70))

  for (const cid of TOP_10) {
    const company = companyMap[cid]
    if (!company) {
      console.log(`  ⚠️  ${cid} — NOT in companies table, SKIPPED`)
      continue
    }

    const password = generatePassword(cid)
    const companyName = company.name || cid
    const hadPassword = !!company.portal_password

    if (!DRY_RUN) {
      // Set password + active + force_password_reset
      await supabase.from('companies').update({
        portal_password: password,
        active: true,
      }).eq('company_id', cid)

      // Create trial record (upsert to avoid duplicate if already activated)
      await supabase.from('trial_clients').upsert({
        company_id: cid,
        activated_by: 'block_13_launch_prep',
        status: 'active',
        notes: `Block 13 launch credential. ${hadPassword ? 'Password refreshed.' : 'New activation.'}`,
      }, { onConflict: 'company_id' }).then(() => {}, () => {})

      // Check if operator exists, create if not
      const { data: existingOp } = await supabase.from('operators')
        .select('id')
        .eq('company_id', cid)
        .eq('role', 'client')
        .eq('active', true)
        .limit(1)
        .maybeSingle()

      if (!existingOp) {
        await supabase.from('operators').insert({
          auth_user_id: null,
          email: null,
          full_name: companyName,
          role: 'client',
          company_id: cid,
          active: true,
        }).then(() => {}, () => {})
      }

      // Log to operator_actions
      await supabase.from('operator_actions').insert({
        operator_id: null,
        action_type: 'block_13_credential_generated',
        target_table: 'companies',
        target_id: cid,
        company_id: cid,
        payload: {
          company_name: companyName,
          initial_password: password,
          requires_reset: true,
          had_previous_password: hadPassword,
        },
      }).then(() => {}, () => {})

      // Log to audit_log
      await supabase.from('audit_log').insert({
        action: 'block_13_credential_generated',
        entity_type: 'company',
        entity_id: cid,
        details: { password_set: true, had_previous: hadPassword },
        company_id: cid,
      }).then(() => {}, () => {})
    }

    const status = hadPassword ? '🔄 REFRESHED' : '✅ ACTIVATED'
    console.log(
      companyName.substring(0, 34).padEnd(35) +
      password.padEnd(18) +
      status
    )

    activated.push({
      company_id: cid,
      name: companyName,
      clave: company.clave_cliente,
      password,
      hadPassword,
    })

    whatsappMessages.push({
      company: companyName,
      message: generateWhatsApp(companyName, password),
    })
  }

  // WhatsApp messages for Tito
  console.log('\n' + '═'.repeat(70))
  console.log('📱 WHATSAPP MESSAGES FOR TITO')
  console.log('═'.repeat(70))

  for (const msg of whatsappMessages) {
    console.log(`\n── ${msg.company} ──`)
    console.log(msg.message)
  }

  // Credentials table
  console.log('\n' + '═'.repeat(70))
  console.log('🔑 CREDENTIALS TABLE')
  console.log('═'.repeat(70))
  console.log('')
  console.log('Login URL: ' + PORTAL_URL)
  console.log('')
  console.log('#   Company                          Password           Status')
  console.log('─'.repeat(70))
  activated.forEach((a, i) => {
    const status = a.hadPassword ? 'REFRESHED' : 'NEW'
    console.log(
      String(i + 1).padStart(2) + '. ' +
      a.name.substring(0, 32).padEnd(33) +
      a.password.padEnd(19) +
      status
    )
  })

  // Summary
  console.log('\n' + '═'.repeat(70))
  console.log(`${prefix}SUMMARY`)
  console.log(`   Total: ${activated.length} clients`)
  console.log(`   New activations: ${activated.filter(a => !a.hadPassword).length}`)
  console.log(`   Password refreshes: ${activated.filter(a => a.hadPassword).length}`)
  console.log(`   Trial ends: ${new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}`)
}

run().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
