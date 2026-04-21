#!/usr/bin/env node
/**
 * TEMP: V1 readiness audit — list realtime publication membership.
 * Tries multiple strategies (RPC → pg_publication_tables view → error).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

;(async () => {
  // Strategy 1: Call a known helper RPC, if one exists.
  const candidates = [
    ['exec_sql', "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename"],
    ['list_realtime_tables', null],
    ['pg_publication_tables_json', null],
  ]

  for (const [fn, sql] of candidates) {
    const { data, error } = await supabase.rpc(fn, sql ? { sql } : {})
    if (!error) {
      console.log(`# via rpc.${fn}`)
      console.log(JSON.stringify(data, null, 2))
      process.exit(0)
    }
  }

  // Strategy 2: REST on information_schema / pg_publication_tables (rare, usually blocked)
  const { data: pub, error: pubErr } = await supabase
    .from('pg_publication_tables')
    .select('*')
    .eq('pubname', 'supabase_realtime')
  if (!pubErr) {
    console.log('# via REST view')
    console.log(JSON.stringify(pub, null, 2))
    process.exit(0)
  }

  // Strategy 3: Poll for common tables and report which emit changes — too slow.
  console.error('All strategies failed. Need manual query.')
  console.error('REST error:', pubErr?.message)
  process.exit(2)
})()
