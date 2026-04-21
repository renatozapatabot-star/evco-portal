/**
 * ADUANA Proactive Alerts — checks for problems BEFORE they happen.
 * Run: pm2 start scripts/proactive-alerts.js --name proactive-alerts --cron "*/30 * * * *" --no-autorestart
 */
const { runJob, supabase, sendTelegram } = require('./lib/job-runner');

runJob('proactive-alerts', async () => {
  const alerts = [];

  // 1. Tráficos stuck > 48h without movement
  const twoDaysAgo = new Date(Date.now() - 48 * 3600000).toISOString();
  const { data: stuck } = await supabase
    .from('traficos')
    .select('trafico, company_id, updated_at')
    .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])
    .lt('updated_at', twoDaysAgo)
    .limit(5);

  if (stuck?.length > 0) {
    stuck.forEach(t => {
      const hours = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 3600000);
      alerts.push(`⚠️ Tráfico *${t.trafico}* lleva ${hours}h sin movimiento`);
    });
  }

  // 2. Pending classifications > 20
  const { count: pendingCount } = await supabase
    .from('oca_database')
    .select('*', { count: 'exact', head: true })
    .gte('confidence', 0.65)
    .lt('confidence', 0.85);

  if ((pendingCount || 0) > 20) {
    alerts.push(`📋 ${pendingCount} clasificaciones pendientes de revisión — acumulándose`);
  }

  // 3. Log and send
  if (alerts.length > 0) {
    await sendTelegram(`🔔 *ADUANA — Alertas Proactivas*\n\n${alerts.join('\n\n')}`);

    for (const alert of alerts) {
      await supabase.from('operational_decisions').insert({
        decision_type: 'proactive_alert',
        description: alert.replace(/\*/g, ''),
      });
    }
  }

  console.log(`[proactive-alerts] ${alerts.length} alerts`);
  return { rowsProcessed: alerts.length };
});
