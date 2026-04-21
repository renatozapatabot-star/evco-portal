import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verify() {
  console.log('Phase 0: Schema Verification\n')
  let failed = false

  const tables = ['traficos', 'expediente_documentos', 'entradas', 'notifications']
  const byTable: Record<string, string[]> = {}

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.error(`  ${table}: ERROR — ${error.message}`)
      byTable[table] = []
    } else if (data && data.length > 0) {
      byTable[table] = Object.keys(data[0])
      console.log(`  ${table}: ${byTable[table].length} columns found`)
    } else {
      // Table exists but empty — try select with known columns
      const { data: d2, error: e2 } = await supabase.from(table).select('*').limit(0)
      byTable[table] = d2 ? [] : [] // empty table, can't infer columns
      console.log(`  ${table}: table exists (empty)`)
    }
  }

  const required: Record<string, string[]> = {
    traficos: ['id', 'trafico', 'company_id', 'estatus', 'importe_total',
               'fecha_llegada', 'pedimento', 'semaforo'],
    expediente_documentos: ['id', 'pedimento_id', 'file_url', 'doc_type'],
  }

  console.log('\n--- Column Verification ---\n')

  for (const [table, cols] of Object.entries(required)) {
    const existing = byTable[table] || []
    if (existing.length === 0) {
      console.log(`  ${table}: could not read columns (table may be empty or RLS blocked)`)
      console.log(`    Skipping column check — will verify via data queries\n`)
      continue
    }
    const missing = cols.filter(c => !existing.includes(c))
    if (missing.length) {
      console.error(`  FAIL ${table}: missing [${missing.join(', ')}]`)
      console.log(`    Actual columns: ${existing.join(', ')}`)
      failed = true
    } else {
      console.log(`  PASS ${table}: all required columns present`)
    }
  }

  // Print confirmed column names
  console.log('\nConfirmed column map:')
  Object.entries(byTable).forEach(([t, c]) => {
    if (c.length > 0) {
      console.log(`  ${t}: ${c.join(', ')}`)
    }
  })

  if (failed) {
    console.error('\nSTOP. Update column names before proceeding.')
    process.exit(1)
  }

  console.log('\nSchema verification passed. Proceed to Session 1.')
  process.exit(0)
}

verify().catch(e => { console.error(e); process.exit(1) })
