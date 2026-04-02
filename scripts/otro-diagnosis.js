require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
  const { data } = await sb
    .from('document_classifications')
    .select('filename, confidence')
    .eq('doc_type', 'OTRO')
    .order('created_at', { ascending: false })
    .limit(500);

  const patterns = {};
  const unknowns = [];
  
  (data || []).forEach(r => {
    const fn = (r.filename || '').toLowerCase();
    if (fn.includes('po ') || fn.includes('po_') || fn.includes('purchase') || fn.includes('orden')) patterns['ORDEN_COMPRA'] = (patterns['ORDEN_COMPRA'] || 0) + 1;
    else if (fn.includes('manif') || fn.includes('mv_') || fn.includes('mve')) patterns['MANIFESTACION_VALOR'] = (patterns['MANIFESTACION_VALOR'] || 0) + 1;
    else if (fn.includes('permiso') || fn.includes('salud') || fn.includes('cofepris')) patterns['PERMISO'] = (patterns['PERMISO'] || 0) + 1;
    else if (fn.includes('nom') || fn.includes('norma')) patterns['NOM'] = (patterns['NOM'] || 0) + 1;
    else if (fn.includes('guia') || fn.includes('tracking') || fn.includes('awb')) patterns['GUIA_EMBARQUE'] = (patterns['GUIA_EMBARQUE'] || 0) + 1;
    else if (fn.includes('factura') || fn.includes('invoice') || fn.includes('inv_') || fn.includes('inv-')) patterns['MISCLASSIFIED_FACTURA'] = (patterns['MISCLASSIFIED_FACTURA'] || 0) + 1;
    else if (fn.includes('packing') || fn.includes('lista') || fn.includes('empaque')) patterns['MISCLASSIFIED_LISTA'] = (patterns['MISCLASSIFIED_LISTA'] || 0) + 1;
    else if (fn.includes('pedimento') || fn.includes('ped_')) patterns['MISCLASSIFIED_PED'] = (patterns['MISCLASSIFIED_PED'] || 0) + 1;
    else if (fn.includes('cove') || fn.includes('vucem')) patterns['MISCLASSIFIED_COVE'] = (patterns['MISCLASSIFIED_COVE'] || 0) + 1;
    else if (fn.includes('cert') || fn.includes('origen') || fn.includes('usmca') || fn.includes('tmec')) patterns['MISCLASSIFIED_CERT'] = (patterns['MISCLASSIFIED_CERT'] || 0) + 1;
    else if (fn.includes('doda') || fn.includes('previo')) patterns['DODA_PREVIO'] = (patterns['DODA_PREVIO'] || 0) + 1;
    else if (fn.includes('test') || fn === '') patterns['TEST_EMPTY'] = (patterns['TEST_EMPTY'] || 0) + 1;
    else {
      patterns['TRULY_UNKNOWN'] = (patterns['TRULY_UNKNOWN'] || 0) + 1;
      if (unknowns.length < 20) unknowns.push(r.filename + ' (conf: ' + r.confidence + ')');
    }
  });

  console.log('=== OTRO BREAKDOWN BY FILENAME (500 sample) ===\n');
  let recoverable = 0;
  Object.entries(patterns).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    const pct = (v/500*100).toFixed(1);
    if (k !== 'TRULY_UNKNOWN' && k !== 'TEST_EMPTY') recoverable += v;
    console.log('  ' + k + ': ' + v + ' (' + pct + '%)');
  });
  console.log('\nRecoverable: ' + recoverable + '/500 = ' + (recoverable/500*100).toFixed(0) + '%');

  const { count: zeroCon } = await sb
    .from('document_classifications')
    .select('*', { count: 'exact', head: true })
    .eq('doc_type', 'OTRO')
    .eq('confidence', 0);
  console.log('\nConfidence=0 (parse failures): ' + zeroCon);

  console.log('\n=== 20 TRULY UNKNOWN FILENAMES ===');
  unknowns.forEach(fn => console.log('  ' + fn));
}

diagnose().catch(e => console.error('Error:', e.message));
