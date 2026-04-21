require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { count: before } = await sb
    .from('workflow_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('event_type', 'entrada_synced');

  console.log('Draining ' + (before || 0).toLocaleString() + ' entrada_synced events...');

  const { error } = await sb
    .from('workflow_events')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('status', 'pending')
    .eq('event_type', 'entrada_synced');

  if (error) {
    console.log('Drain error: ' + error.message);
    process.exit(1);
  }

  const { count: afterTotal } = await sb
    .from('workflow_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: afterClassify } = await sb
    .from('workflow_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('workflow', 'classify');

  console.log('');
  console.log('Total pending after drain:    ' + (afterTotal || 0).toLocaleString());
  console.log('Classify pending after drain: ' + (afterClassify || 0).toLocaleString());

  process.exit(0);
})();
