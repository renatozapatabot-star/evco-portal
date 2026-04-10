require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const r = await sb
    .from('agent_decisions')
    .select('id, cycle_id, company_id, trigger_id, created_at')
    .eq('trigger_type', 'classification')
    .order('created_at', { ascending: false })
    .limit(30);

  console.log('Last 30 classification rows in agent_decisions:');
  (r.data || []).forEach(row => {
    const isBroken = row.company_id === '9254' || row.company_id === '4598';
    const tag = isBroken ? 'X' : 'OK';
    const cycle = (row.cycle_id || 'null').substring(0, 30);
    console.log('  ' + tag.padEnd(3) + ' id=' + row.id + ' company=' + (row.company_id || 'null').padEnd(8) + ' cycle=' + cycle.padEnd(30) + ' created=' + row.created_at);
  });
  process.exit(0);
})();
