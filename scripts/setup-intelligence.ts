import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run(label: string, sql: string) {
  const { error } = await supabase.rpc('exec_sql', { sql_text: sql }).maybeSingle()
  if (error) {
    // Try direct query approach
    const { error: e2 } = await supabase.from('_exec').select('*').limit(0)
    console.log(`  ${label}: RPC not available, will create via migration`)
    return false
  }
  console.log(`  PASS ${label}`)
  return true
}

async function checkTable(name: string): Promise<boolean> {
  const { error } = await supabase.from(name).select('id').limit(0)
  return !error
}

async function main() {
  console.log('Session 1D+2: Database setup\n')

  // Check which tables already exist
  const tables = ['entrada_lifecycle', 'bridge_times', 'alerts', 'deadlines', 'user_feedback']
  const existing: string[] = []
  for (const t of tables) {
    if (await checkTable(t)) existing.push(t)
  }
  console.log(`Existing tables: ${existing.length > 0 ? existing.join(', ') : 'none'}`)
  console.log(`Tables to create: ${tables.filter(t => !existing.includes(t)).join(', ') || 'none'}\n`)

  // Check trafico_actions view
  const { error: viewErr } = await supabase.from('trafico_actions').select('id').limit(0)
  if (!viewErr) {
    console.log('trafico_actions view already exists')
  } else {
    console.log('trafico_actions view needs creation (will create via migration)')
  }

  // Check get_kpi_intelligence function
  const { error: funcErr } = await supabase.rpc('get_kpi_intelligence', { p_company_id: '9254' })
  if (!funcErr) {
    console.log('get_kpi_intelligence function already exists')
  } else {
    console.log('get_kpi_intelligence function needs creation (will create via migration)')
  }

  console.log('\nDone. Create Supabase migration for missing items.')
}

main().catch(e => { console.error(e); process.exit(1) })
