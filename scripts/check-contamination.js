require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: companies } = await sb.from('companies').select('company_id, clave_cliente, globalpc_clave').eq('active', true);
  const claveToCompany = {};
  (companies || []).forEach(c => {
    const k = c.globalpc_clave || c.clave_cliente;
    if (k) claveToCompany[k] = c.company_id;
  });
  console.log('Active company mapping (clave -> company_id):');
  Object.entries(claveToCompany).forEach(([k, v]) => console.log('  ' + k + ' -> ' + v));
  console.log('');

  const { data: cveInEvco } = await sb.from('globalpc_productos').select('cve_cliente').eq('company_id', 'evco').limit(5000);
  const counts = {};
  (cveInEvco || []).forEach(r => {
    counts[r.cve_cliente || 'null'] = (counts[r.cve_cliente || 'null'] || 0) + 1;
  });
  console.log('cve_cliente distribution among company_id=evco (sample 5000):');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    const label = k === '9254' ? ' <- REAL EVCO' : ' <- CONTAMINATION';
    console.log('  cve_cliente=' + k.padEnd(8) + ': ' + v + label);
  });

  process.exit(0);
})();
