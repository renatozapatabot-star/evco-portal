require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const allStatuses = new Map();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const r = await sb.from('traficos').select('estatus').range(from, from + pageSize - 1);
    if (r.error) { console.log('ERROR: ' + r.error.message); break; }
    if (!r.data || r.data.length === 0) break;
    for (const row of r.data) {
      const s = row.estatus || '(null)';
      allStatuses.set(s, (allStatuses.get(s) || 0) + 1);
    }
    if (r.data.length < pageSize) break;
    from += pageSize;
  }
  
  console.log('All distinct trafico estatus values (with counts):');
  const sorted = [...allStatuses.entries()].sort((a, b) => b[1] - a[1]);
  for (const [status, count] of sorted) {
    console.log('  ' + status.padEnd(40) + count);
  }
  console.log('');
  console.log('Total distinct statuses: ' + allStatuses.size);
  console.log('Total rows scanned: ' + [...allStatuses.values()].reduce((a, b) => a + b, 0));
  
  // Also count entradas
  const { count: entradaCount } = await sb.from('entradas').select('*', { count: 'exact', head: true });
  console.log('');
  console.log('Total entradas: ' + (entradaCount || 0));
  
  process.exit(0);
})();
