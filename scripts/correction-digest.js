/**
 * ADUANA Correction Digest — weekly summary of human corrections to AI.
 * Run: pm2 start scripts/correction-digest.js --name correction-digest --cron "0 7 * * 1" --no-autorestart
 */
const { runJob, supabase, sendTelegram } = require('./lib/job-runner');

runJob('correction-digest', async () => {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: corrections } = await supabase
    .from('agent_corrections')
    .select('*')
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: false });

  if (!corrections || corrections.length === 0) {
    console.log('[correction-digest] No corrections this week');
    return { rowsProcessed: 0 };
  }

  // Group by pattern
  const patterns = {};
  for (const c of corrections) {
    const key = `${c.original_fraccion} → ${c.corrected_fraccion}`;
    if (!patterns[key]) patterns[key] = { count: 0, desc: c.product_description };
    patterns[key].count++;
  }

  const sorted = Object.entries(patterns).sort(([, a], [, b]) => b.count - a.count);
  const lines = sorted.slice(0, 10).map(([pattern, info]) =>
    `• ${pattern} (${info.count}x) — "${info.desc?.slice(0, 40) || '?'}"`
  );

  const digest = `📊 *ADUANA — Digest de Correcciones*
*Semana: ${new Date(weekAgo).toLocaleDateString('es-MX')} — ${new Date().toLocaleDateString('es-MX')}*

${corrections.length} correcciones humanas esta semana:

${lines.join('\n')}

Estas correcciones mejorarán la precisión del clasificador.`;

  await sendTelegram(digest);
  console.log(`[correction-digest] ${corrections.length} corrections, ${sorted.length} patterns`);
  return { rowsProcessed: corrections.length };
});
