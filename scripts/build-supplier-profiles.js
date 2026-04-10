/**
 * ADUANA Supplier Profiles — builds intelligence from historical data.
 * Usage: node scripts/build-supplier-profiles.js
 */
const { runJob, supabase } = require('./lib/job-runner');

runJob('build-supplier-profiles', async () => {
  const { data: products } = await supabase
    .from('globalpc_productos')
    .select('company_id, cve_proveedor, fraccion, descripcion')
    .not('fraccion', 'is', null)
    .not('cve_proveedor', 'is', null)
    .limit(50000);

  if (!products || products.length === 0) {
    console.log('[supplier-profiles] No classified products found');
    return { rowsProcessed: 0 };
  }

  const profiles = {};
  for (const p of products) {
    const key = `${p.company_id}:${p.cve_proveedor}`;
    if (!profiles[key]) {
      profiles[key] = { company_id: p.company_id, cve_proveedor: p.cve_proveedor, fracciones: {}, count: 0 };
    }
    profiles[key].count++;
    if (p.fraccion) profiles[key].fracciones[p.fraccion] = (profiles[key].fracciones[p.fraccion] || 0) + 1;
  }

  let upserted = 0;
  for (const profile of Object.values(profiles)) {
    const fracciones = Object.entries(profile.fracciones).sort(([, a], [, b]) => b - a);
    const primaryFraccion = fracciones[0]?.[0] || null;

    await supabase.from('supplier_profiles').upsert({
      company_id: profile.company_id,
      cve_proveedor: profile.cve_proveedor,
      primary_fraccion: primaryFraccion,
      all_fracciones: fracciones.map(([f, c]) => ({ fraccion: f, count: c })),
      shipment_count: profile.count,
      confidence: profile.count >= 10 ? 'alta' : profile.count >= 3 ? 'media' : 'baja',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,cve_proveedor' });

    upserted++;
  }

  console.log(`[supplier-profiles] Built ${upserted} profiles from ${products.length} products`);
  return { rowsProcessed: upserted };
});
