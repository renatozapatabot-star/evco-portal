require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
;(async () => {
  for (const t of ['pedimento_drafts','agent_decisions','operator_actions']) {
    const { data, error } = await sb.from(t).select('*').is('company_id', null).limit(2)
    console.log('\n===', t, error ? error.message : '')
    console.log(JSON.stringify(data?.[0] || null, null, 2))
  }
  // Check pedimentos schema
  const { data: p } = await sb.from('pedimentos').select('*').limit(1)
  console.log('\n=== pedimentos columns:', p?.[0] ? Object.keys(p[0]).join(', ') : 'empty')
})()
