#!/usr/bin/env node
/**
 * CRUZ Correlation Engine
 * 
 * A shipment that's individually normal but comes from:
 * - A supplier whose risk score just dropped
 * - On a route where inspection rates spiked this week
 * - With a fracción that got reclassified last month
 * 
 * ...THAT combination is the signal. Individual modules miss it.
 * This catches it.
 * 
 * Runs after daily-intelligence (3:30 AM)
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

const { callQwen } = require('../core/qwen-client-v2');
const { emitEvent } = require('../core/event-bus');

// ============================================================================
// RISK DIMENSION COLLECTORS
// ============================================================================

/**
 * Get active tráficos with their risk dimensions
 */
async function getActiveTraficos() {
  const { data } = await supabase
    .from('traficos')
    .select(`
      cve_trafico, proveedor, fraccion_arancelaria, 
      valor_factura, tipo_operacion, fecha_llegada,
      mve_folio, estatus
    `)
    .eq('clave_cliente', '9254')
    .in('estatus', ['en_transito', 'en_aduana', 'pendiente', 'activo'])
    .order('fecha_llegada', { ascending: false })
    .limit(50);

  return data || [];
}

/**
 * Get recent module outputs that indicate elevated risk
 */
async function getRecentRiskSignals() {
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data } = await supabase
    .from('module_executions')
    .select('module_name, input_summary, output_data, confidence')
    .in('module_name', ['mve-predictor', 'supplier-risk', 'inspector-analyzer', 'anomaly-detector', 'border-intel'])
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false });

  return data || [];
}

/**
 * Get recent corrections (indicates system uncertainty)
 */
async function getRecentCorrections() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data } = await supabase
    .from('cruz_corrections')
    .select('module_name, correction_type, context')
    .gte('created_at', weekAgo);

  return data || [];
}

/**
 * Get document completeness per tráfico
 */
async function getDocumentCompleteness(traficos) {
  const results = {};
  for (const t of traficos.slice(0, 20)) {
    const { count } = await supabase
      .from('expediente_documentos')
      .select('*', { count: 'exact', head: true })
      .eq('cve_trafico', t.cve_trafico);
    results[t.cve_trafico] = count || 0;
  }
  return results;
}

// ============================================================================
// CORRELATION LOGIC
// ============================================================================

/**
 * Score a tráfico across multiple risk dimensions
 */
function calculateMultiFactorRisk(trafico, riskSignals, corrections, docCount) {
  let score = 0;
  const factors = [];

  // Factor 1: MVE status
  if (!trafico.mve_folio) {
    score += 25;
    factors.push({ dimension: 'MVE', risk: 'Sin folio MVE', weight: 25 });
  }

  // Factor 2: Document completeness
  const docs = docCount[trafico.cve_trafico] || 0;
  if (docs < 3) {
    score += 20;
    factors.push({ dimension: 'Documentos', risk: `Solo ${docs} documentos`, weight: 20 });
  }

  // Factor 3: Supplier mentioned in recent risk signals
  const supplierSignals = riskSignals.filter(s =>
    s.input_summary?.includes(trafico.proveedor) && s.module_name === 'supplier-risk'
  );
  if (supplierSignals.length > 0) {
    const avgConf = supplierSignals.reduce((s, sig) => s + (sig.confidence || 0), 0) / supplierSignals.length;
    if (avgConf < 0.6) {
      score += 15;
      factors.push({ dimension: 'Proveedor', risk: `${trafico.proveedor} tiene señales de riesgo`, weight: 15 });
    }
  }

  // Factor 4: Fracción recently corrected
  const fractionCorrections = corrections.filter(c =>
    c.correction_type === 'classification' &&
    c.context?.fraccion === trafico.fraccion_arancelaria
  );
  if (fractionCorrections.length > 0) {
    score += 20;
    factors.push({ dimension: 'Clasificación', risk: `Fracción ${trafico.fraccion_arancelaria} corregida recientemente`, weight: 20 });
  }

  // Factor 5: High-value shipment (more scrutiny)
  if (trafico.valor_factura > 50000) {
    score += 10;
    factors.push({ dimension: 'Valor', risk: `Alto valor: $${trafico.valor_factura} USD`, weight: 10 });
  }

  // Factor 6: Inspection signals
  const inspectionSignals = riskSignals.filter(s =>
    s.module_name === 'inspector-analyzer' &&
    s.output_data?.text?.toLowerCase().includes('alto')
  );
  if (inspectionSignals.length > 0) {
    score += 15;
    factors.push({ dimension: 'Inspección', risk: 'Riesgo de inspección elevado esta semana', weight: 15 });
  }

  // Factor 7: Border delays
  const borderSignals = riskSignals.filter(s => s.module_name === 'border-intel');
  if (borderSignals.some(s => s.output_data?.text?.toLowerCase().includes('retraso'))) {
    score += 10;
    factors.push({ dimension: 'Frontera', risk: 'Retrasos reportados en cruces', weight: 10 });
  }

  return { score: Math.min(score, 100), factors };
}

// ============================================================================
// MAIN CORRELATION RUN
// ============================================================================

async function runCorrelationAnalysis() {
  console.log('🔗 CRUZ Correlation Engine');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Date: ${new Date().toLocaleString('es-MX')}\n`);

  // Gather all data
  console.log('📊 Gathering risk dimensions...');
  const [traficos, riskSignals, corrections] = await Promise.all([
    getActiveTraficos(),
    getRecentRiskSignals(),
    getRecentCorrections(),
  ]);

  const docCounts = await getDocumentCompleteness(traficos);

  console.log(`  Tráficos activos: ${traficos.length}`);
  console.log(`  Risk signals (24h): ${riskSignals.length}`);
  console.log(`  Corrections (7d): ${corrections.length}\n`);

  if (!traficos.length) {
    console.log('  No active tráficos to analyze.');
    return;
  }

  // Score each tráfico
  const scored = traficos.map(t => {
    const { score, factors } = calculateMultiFactorRisk(t, riskSignals, corrections, docCounts);
    return { ...t, riskScore: score, factors };
  });

  // Sort by risk score descending
  scored.sort((a, b) => b.riskScore - a.riskScore);

  // High-risk tráficos (score >= 40 means 2+ risk dimensions)
  const highRisk = scored.filter(s => s.riskScore >= 40);
  const medRisk = scored.filter(s => s.riskScore >= 20 && s.riskScore < 40);

  console.log('CORRELATION RESULTS');
  console.log('─'.repeat(70));

  if (highRisk.length) {
    console.log(`\n🔴 HIGH RISK (${highRisk.length} tráficos — multi-factor):\n`);
    for (const t of highRisk) {
      console.log(`  ${t.cve_trafico} — Score: ${t.riskScore}/100`);
      for (const f of t.factors) {
        console.log(`    ├ ${f.dimension}: ${f.risk}`);
      }
      console.log();
    }
  }

  if (medRisk.length) {
    console.log(`\n🟡 MODERATE RISK (${medRisk.length} tráficos):\n`);
    for (const t of medRisk.slice(0, 10)) {
      console.log(`  ${t.cve_trafico} — Score: ${t.riskScore}/100 — ${t.factors.map(f => f.dimension).join(', ')}`);
    }
  }

  // For high-risk: get Qwen analysis + emit events
  if (highRisk.length > 0) {
    console.log('\n📡 Generating AI analysis for high-risk tráficos...\n');

    for (const t of highRisk.slice(0, 5)) { // Max 5 to avoid overloading
      const { output, confidence } = await callQwen(
        `Eres el analista de correlación de CRUZ. Un tráfico tiene múltiples factores de riesgo simultáneos:

Tráfico: ${t.cve_trafico}
Proveedor: ${t.proveedor}
Fracción: ${t.fraccion_arancelaria}
Valor: $${t.valor_factura} USD
Score de riesgo: ${t.riskScore}/100

Factores detectados:
${t.factors.map(f => `- ${f.dimension}: ${f.risk}`).join('\n')}

Genera:
1. ANÁLISIS: Por qué esta combinación es peligrosa (2-3 oraciones)
2. ACCIÓN INMEDIATA: Qué hacer AHORA (1 oración)
3. ACCIÓN PREVENTIVA: Qué hacer para evitar esto en el futuro (1 oración)`,
        { module: 'correlation-engine', temperature: 0.2, validate: true }
      );

      // Save alert
      await supabase.from('correlation_alerts').insert({
        alert_type: 'multi_factor_risk',
        risk_score: t.riskScore / 100,
        contributing_modules: t.factors.map(f => f.dimension),
        contributing_factors: t.factors,
        trafico_clave: t.cve_trafico,
        recommendation: output,
      });

      // Emit risk event
      await emitEvent('risk_alert', 'correlation-engine', {
        trafico: t.cve_trafico,
        risk_score: t.riskScore,
        factors: t.factors,
        analysis: output,
        clave_cliente: '9254',
        details: { correlation_risk: true, factor_count: t.factors.length },
      }, t.riskScore >= 60 ? 2 : 1);

      console.log(`  ✅ ${t.cve_trafico}: Alert saved + events emitted (confidence: ${Math.round(confidence * 100)}%)`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log(`  Total analyzed: ${scored.length}`);
  console.log(`  🔴 High risk: ${highRisk.length}`);
  console.log(`  🟡 Moderate: ${medRisk.length}`);
  console.log(`  🟢 Low risk: ${scored.filter(s => s.riskScore < 20).length}`);
  console.log('═'.repeat(70));
}

if (require.main === module) {
  runCorrelationAnalysis()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { runCorrelationAnalysis };
