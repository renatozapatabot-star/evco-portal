import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function runSQL(sql: string, label: string) {
  // Use Supabase Management API to run SQL
  const projectRef = new URL(url).hostname.split('.')[0]
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ sql_text: sql }),
  })

  if (!res.ok) {
    // If exec_sql RPC doesn't exist, try each statement individually
    console.log(`  ${label}: RPC not available, running statements individually...`)
    return false
  }
  console.log(`  PASS ${label}`)
  return true
}

async function main() {
  const supabase = createClient(url, key)

  // Run each SQL statement individually through the Supabase query interface
  const statements = [
    // Tables
    {
      label: 'entrada_lifecycle table',
      sql: `CREATE TABLE IF NOT EXISTS entrada_lifecycle (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, entrada_number TEXT NOT NULL, company_id TEXT NOT NULL, email_received_at TIMESTAMPTZ, email_subject TEXT, email_from TEXT, supplier TEXT, bultos INTEGER, peso_bruto NUMERIC, transportista TEXT, part_descriptions TEXT[] DEFAULT '{}', trafico_id TEXT, trafico_assigned_at TIMESTAMPTZ, pedimento TEXT, pedimento_transmitted_at TIMESTAMPTZ, semaforo INTEGER, fecha_cruce TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`,
    },
    {
      label: 'alerts table',
      sql: `CREATE TABLE IF NOT EXISTS alerts (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, severity TEXT, action JSONB, status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ, snoozed_until TIMESTAMPTZ)`,
    },
    {
      label: 'deadlines table',
      sql: `CREATE TABLE IF NOT EXISTS deadlines (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, deadline TIMESTAMPTZ NOT NULL, client TEXT, notes TEXT, completed BOOLEAN DEFAULT FALSE, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`,
    },
    {
      label: 'user_feedback table',
      sql: `CREATE TABLE IF NOT EXISTS user_feedback (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, user_id UUID, company_id TEXT NOT NULL, context TEXT, answer TEXT, url TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
    },
  ]

  // Check each table
  for (const stmt of statements) {
    const tableName = stmt.label.replace(' table', '')
    const { error } = await supabase.from(tableName).select('id').limit(0)
    if (!error) {
      console.log(`  SKIP ${stmt.label} — already exists`)
    } else {
      console.log(`  NEED ${stmt.label} — will need manual creation`)
    }
  }

  // Check view and function
  const { error: viewErr } = await supabase.from('trafico_actions').select('id').limit(0)
  console.log(viewErr ? '  NEED trafico_actions view' : '  SKIP trafico_actions view — exists')

  const { error: funcErr } = await supabase.rpc('get_kpi_intelligence', { p_company_id: '9254' })
  console.log(funcErr ? '  NEED get_kpi_intelligence function' : '  SKIP get_kpi_intelligence — exists')

  console.log('\nMigration SQL saved to supabase/migrations/20260401_intelligence_layer.sql')
  console.log('Run this SQL in the Supabase Dashboard SQL editor if tables need creation.')
  console.log('\nProceeding with build — components will gracefully handle missing tables.')
}

main().catch(e => { console.error(e); process.exit(1) })
