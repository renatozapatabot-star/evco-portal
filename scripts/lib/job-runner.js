/**
 * ADUANA Job Runner — heartbeat wrapper for all scripts.
 * Writes to job_runs table. Alerts Telegram on failure.
 * Usage: const { runJob, supabase } = require('./lib/job-runner');
 *        runJob('my-job-name', async () => { ... return { rowsProcessed: N }; });
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.RZ_OPS_CHAT_ID || '-5085543275';
  if (!token || process.env.TELEGRAM_SILENT === 'true') return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('[telegram]', e.message);
  }
}

async function runJob(jobName, fn) {
  const startedAt = new Date().toISOString();
  let runId;

  try {
    // Write start heartbeat
    const { data } = await supabase.from('job_runs').insert({
      job_name: jobName, started_at: startedAt, status: 'running',
    }).select('id').single();
    runId = data?.id;

    // Execute the job
    const result = await fn();
    const rowsProcessed = result?.rowsProcessed || 0;
    const metadata = result?.metadata || {};

    // Write success
    await supabase.from('job_runs').update({
      status: 'success', finished_at: new Date().toISOString(),
      rows_processed: rowsProcessed, metadata,
    }).eq('id', runId);

    console.log(`[${jobName}] SUCCESS: ${rowsProcessed} rows processed`);
    return result;
  } catch (error) {
    const errorMsg = error.message || String(error);
    console.error(`[${jobName}] FAILURE:`, errorMsg);

    // Write failure
    if (runId) {
      await supabase.from('job_runs').update({
        status: 'failure', finished_at: new Date().toISOString(),
        error_message: errorMsg.slice(0, 500),
      }).eq('id', runId);
    }

    // Alert Telegram
    await sendTelegram(`🔴 *${jobName}* falló\n\n\`${errorMsg.slice(0, 200)}\``);
    process.exit(1);
  }
}

module.exports = { runJob, supabase, sendTelegram };
