/**
 * ADUANA Watchdog — checks critical jobs have heartbeated within expected cadence.
 * Run: pm2 start scripts/watchdog.js --name watchdog --cron "*/5 * * * *" --no-autorestart
 */
const { runJob, supabase, sendTelegram } = require('./lib/job-runner');

const EXPECTED_CADENCE = {
  'link-orphan-entradas': 30,    // minutes
  'workflow-processor': 5,        // continuous, check last heartbeat
  'globalpc-delta-sync': 20,
  'heartbeat': 20,
  'watchdog': 10,
};

runJob('watchdog', async () => {
  const { data: jobs } = await supabase.rpc('get_job_health');
  if (!jobs || jobs.length === 0) {
    console.log('[watchdog] No job_runs data yet — tables may need migration');
    return { rowsProcessed: 0 };
  }

  let staleCount = 0;
  const alerts = [];

  for (const job of jobs) {
    const expected = EXPECTED_CADENCE[job.job_name];
    if (!expected) continue;

    if (job.minutes_since > expected * 2) {
      staleCount++;
      alerts.push(`⚠️ *${job.job_name}*: último heartbeat hace ${Math.round(job.minutes_since)} min (esperado: cada ${expected} min)`);
    }
    if (job.status === 'failure') {
      staleCount++;
      alerts.push(`🔴 *${job.job_name}*: último estado = failure — ${job.error_message?.slice(0, 100) || 'sin detalle'}`);
    }
  }

  if (alerts.length > 0) {
    await sendTelegram(`🐕 *ADUANA Watchdog*\n\n${alerts.join('\n\n')}`);
  }

  console.log(`[watchdog] Checked ${jobs.length} jobs, ${staleCount} stale/failed`);
  return { rowsProcessed: jobs.length, metadata: { staleCount } };
});
