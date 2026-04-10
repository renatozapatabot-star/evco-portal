#!/usr/bin/env node
/**
 * CRUZ — Tier classifiable products by AI-classification suitability
 *
 * Tier 1: Has description >= 30 chars AND has prior fracción for same cve_cliente
 * Tier 2: Has description >= 30 chars BUT no prior fracción
 * Tier 3: Description < 30 chars OR null
 *
 * Read-only. Outputs counts per tier per company. No writes.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_COMPANY = process.argv[2] || 'evco';

(async () => {
  console.log('Tiering classifiable products for company: ' + TARGET_COMPANY + '\n');

  // Pull all unclassified products for the target company
  const all = [];
  let from = 0;
  while (true) {
    const r = await sb.from('globalpc_productos')
      .select('id, cve_cliente, cve_proveedor, cve_producto, descripcion')
      .eq('company_id', TARGET_COMPANY)
      .is('fraccion', null)
      .range(from, from + 999);
    if (r.error) { console.error(r.error); process.exit(1); }
    if (!r.data || r.data.length === 0) break;
    all.push(...r.data);
    if (r.data.length < 1000) break;
    from += 1000;
  }

  console.log('Total unclassified for ' + TARGET_COMPANY + ': ' + all.length + '\n');

  // Get the set of cve_cliente values that have ANY prior fracción
  const clienteSet = new Set();
  let from2 = 0;
  while (true) {
    const r = await sb.from('globalpc_productos')
      .select('cve_cliente')
      .eq('company_id', TARGET_COMPANY)
      .not('fraccion', 'is', null)
      .range(from2, from2 + 999);
    if (r.error || !r.data || r.data.length === 0) break;
    r.data.forEach(row => clienteSet.add(row.cve_cliente));
    if (r.data.length < 1000) break;
    from2 += 1000;
  }

  console.log('cve_cliente values with prior classifications: ' + clienteSet.size + '\n');

  // Tier each row
  const tier1 = [];
  const tier2 = [];
  const tier3 = [];

  for (const row of all) {
    const desc = (row.descripcion || '').trim();
    const hasDesc = desc.length >= 30;
    const hasPriors = clienteSet.has(row.cve_cliente);

    if (hasDesc && hasPriors) tier1.push(row);
    else if (hasDesc) tier2.push(row);
    else tier3.push(row);
  }

  console.log('=== TIER BREAKDOWN ===');
  console.log('Tier 1 (desc + priors):    ' + tier1.length + ' rows  · ~80% high-conf expected · $' + (tier1.length * 0.003).toFixed(2));
  console.log('Tier 2 (desc, no priors):  ' + tier2.length + ' rows  · ~50% high-conf expected · $' + (tier2.length * 0.003).toFixed(2));
  console.log('Tier 3 (thin/null desc):   ' + tier3.length + ' rows  · ~20% high-conf expected · $' + (tier3.length * 0.003).toFixed(2));
  console.log('');
  console.log('Total cost if all tiers run: $' + (all.length * 0.003).toFixed(2));
  console.log('Tier 1 only:                 $' + (tier1.length * 0.003).toFixed(2));
  console.log('');
  console.log('=== TIER 1 SAMPLE (first 5) ===');
  tier1.slice(0, 5).forEach(r => {
    console.log('  ' + (r.cve_proveedor || '').padEnd(12) + ' ' + (r.cve_producto || '').slice(0, 30).padEnd(30) + ' | ' + (r.descripcion || '').slice(0, 60));
  });
  console.log('');
  console.log('=== TIER 3 SAMPLE (first 5 — these are the SKUs to defer) ===');
  tier3.slice(0, 5).forEach(r => {
    console.log('  ' + (r.cve_proveedor || '').padEnd(12) + ' ' + (r.cve_producto || '').slice(0, 30).padEnd(30) + ' | ' + ((r.descripcion || '<null>').slice(0, 60)));
  });

  process.exit(0);
})();
