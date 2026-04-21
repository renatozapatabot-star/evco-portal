require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: companies } = await sb.from('companies').select('company_id, clave_cliente, globalpc_clave').eq('active', true);
  const claveToCompany = {};
  (companies || []).forEach(c => {
    const k = c.globalpc_clave || c.clave_cliente;
    if (k) claveToCompany[k] = c.company_id;
  });

  console.log('Paginating through all company_id=evco rows...\n');
  
  const counts = {};
  let offset = 0;
  const pageSize = 1000;
  let totalSeen = 0;
  
  while (true) {
    const { data, error } = await sb
      .from('globalpc_productos')
      .select('cve_cliente')
      .eq('company_id', 'evco')
      .range(offset, offset + pageSize - 1);
    
    if (error) { console.error('\nError: ' + error.message); break; }
    if (!data || data.length === 0) break;
    
    data.forEach(r => {
      const cc = r.cve_cliente || 'null';
      counts[cc] = (counts[cc] || 0) + 1;
    });
    
    totalSeen += data.length;
    process.stdout.write('\r  Scanned ' + totalSeen.toLocaleString() + ' rows...');
    
    // Only break if we got LESS than a full page (meaning we hit the end)
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  console.log('\n');
  console.log('FULL DISTRIBUTION of cve_cliente among company_id=evco:\n');
  
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  let realEvco = 0;
  let willMove = 0;
  let orphan = 0;
  const orphanDetails = {};
  
  sorted.forEach(([cve, count]) => {
    if (cve === '9254') {
      console.log('  ' + cve.padEnd(8) + ' ' + count.toLocaleString().padStart(10) + '  -> STAYS as evco (real EVCO)');
      realEvco = count;
    } else if (claveToCompany[cve]) {
      console.log('  ' + cve.padEnd(8) + ' ' + count.toLocaleString().padStart(10) + '  -> ' + claveToCompany[cve]);
      willMove += count;
    } else {
      console.log('  ' + cve.padEnd(8) + ' ' + count.toLocaleString().padStart(10) + '  -> ORPHAN (no active company)');
      orphan += count;
      orphanDetails[cve] = count;
    }
  });
  
  console.log('\n  SUMMARY:');
  console.log('  Total scanned:                        ' + totalSeen.toLocaleString());
  console.log('  Real EVCO (cve_cliente=9254):         ' + realEvco.toLocaleString());
  console.log('  Will move to other companies:         ' + willMove.toLocaleString());
  console.log('  Orphans:                              ' + orphan.toLocaleString());
  console.log('  Distinct cve_cliente values:          ' + sorted.length);
  
  process.exit(0);
})();
