require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const checks = [
    { label: 'evco TOTAL', q: sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'evco') },
    { label: '  cve_cliente=9254 (real)', q: sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'evco').eq('cve_cliente', '9254') },
    { label: '  cve_cliente!=9254 (still contaminated)', q: sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'evco').neq('cve_cliente', '9254') },
    { label: '', q: null },
    { label: 'mafesa', q: sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'mafesa') },
    { label: 'calfer', q: sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'calfer') },
    { label: 'vollrath', q: sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'vollrath') },
    { label: 'maquinaria-pacifico', q: sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'maquinaria-pacifico') },
    { label: 'ferretera-mims', q: sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'ferretera-mims') },
    { label: 'expoimpo', q: sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'expoimpo') },
    { label: '', q: null },
    { label: 'TOTAL DB', q: sb.from('globalpc_productos').select('*', { count: 'exact', head: true }) },
  ];

  console.log('GROUND TRUTH:');
  for (const check of checks) {
    if (!check.q) { console.log(''); continue; }
    const { count } = await check.q;
    console.log('  ' + check.label.padEnd(40) + ' ' + (count || 0).toLocaleString().padStart(10));
  }
  process.exit(0);
})();
