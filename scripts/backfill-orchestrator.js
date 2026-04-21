/**
 * ADUANA Backfill Orchestrator — classification backfill for any client.
 * Usage: node scripts/backfill-orchestrator.js --client=bekaert
 *        node scripts/backfill-orchestrator.js --all-top-20
 * DO NOT run --all-top-20 without Tito approval.
 */
const { runJob, supabase } = require('./lib/job-runner');
const { spawn } = require('child_process');
const path = require('path');

const BATCH_SIZE = 100;
const PAUSE_MS = 5000;
const MAX_COST_PER_CLIENT = 5.00;
const COST_PER_ROW = 0.004;

runJob('backfill-orchestrator', async () => {
  const targetClient = process.argv.find(a => a.startsWith('--client='))?.split('=')[1];
  const runAll = process.argv.includes('--all-top-20');

  let clients = [];
  if (targetClient) {
    clients = [targetClient];
  } else if (runAll) {
    const { data } = await supabase.from('traficos').select('company_id').limit(5000);
    const counts = {};
    (data || []).forEach(t => { counts[t.company_id] = (counts[t.company_id] || 0) + 1; });
    clients = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 20).map(([id]) => id);
  } else {
    console.log('Usage: --client=NAME or --all-top-20');
    return { rowsProcessed: 0 };
  }

  let total = 0;
  for (const client of clients) {
    const { count } = await supabase.from('globalpc_productos')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', client).is('fraccion', null).not('descripcion', 'is', null);

    if (!count || count === 0) { console.log(`  ${client}: 0 classifiable, skip`); continue; }
    const maxRows = Math.min(count, Math.floor(MAX_COST_PER_CLIENT / COST_PER_ROW));
    console.log(`  ${client}: ${count} classifiable, processing up to ${maxRows}`);

    let done = 0;
    while (done < maxRows) {
      const limit = Math.min(BATCH_SIZE, maxRows - done);
      await new Promise((resolve, reject) => {
        const child = spawn('node', [
          path.join(__dirname, 'auto-classifier.js'), '--batch',
          `--limit=${limit}`, `--cve-cliente=${client}`, '--tier=1',
        ], { cwd: path.dirname(__dirname), stdio: 'inherit' });
        child.on('close', code => code === 0 ? resolve() : reject(new Error(`Exit ${code}`)));
      });
      done += limit;
      total += limit;
      await new Promise(r => setTimeout(r, PAUSE_MS));
    }
  }
  return { rowsProcessed: total, metadata: { clients: clients.length } };
});
