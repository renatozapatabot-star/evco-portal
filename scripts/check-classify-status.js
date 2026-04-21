require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data } = await sb
    .from('workflow_events')
    .select('event_type, status')
    .eq('workflow', 'classify')
    .gte('created_at', new Date(Date.now() - 7200000).toISOString());

  const counts = {};
  (data || []).forEach(e => {
    const k = e.event_type + '/' + e.status;
    counts[k] = (counts[k] || 0) + 1;
  });

  console.log('Classify events status (last 2 hours):');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log('  ' + k + ': ' + v);
  });
  console.log('');
  console.log('Total: ' + (data || []).length);

  process.exit(0);
})();
