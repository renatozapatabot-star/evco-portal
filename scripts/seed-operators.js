#!/usr/bin/env node
/**
 * Seed the operators table with known CRUZ team members.
 * Run once after the Block 11A migration is applied:
 *   node scripts/seed-operators.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SEED_OPERATORS = [
  {
    email: 'renato@renatozapata.com',
    full_name: 'Renato Zapata IV',
    role: 'admin',
    company_id: 'internal',
  },
  // Uncomment when confirmed:
  // {
  //   email: 'eloisa@renatozapata.com',
  //   full_name: 'Eloisa Banda',
  //   role: 'operator',
  //   company_id: 'evco',
  // },
]

;(async () => {
  console.log('Seeding operators table...')

  // List all auth users
  const { data: { users }, error: usersErr } = await sb.auth.admin.listUsers()
  if (usersErr) {
    console.error('listUsers failed:', usersErr.message)
    process.exit(1)
  }
  console.log(`Found ${users.length} auth users`)

  for (const seed of SEED_OPERATORS) {
    const authUser = users.find(u => u.email === seed.email)
    if (!authUser) {
      console.log(`SKIP ${seed.email} — no matching auth user`)
      continue
    }

    const { error } = await sb.from('operators').upsert({
      auth_user_id: authUser.id,
      email: seed.email,
      full_name: seed.full_name,
      role: seed.role,
      company_id: seed.company_id,
      active: true,
    }, { onConflict: 'auth_user_id' })

    if (error) {
      console.error(`FAIL ${seed.email}: ${error.message}`)
    } else {
      console.log(`SEEDED ${seed.email} (${seed.role}) auth_user_id=${authUser.id}`)
    }
  }

  // Verify
  const { data: ops } = await sb.from('operators').select('email, full_name, role, company_id')
  console.log('\nOperators table:', JSON.stringify(ops, null, 2))

  process.exit(0)
})()
