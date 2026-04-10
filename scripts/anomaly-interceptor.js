/**
 * ADUANA Anomaly Interceptor — flags deviations from supplier patterns.
 * Run: pm2 start scripts/anomaly-interceptor.js --name anomaly-interceptor --cron "*/30 * * * *" --no-autorestart
 */
const { runJob, supabase, sendTelegram } = require('./lib/job-runner');

runJob('anomaly-interceptor', async () => {
  // Get active tráficos with products
  const { data: active } = await supabase
    .from('traficos')
    .select('trafico, company_id, importe_total, peso_bruto')
    .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])
    .limit(100);

  if (!active || active.length === 0) {
    console.log('[anomaly] No active tráficos');
    return { rowsProcessed: 0 };
  }

  let flagged = 0;
  const alerts = [];

  for (const t of active) {
    // Check value/weight ratio against company average
    if (t.importe_total && t.peso_bruto && t.peso_bruto > 0) {
      const ratio = t.importe_total / t.peso_bruto;

      const { data: avg } = await supabase
        .from('traficos')
        .select('importe_total, peso_bruto')
        .eq('company_id', t.company_id)
        .not('importe_total', 'is', null)
        .not('peso_bruto', 'is', null)
        .gt('peso_bruto', 0)
        .limit(100);

      if (avg && avg.length >= 5) {
        const avgRatio = avg.reduce((s, x) => s + (x.importe_total / x.peso_bruto), 0) / avg.length;
        const deviation = Math.abs(ratio - avgRatio) / avgRatio;

        if (deviation > 1.0) { // >100% deviation
          flagged++;
          const msg = `Valor/peso atípico en ${t.trafico}: ratio ${ratio.toFixed(1)} vs promedio ${avgRatio.toFixed(1)}`;
          alerts.push(msg);

          await supabase.from('operational_decisions').insert({
            decision_type: 'anomaly_flag',
            description: msg,
            trafico_id: t.trafico,
          });
        }
      }
    }
  }

  if (alerts.length > 0) {
    await sendTelegram(`🔍 *ADUANA Anomaly Interceptor*\n\n${alerts.slice(0, 5).join('\n')}`);
  }

  console.log(`[anomaly] Checked ${active.length} tráficos, flagged ${flagged}`);
  return { rowsProcessed: active.length, metadata: { flagged } };
});
