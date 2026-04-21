#!/usr/bin/env node
/**
 * CRUZ Telegram Command Center
 * 
 * Compound commands that turn Tito's phone into a CRUZ terminal.
 * Each command orchestrates multiple modules and returns a single answer.
 * 
 * Commands:
 *   /estado [tráfico]    — Full status of a tráfico
 *   /riesgo [tráfico]    — Combined risk profile (MVE + inspection + docs)
 *   /semana              — Weekly summary for EVCO
 *   /compare [b1] [b2]   — Compare two bridges
 *   /mve                 — MVE compliance dashboard
 *   /buscar [query]      — Search tráficos/docs
 *   /salud               — System health summary
 *   /corregir [mod] [original] → [corrected]  — Record correction
 * 
 * Integration: Add these handlers to your existing cruz-bot PM2 process.
 * 
 * Patente 3596 · Aduana 240
 */

const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { callQwen } = require('./qwen-client-v2');
const { recordCorrection } = require('./correction-flywheel');

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

/**
 * /estado 9254-Y4466 — Full tráfico status
 */
async function handleEstado(params) {
  const trafico = params.trim();
  if (!trafico) return '❓ Uso: /estado [clave_trafico]\nEjemplo: /estado 9254-Y4466';

  const { data: t } = await supabase
    .from('traficos')
    .select('*')
    .eq('cve_trafico', trafico)
    .single();

  if (!t) return `❌ Tráfico "${trafico}" no encontrado`;

  // Get document count
  const { count: docCount } = await supabase
    .from('expediente_documentos')
    .select('*', { count: 'exact', head: true })
    .eq('cve_trafico', trafico);

  // Get entradas count
  const { count: entradaCount } = await supabase
    .from('entradas')
    .select('*', { count: 'exact', head: true })
    .eq('cve_trafico', trafico);

  const mveStatus = t.mve_folio ? '✅ Cumplida' : '⚠️ Pendiente';

  return `📦 <b>${trafico}</b>

<b>Proveedor:</b> ${t.proveedor || '—'}
<b>Fracción:</b> ${t.fraccion_arancelaria || '—'}
<b>Tipo:</b> ${t.tipo_operacion || '—'}
<b>Valor:</b> $${(t.valor_factura || 0).toLocaleString()} USD
<b>Llegada:</b> ${t.fecha_llegada ? new Date(t.fecha_llegada).toLocaleDateString('es-MX') : '—'}
<b>Estatus:</b> ${t.estatus || '—'}

<b>MVE:</b> ${mveStatus}
<b>Documentos:</b> ${docCount || 0}
<b>Entradas:</b> ${entradaCount || 0}`;
}

/**
 * /riesgo 9254-Y4466 — Combined risk from multiple modules
 */
async function handleRiesgo(params) {
  const trafico = params.trim();
  if (!trafico) return '❓ Uso: /riesgo [clave_trafico]';

  const { data: t } = await supabase
    .from('traficos')
    .select('*')
    .eq('cve_trafico', trafico)
    .single();

  if (!t) return `❌ Tráfico "${trafico}" no encontrado`;

  // Run through three risk modules in parallel
  const [mveResult, docsResult, inspResult] = await Promise.all([
    callQwen(
      `Evalúa riesgo MVE para: tráfico ${trafico}, proveedor ${t.proveedor}, valor $${t.valor_factura}, folio MVE: ${t.mve_folio || 'NINGUNO'}. Responde: RIESGO: ALTO/MEDIO/BAJO + 1 oración.`,
      { module: 'mve-predictor', temperature: 0.2 }
    ),
    callQwen(
      `Evalúa riesgo documental para: tráfico ${trafico}, tipo ${t.tipo_operacion}. ¿Qué documentos críticos podrían faltar? Responde: RIESGO: ALTO/MEDIO/BAJO + 1 oración.`,
      { module: 'predictive-docs', temperature: 0.2 }
    ),
    callQwen(
      `Evalúa riesgo de inspección para: tráfico ${trafico}, fracción ${t.fraccion_arancelaria}, valor $${t.valor_factura}. Responde: RIESGO: ALTO/MEDIO/BAJO + 1 oración.`,
      { module: 'inspector-analyzer', temperature: 0.2 }
    ),
  ]);

  function extractRisk(output) {
    const match = output?.match(/RIESGO:\s*(ALTO|MEDIO|BAJO)/i);
    return match ? match[1] : 'DESCONOCIDO';
  }

  const mveRisk = extractRisk(mveResult.output);
  const docsRisk = extractRisk(docsResult.output);
  const inspRisk = extractRisk(inspResult.output);

  const riskIcon = (r) => r === 'ALTO' ? '🔴' : r === 'MEDIO' ? '🟡' : r === 'BAJO' ? '🟢' : '⚪';

  return `📊 <b>Riesgo Combinado: ${trafico}</b>

${riskIcon(mveRisk)} <b>MVE:</b> ${mveRisk}
${riskIcon(docsRisk)} <b>Documentos:</b> ${docsRisk}
${riskIcon(inspRisk)} <b>Inspección:</b> ${inspRisk}

<b>Confianza:</b> MVE ${Math.round(mveResult.confidence * 100)}% | Docs ${Math.round(docsResult.confidence * 100)}% | Insp ${Math.round(inspResult.confidence * 100)}%

${mveResult.needsReview || docsResult.needsReview || inspResult.needsReview ? '⚠️ Baja confianza en uno o más análisis — revisar manualmente' : ''}`;
}

/**
 * /semana — Weekly summary
 */
async function handleSemana() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [traficos, mve, corrections, alerts] = await Promise.all([
    supabase.from('traficos').select('*', { count: 'exact', head: true }).eq('clave_cliente', '9254').gte('created_at', weekAgo),
    supabase.from('traficos').select('*', { count: 'exact', head: true }).eq('clave_cliente', '9254').is('mve_folio', null).gte('created_at', weekAgo),
    supabase.from('cruz_corrections').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabase.from('correlation_alerts').select('*', { count: 'exact', head: true }).eq('acknowledged', false).gte('created_at', weekAgo),
  ]);

  const total = traficos.count || 0;
  const mveFalta = mve.count || 0;
  const mveRate = total > 0 ? Math.round(((total - mveFalta) / total) * 100) : 100;

  return `📋 <b>Resumen Semanal EVCO</b>
${new Date(Date.now() - 7 * 24 * 3600 * 1000).toLocaleDateString('es-MX')} — ${new Date().toLocaleDateString('es-MX')}

📦 Tráficos: <b>${total}</b>
📊 MVE Cumplimiento: <b>${mveRate}%</b> (${mveFalta} pendientes)
🔧 Correcciones: <b>${corrections.count || 0}</b>
⚠️ Alertas abiertas: <b>${alerts.count || 0}</b>

${mveFalta > 0 ? `💰 Multa potencial MVE: $${(mveFalta * 5990).toLocaleString()} MXN` : '✅ Sin multas MVE pendientes'}`;
}

/**
 * /compare WTC Colombia — Compare two bridges
 */
async function handleCompare(params) {
  const parts = params.trim().split(/\s+/);
  if (parts.length < 2) return '❓ Uso: /compare [puente1] [puente2]\nEjemplo: /compare WTC Colombia';

  const [b1, b2] = parts;

  const { output, confidence } = await callQwen(
    `Compara estos dos puentes fronterizos en Laredo para cruce comercial:
- Puente 1: ${b1}
- Puente 2: ${b2}

Considerando condiciones actuales (es ${new Date().toLocaleString('es-MX', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}):
1. ¿Cuál recomiendas AHORA?
2. Tiempo estimado de cada uno
3. ¿Hay ventana óptima en las próximas 2 horas?

Responde breve (máximo 100 palabras).`,
    { module: 'trade-lane-optimizer', temperature: 0.3 }
  );

  return `🌉 <b>${b1} vs ${b2}</b>\n\n${output}\n\n<i>Confianza: ${Math.round(confidence * 100)}%</i>`;
}

/**
 * /mve — MVE compliance dashboard
 */
async function handleMVE() {
  const { data: pending } = await supabase
    .from('traficos')
    .select('cve_trafico, proveedor, fecha_llegada, valor_factura')
    .eq('clave_cliente', '9254')
    .is('mve_folio', null)
    .not('fecha_llegada', 'is', null)
    .order('fecha_llegada', { ascending: true })
    .limit(10);

  if (!pending?.length) return '✅ Sin MVE pendientes. Todo en cumplimiento.';

  const lines = pending.map((t, i) =>
    `${i + 1}. <b>${t.cve_trafico}</b> — ${t.proveedor || '?'} — $${(t.valor_factura || 0).toLocaleString()}`
  );

  return `⚠️ <b>MVE Pendientes (${pending.length})</b>

${lines.join('\n')}

💰 Multa potencial: <b>$${(pending.length * 5990).toLocaleString()} MXN</b>
📅 Fecha límite formato E2: 31 marzo 2026`;
}

/**
 * /buscar [query] — Search tráficos
 */
async function handleBuscar(params) {
  const query = params.trim();
  if (!query) return '❓ Uso: /buscar [proveedor, tráfico, o fracción]';

  const { data } = await supabase
    .from('traficos')
    .select('cve_trafico, proveedor, fraccion_arancelaria, valor_factura, estatus')
    .eq('clave_cliente', '9254')
    .or(`cve_trafico.ilike.%${query}%,proveedor.ilike.%${query}%,fraccion_arancelaria.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!data?.length) return `🔍 Sin resultados para "${query}"`;

  const lines = data.map(t =>
    `• <b>${t.cve_trafico}</b> — ${t.proveedor || '?'} — ${t.fraccion_arancelaria || '?'} — $${(t.valor_factura || 0).toLocaleString()} — ${t.estatus || '?'}`
  );

  return `🔍 <b>Resultados: "${query}"</b>\n\n${lines.join('\n')}`;
}

/**
 * /salud — System health summary
 */
async function handleSalud() {
  const { data: health } = await supabase
    .from('module_health')
    .select('module_name, status, avg_confidence, last_execution')
    .order('status', { ascending: true });

  if (!health?.length) return '⚠️ Sin datos de salud. Ejecuta module-health.js primero.';

  const counts = { healthy: 0, degraded: 0, failing: 0, dormant: 0 };
  for (const h of health) counts[h.status] = (counts[h.status] || 0) + 1;

  const icon = { healthy: '🟢', degraded: '🟡', failing: '🔴', dormant: '💤' };

  // Show problematic modules
  const problems = health.filter(h => h.status !== 'healthy').slice(0, 5);
  const problemLines = problems.map(h =>
    `${icon[h.status] || '⚪'} ${h.module_name}: ${h.status} (${h.avg_confidence ? Math.round(h.avg_confidence * 100) + '%' : '—'})`
  );

  return `🏥 <b>Salud del Sistema CRUZ</b>

🟢 Sanos: <b>${counts.healthy}</b>
🟡 Degradados: <b>${counts.degraded}</b>
🔴 Fallando: <b>${counts.failing}</b>
💤 Dormidos: <b>${counts.dormant}</b>

${problemLines.length ? '<b>Atención:</b>\n' + problemLines.join('\n') : '✅ Todos los módulos operando normalmente'}`;
}

/**
 * /corregir mve-predictor alto → bajo — Record correction via Telegram
 */
async function handleCorregir(params, correctedBy = 'tito') {
  // Format: module_name original → corrected
  const match = params.match(/^(\S+)\s+(.+?)\s*[→>]\s*(.+)$/);
  if (!match) return '❓ Uso: /corregir [modulo] [original] → [correcto]\nEjemplo: /corregir mve-predictor alto → bajo';

  const [, moduleName, original, corrected] = match;

  try {
    await recordCorrection(
      moduleName,
      { text: original.trim() },
      { text: corrected.trim() },
      'telegram_correction',
      correctedBy,
      { source: 'telegram' }
    );

    return `✅ Corrección registrada para <b>${moduleName}</b>\n\n"${original.trim()}" → "${corrected.trim()}"

El sistema aprenderá de esta corrección en el próximo ciclo.`;
  } catch (err) {
    return `❌ Error al registrar corrección: ${err.message}`;
  }
}

// ============================================================================
// COMMAND ROUTER
// ============================================================================

/**
 * Route a Telegram command to the right handler
 * 
 * @param {string} command - The command (e.g., '/estado')
 * @param {string} params - Everything after the command
 * @param {string} userId - Who sent it
 * @returns {string} Response message (HTML formatted)
 */
async function routeCommand(command, params = '', userId = 'tito') {
  const handlers = {
    '/estado': handleEstado,
    '/riesgo': handleRiesgo,
    '/semana': handleSemana,
    '/compare': handleCompare,
    '/comparar': handleCompare,
    '/mve': handleMVE,
    '/buscar': handleBuscar,
    '/salud': handleSalud,
    '/corregir': (p) => handleCorregir(p, userId),
    '/help': async () => `🤖 <b>CRUZ Commands</b>

/estado [tráfico] — Estado completo
/riesgo [tráfico] — Perfil de riesgo
/semana — Resumen semanal
/compare [p1] [p2] — Comparar puentes
/mve — Dashboard MVE
/buscar [query] — Buscar tráficos
/salud — Salud del sistema
/corregir [mod] [orig] → [correcto]
/help — Esta ayuda`,
  };

  const handler = handlers[command.toLowerCase()];
  if (!handler) return `❓ Comando no reconocido: ${command}\nEscribe /help para ver comandos disponibles.`;

  try {
    return await handler(params);
  } catch (err) {
    console.error(`Command error [${command}]:`, err);
    return `❌ Error procesando ${command}: ${err.message}`;
  }
}

// ============================================================================
// CLI TEST MODE
// ============================================================================

if (require.main === module) {
  const [, , cmd, ...args] = process.argv;
  if (!cmd) {
    console.log('Usage: node telegram-commands.js /command [params]');
    console.log('Example: node telegram-commands.js /semana');
    process.exit(0);
  }

  routeCommand(cmd, args.join(' ')).then(response => {
    // Strip HTML for console output
    console.log(response.replace(/<\/?[^>]+>/g, ''));
    process.exit(0);
  }).catch(err => { console.error(err); process.exit(1); });
}

module.exports = { routeCommand };
