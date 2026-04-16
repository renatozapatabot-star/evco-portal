#!/usr/bin/env node
/**
 * apply-parts-rls.js — idempotent applier for 20260417_parts_rls.sql
 *
 * Tries two paths:
 *   1) Supabase exec_sql RPC (if the repo has added it)
 *   2) Fall back to printing the SQL so Renato pastes into the
 *      Supabase SQL editor
 *
 * Safe to re-run: every statement is IF EXISTS / IF NOT EXISTS / DROP...
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20260417_parts_rls.sql'), 'utf8')

;(async () => {
  console.log('🔒 Applying parts RLS migration…')
  const { data, error } = await supabase.rpc('exec_sql', { sql })
  if (error) {
    console.log('\n[exec_sql unavailable] ' + error.message)
    console.log('\n--- Apply manually via Supabase SQL editor: ---\n')
    console.log(sql)
    console.log('\n--- After applying, run: node scripts/parts-data-inventory.js ---')
    console.log('The inventory should show "anon blocked" on all 4 tables.')
    process.exit(2)
  }
  console.log('✓ applied:', JSON.stringify(data).slice(0, 200))
})().catch((err) => { console.error(err); process.exit(1) })
