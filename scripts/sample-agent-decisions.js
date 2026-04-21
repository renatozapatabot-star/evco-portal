require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const r = await sb
    .from('agent_decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (r.error) {
    console.log('Error: ' + r.error.message);
  } else if (!r.data || r.data.length === 0) {
    console.log('No rows returned despite count=493');
  } else {
    console.log('3 most recent agent_decisions:');
    console.log(JSON.stringify(r.data, null, 2));
  }

  process.exit(0);
})();
