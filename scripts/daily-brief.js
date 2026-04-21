/**
 * ADUANA Daily Brief — morning summary sent to Telegram at 6:35 AM CT.
 * Run: pm2 start scripts/daily-brief.js --name daily-brief --cron "35 6 * * 1-6" --no-autorestart
 */
const { runJob, supabase, sendTelegram } = require('./lib/job-runner');

runJob('daily-brief', async () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const [classRes, decRes, pendRes, bridgeRes] = await Promise.allSettled([
    supabase.from('oca_database').select('*', { count: 'exact', head: true }).gte('created_at', yesterday),
    supabase.from('operational_decisions').select('*', { count: 'exact', head: true }).gte('created_at', yesterday),
    supabase.from('oca_database').select('*', { count: 'exact', head: true }).gte('confidence', 0.65).lt('confidence', 0.85),
    fetch(process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL || 'https://evco-portal.vercel.app'}/api/bridge-times` : 'http://localhost:3000/api/bridge-times').then(r => r.json()).catch(() => null),
  ]);

  const classified = classRes.status === 'fulfilled' ? (classRes.value.count || 0) : 0;
  const decisions = decRes.status === 'fulfilled' ? (decRes.value.count || 0) : 0;
  const pending = pendRes.status === 'fulfilled' ? (pendRes.value.count || 0) : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  const brief = `☀️ *${greeting}, Lic. Zapata*
*ADUANA — Resumen del día*

📊 *Ayer:*
• ${classified} productos clasificados · $${(classified * 0.004).toFixed(2)} USD
• ${decisions} decisiones operativas

📋 *Hoy requiere tu atención:*
• ${pending} clasificaciones pendientes de revisión

📈 *Tendencia:*
• Clasificaciones AI ahorraron ~${Math.round(classified * 3 / 60)} horas de trabajo manual

— ADUANA AI · Patente 3596 · Aduana 240`;

  await sendTelegram(brief);
  console.log('[daily-brief] Sent');
  return { rowsProcessed: 1, metadata: { classified, pending, decisions } };
});
