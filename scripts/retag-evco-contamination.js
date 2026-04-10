require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RETAG_MAP = [
  { cve: '1760', company: 'calfer',                expected: 44068 },
  { cve: '6460', company: 'maquinaria-pacifico',   expected: 42663 },
  { cve: '3020', company: 'ferretera-mims',        expected: 37999 },
  { cve: '4170', company: 'expoimpo',              expected: 37364 },
  { cve: '9089', company: 'vollrath',              expected: 20723 },
  { cve: '9393', company: 'dist-parra',            expected: 7135 },
  { cve: '2481', company: 'cmae',                  expected: 6898 },
  { cve: '2108', company: 'cable-proveedora',      expected: 6628 },
  { cve: '3187', company: 'embajada1',             expected: 6184 },
  { cve: '1934', company: 'grupo-pelayo',          expected: 5692 },
  { cve: '3186', company: 'embajada2',             expected: 5442 },
  { cve: '4598', company: 'mafesa',                expected: 5406 },
  { cve: '4181', company: 'equipos-dd',            expected: 5237 },
  { cve: '3185', company: 'embajada3',             expected: 5040 },
  { cve: '8399', company: 'stempro',               expected: 5011 },
  { cve: '7557', company: 'promotora-mexicana',    expected: 2588 },
  { cve: '3838', company: 'sercom',                expected: 2031 },
  { cve: '8102', company: 'maniphor',              expected: 1981 },
  { cve: '9144', company: 'yates',                 expected: 1796 },
  { cve: '7759', company: 'preciomex',             expected: 1782 },
  { cve: '5081', company: 'gostech',               expected: 1772 },
  { cve: '9085', company: 'bekaert',               expected: 1757 },
  { cve: '8503', company: 'tork-electro',          expected: 1422 },
  { cve: '4899', company: 'galia-textil',          expected: 1299 },
  { cve: '0101', company: 'g-traders',             expected: 973 },
  { cve: '5343', company: 'hilos-iris',            expected: 501 },
  { cve: '0627', company: 'pti-dos',               expected: 470 },
  { cve: '7110', company: 'papeles-bolsas',        expected: 461 },
  { cve: '7331', company: 'plasticos-villagar',    expected: 453 },
  { cve: '5967', company: 'aceros-termicos',       expected: 393 },
  { cve: '5155', company: 'grupo-requena',         expected: 316 },
  { cve: '9042', company: 'whitehall',             expected: 316 },
  { cve: '4180', company: 'camisas-manchester',    expected: 309 },
  { cve: '3360', company: 'cinetica',              expected: 298 },
  { cve: '3323', company: 'empaques-litograficos', expected: 287 },
  { cve: '9045', company: 'worldtech',             expected: 285 },
  { cve: '3066', company: 'instrumentos-medicos',  expected: 169 },
  { cve: '0626', company: 'pti-qcs',               expected: 153 },
  { cve: '1648', company: 'becomar',               expected: 148 },
  { cve: '7324', company: 'plasticos-ing',         expected: 130 },
  { cve: '7316', company: 'mercatrup',             expected: 126 },
  { cve: '8225', company: 'ts-san-pedro',          expected: 121 },
  { cve: '1519', company: 'beumer',                expected: 120 },
  { cve: '3576', company: 'lvm-nucleo',            expected: 94 },
  { cve: '5913', company: 'castores',              expected: 37 },
  { cve: '1787', company: 'alimentos-san-fabian',  expected: 34 },
  { cve: '4275', company: 'faurecia',              expected: 23 },
  { cve: '8704', company: 'tracusa',               expected: 5 },
];

const CHUNK_SIZE = 1000;

async function retagOne(cve, company, expected, idx, total) {
  const label = '[' + (idx + 1).toString().padStart(2) + '/' + total + '] ' + cve.padEnd(6) + ' -> ' + company.padEnd(25) + ' (expect ' + expected.toLocaleString().padStart(6) + ')';
  
  let totalMoved = 0;
  let chunkNum = 0;
  
  while (true) {
    // Fetch IDs of next chunk to update
    const { data: ids, error: selErr } = await sb
      .from('globalpc_productos')
      .select('id')
      .eq('company_id', 'evco')
      .eq('cve_cliente', cve)
      .limit(CHUNK_SIZE);
    
    if (selErr) {
      console.log(label + ' ... SELECT ERROR: ' + selErr.message);
      return { moved: totalMoved, error: true };
    }
    
    if (!ids || ids.length === 0) break;
    
    chunkNum++;
    const chunkIds = ids.map(r => r.id);
    
    const { error: updErr } = await sb
      .from('globalpc_productos')
      .update({ company_id: company })
      .in('id', chunkIds);
    
    if (updErr) {
      console.log(label + ' ... UPDATE ERROR on chunk ' + chunkNum + ': ' + updErr.message);
      return { moved: totalMoved, error: true };
    }
    
    totalMoved += ids.length;
    process.stdout.write('\r' + label + ' ... chunk ' + chunkNum + ', moved ' + totalMoved.toLocaleString() + '/' + expected.toLocaleString());
    
    // Last chunk
    if (ids.length < CHUNK_SIZE) break;
  }
  
  const match = totalMoved === expected ? '✓' : '~';
  console.log('\r' + label + ' ... ' + match + ' moved ' + totalMoved.toLocaleString() + ' in ' + chunkNum + ' chunks                    ');
  return { moved: totalMoved, error: false };
}

(async () => {
  const start = Date.now();
  console.log('=== RETAG EVCO CONTAMINATION (chunked) ===');
  console.log('Total expected: ' + RETAG_MAP.reduce((s, r) => s + r.expected, 0).toLocaleString());
  console.log('Chunk size:     ' + CHUNK_SIZE);
  console.log('');

  let totalMoved = 0;
  let errors = 0;

  for (let i = 0; i < RETAG_MAP.length; i++) {
    const { cve, company, expected } = RETAG_MAP[i];
    const result = await retagOne(cve, company, expected, i, RETAG_MAP.length);
    totalMoved += result.moved;
    if (result.error) errors++;
  }

  const elapsed = Math.round((Date.now() - start) / 1000);
  console.log('');
  console.log('=== DONE ===');
  console.log('Total moved: ' + totalMoved.toLocaleString());
  console.log('Errors:      ' + errors);
  console.log('Elapsed:     ' + elapsed + 's');

  const { count: evcoFinal } = await sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'evco');
  const { count: evcoStillBad } = await sb.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('company_id', 'evco').neq('cve_cliente', '9254');
  console.log('');
  console.log('EVCO after retag:    ' + (evcoFinal || 0).toLocaleString() + ' (target: 148,537)');
  console.log('EVCO contamination:  ' + (evcoStillBad || 0).toLocaleString() + ' (target: 0)');

  process.exit(errors > 0 ? 1 : 0);
})();
