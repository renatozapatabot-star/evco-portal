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

  const companyIds = [...new Set(Object.values(claveToCompany))].sort();
  console.log('Auditing ' + companyIds.length + ' active company_ids for contamination...\n');

  for (const cid of companyIds) {
    const { count: total } = await sb
      .from('globalpc_productos')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', cid);
    
    if (!total || total === 0) {
      console.log(cid.padEnd(30) + ' total=      0');
      continue;
    }

    const { data: sample } = await sb
      .from('globalpc_productos')
      .select('cve_cliente')
      .eq('company_id', cid)
      .limit(1000);

    const counts = {};
    (sample || []).forEach(r => {
      counts[r.cve_cliente || 'null'] = (counts[r.cve_cliente || 'null'] || 0) + 1;
    });

    // Figure out what cve_cliente SHOULD be for this company
    const expectedClave = Object.entries(claveToCompany).find(([k, v]) => v === cid)?.[0] || '?';
    const correctCount = counts[expectedClave] || 0;
    const sampleSize = sample?.length || 0;
    const correctPct = sampleSize > 0 ? Math.round((correctCount / sampleSize) * 100) : 0;
    
    const flag = correctPct >= 95 ? '✓' : correctPct >= 50 ? '~' : '✗';
    
    console.log(
      cid.padEnd(30) +
      ' total=' + total.toLocaleString().padStart(8) +
      '  expected_clave=' + expectedClave.padEnd(5) +
      '  correct_in_sample=' + correctCount + '/' + sampleSize +
      '  ' + flag + ' ' + correctPct + '%'
    );
  }

  // Also check for orphans (rows whose cve_cliente doesn't match ANY active company)
  console.log('\nChecking for orphan rows (cve_cliente not in active companies)...');
  const activeClaves = Object.keys(claveToCompany);
  const { data: allCves } = await sb
    .from('globalpc_productos')
    .select('cve_cliente')
    .limit(10000);
  const orphans = {};
  (allCves || []).forEach(r => {
    const cc = r.cve_cliente;
    if (cc && !activeClaves.includes(cc)) {
      orphans[cc] = (orphans[cc] || 0) + 1;
    }
  });
  const orphanEntries = Object.entries(orphans).sort((a, b) => b[1] - a[1]);
  if (orphanEntries.length === 0) {
    console.log('  No orphans found in sample of 10000');
  } else {
    console.log('  Top orphan cve_cliente values (not in active companies):');
    orphanEntries.slice(0, 15).forEach(([k, v]) => console.log('    ' + k + ': ' + v));
  }

  process.exit(0);
})();
