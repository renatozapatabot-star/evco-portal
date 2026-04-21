/**
 * ADUANA VUCEM MV Generator — generates Manifestación de Valor (E2 format).
 * Mandatory compliance by June 1, 2026.
 * Usage: node scripts/vucem-mv-generator.js --trafico=Y3045
 */
const { runJob, supabase } = require('./lib/job-runner');

runJob('vucem-mv-generator', async () => {
  const traficoArg = process.argv.find(a => a.startsWith('--trafico='))?.split('=')[1];
  if (!traficoArg) {
    console.log('Usage: --trafico=TRAFICO_NUMBER');
    return { rowsProcessed: 0 };
  }

  const { data: trafico } = await supabase.from('traficos').select('*').eq('trafico', traficoArg).single();
  if (!trafico) { console.error('Tráfico not found'); return { rowsProcessed: 0 }; }

  const { data: tc } = await supabase.from('system_config').select('value').eq('key', 'exchange_rate').single();
  const exchangeRate = tc?.value?.rate || 17.5;

  const mv = {
    tipo_documento: 'E2',
    aduana_despacho: '240',
    patente: '3596',
    pedimento: trafico.pedimento,
    rfc_importador: trafico.rfc_cliente || '',
    valor_factura_usd: trafico.importe_total || 0,
    tipo_cambio: exchangeRate,
    valor_factura_mxn: (trafico.importe_total || 0) * exchangeRate,
    metodo_valoracion: 1,
    fecha_generacion: new Date().toISOString(),
    generado_por: 'ADUANA AI',
  };

  console.log('[vucem-mv] Generated MV for', traficoArg);
  console.log(JSON.stringify(mv, null, 2));

  await supabase.from('operational_decisions').insert({
    decision_type: 'vucem_mv_generated',
    description: `MV E2 generada para tráfico ${traficoArg}: $${mv.valor_factura_mxn.toFixed(0)} MXN`,
  });

  return { rowsProcessed: 1, metadata: { trafico: traficoArg, valor_mxn: mv.valor_factura_mxn } };
});
