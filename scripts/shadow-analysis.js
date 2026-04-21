require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const sb = require('@supabase/supabase-js').createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await sb.from('shadow_emails').select('account, workflow_stage, action_type, trafico_ref, sender, received_at').order('received_at');
  const skip = ['IMPO','PED','PEDIMENTO','null'];
  const byRef = {};
  data.filter(d => d.trafico_ref && skip.indexOf(d.trafico_ref) === -1)
    .forEach(d => { byRef[d.trafico_ref] = byRef[d.trafico_ref] || []; byRef[d.trafico_ref].push({ stage: d.workflow_stage, action: d.action_type, account: d.account }); });
  console.log('Refs:', Object.keys(byRef).length, 'Emails:', Object.values(byRef).flat().length);
  const transitions = {};
  Object.values(byRef).forEach(emails => {
    for (let i = 1; i < emails.length; i++) {
      const key = emails[i-1].stage + ' > ' + emails[i].stage;
      transitions[key] = (transitions[key] || 0) + 1;
    }
  });
  console.log('\nTransitions:');
  Object.entries(transitions).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k.padEnd(35) + v));
  const senders = {};
  data.filter(d => d.workflow_stage !== 'other').forEach(d => {
    const s = (d.sender || '').replace(/<.*>/, '').trim().slice(0, 40);
    senders[s] = (senders[s] || 0) + 1;
  });
  console.log('\nTop senders:');
  Object.entries(senders).sort((a,b) => b[1]-a[1]).slice(0, 8).forEach(([k,v]) => console.log('  ' + k.padEnd(42) + v));
  process.exit(0);
})();
