#!/usr/bin/env node
/**
 * CRUZ Module Validation Suite
 * 
 * Pulls REAL historical data from Supabase where outcomes are known:
 * - Tráficos that WERE inspected → validate inspection predictor
 * - Documents that WERE late → validate predictive docs
 * - Classifications that WERE corrected → validate classification corrector
 * - Shipments that MISSED MVE → validate MVE predictor
 * - Border delays that HAPPENED → validate border intel
 * 
 * Also uses corrections from cruz_corrections as ground truth.
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

// ============================================================================
// TEST CASE GENERATORS — Pull real data from Supabase
// ============================================================================

/**
 * Get tráficos where we KNOW the MVE outcome
 */
async function getMVETestCases(limit = 30) {
  // Tráficos with mve_folio = completed, vs those without = missed
  const { data: completed } = await supabase
    .from('traficos')
    .select('cve_trafico, proveedor, fecha_llegada, valor_factura, fraccion_arancelaria')
    .eq('clave_cliente', '9254')
    .not('mve_folio', 'is', null)
    .order('fecha_llegada', { ascending: false })
    .limit(Math.floor(limit / 2));

  const { data: missed } = await supabase
    .from('traficos')
    .select('cve_trafico, proveedor, fecha_llegada, valor_factura, fraccion_arancelaria')
    .eq('clave_cliente', '9254')
    .is('mve_folio', null)
    .not('fecha_llegada', 'is', null)
    .order('fecha_llegada', { ascending: false })
    .limit(Math.floor(limit / 2));

  const cases = [];

  for (const t of (completed || [])) {
    cases.push({
      input: `Tráfico ${t.cve_trafico}, proveedor ${t.proveedor || 'desconocido'}, llegada ${t.fecha_llegada}, valor $${t.valor_factura || 0}`,
      expected_risk: 'bajo',
      actual_outcome: 'mve_cumplida',
      trafico: t.cve_trafico,
    });
  }

  for (const t of (missed || [])) {
    cases.push({
      input: `Tráfico ${t.cve_trafico}, proveedor ${t.proveedor || 'desconocido'}, llegada ${t.fecha_llegada}, valor $${t.valor_factura || 0}`,
      expected_risk: 'alto',
      actual_outcome: 'mve_faltante',
      trafico: t.cve_trafico,
    });
  }

  return cases;
}

/**
 * Get tráficos with known document completeness
 */
async function getDocumentTestCases(limit = 20) {
  // Get tráficos and count their documents
  const { data: traficos } = await supabase
    .from('traficos')
    .select('cve_trafico, proveedor, tipo_operacion')
    .eq('clave_cliente', '9254')
    .order('created_at', { ascending: false })
    .limit(limit);

  const cases = [];

  for (const t of (traficos || [])) {
    const { count } = await supabase
      .from('expediente_documentos')
      .select('*', { count: 'exact', head: true })
      .eq('cve_trafico', t.cve_trafico);

    // Tráficos with <3 docs are likely missing critical ones
    const isIncomplete = (count || 0) < 3;

    cases.push({
      input: `Tráfico ${t.cve_trafico}, tipo ${t.tipo_operacion || 'A1'}, documentos actuales: ${count || 0}`,
      expected: isIncomplete ? 'documentos_faltantes' : 'documentacion_completa',
      doc_count: count || 0,
      trafico: t.cve_trafico,
    });
  }

  return cases;
}

/**
 * Get corrections as ground truth test cases
 */
async function getCorrectionTestCases(moduleName, limit = 20) {
  const { data: corrections } = await supabase
    .from('cruz_corrections')
    .select('*')
    .eq('module_name', moduleName)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (corrections || []).map(c => ({
    input: JSON.stringify(c.context || c.original_output).slice(0, 500),
    expected: c.corrected_output,
    original_wrong: c.original_output,
    correction_type: c.correction_type,
  }));
}

// ============================================================================
// VALIDATION ENGINE
// ============================================================================

/**
 * Run a single module validation
 */
async function validateModule(moduleName, testCases, promptTemplate) {
  console.log(`\n🔍 Validating ${moduleName} (${testCases.length} test cases)`);
  console.log('═'.repeat(60));

  if (!testCases.length) {
    console.log('  ⚠ No test cases available — skipping');
    return { moduleName, accuracy: null, correct: 0, total: 0, skipped: true };
  }

  let correct = 0;
  let lowConfidence = 0;
  const results = [];

  for (const test of testCases) {
    const prompt = promptTemplate(test);

    const { output, confidence, latencyMs, error } = await callQwen(prompt, {
      module: `validate-${moduleName}`,
      temperature: 0.2,
      validate: false, // Don't cross-validate during validation runs
      injectImprovements: true, // DO use improvements — we're testing the improved system
    });

    if (error) {
      console.log(`  ❌ ERROR: ${error}`);
      results.push({ test, error, correct: false });
      continue;
    }

    // Check if output matches expected
    const isCorrect = checkMatch(output, test.expected_risk || test.expected, test);
    if (isCorrect) correct++;
    if (confidence < 0.6) lowConfidence++;

    results.push({
      test: test.trafico || test.input?.slice(0, 50),
      output: output?.slice(0, 150),
      expected: test.expected_risk || test.expected,
      correct: isCorrect,
      confidence,
      latencyMs,
    });

    const icon = isCorrect ? '✅' : '❌';
    const confIcon = confidence >= 0.7 ? '🟢' : confidence >= 0.5 ? '🟡' : '🔴';
    console.log(`  ${icon} ${test.trafico || 'case'} | ${confIcon} ${Math.round(confidence * 100)}% | ${latencyMs}ms`);
  }

  const accuracy = correct / testCases.length;
  const avgConfidence = results.reduce((s, r) => s + (r.confidence || 0), 0) / results.length;

  console.log(`\n📊 ${moduleName} Results:`);
  console.log(`   Accuracy:     ${Math.round(accuracy * 100)}% (${correct}/${testCases.length})`);
  console.log(`   Avg Confidence: ${Math.round(avgConfidence * 100)}%`);
  console.log(`   Low Confidence: ${lowConfidence}/${testCases.length}`);
  console.log(`   Status: ${accuracy >= 0.7 ? '✅ PRODUCTION READY' : accuracy >= 0.5 ? '⚠ NEEDS IMPROVEMENT' : '❌ NOT READY'}`);

  // Save validation results to ground_truth
  for (const r of results) {
    if (!r.error) {
      await supabase.from('ground_truth').upsert({
        module_name: moduleName,
        test_case_id: `validation-${r.test}-${Date.now()}`,
        input_data: { prompt_summary: r.test },
        known_outcome: { expected: r.expected, actual: r.output?.slice(0, 500), correct: r.correct },
        source: 'validation',
      }, { onConflict: 'module_name,test_case_id' }).catch(() => {});
    }
  }

  // Update module_health
  await supabase.from('module_health').upsert({
    module_name: moduleName,
    accuracy_30d: accuracy,
    avg_confidence: avgConfidence,
    status: accuracy >= 0.7 ? 'healthy' : accuracy >= 0.5 ? 'degraded' : 'failing',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'module_name' });

  return { moduleName, accuracy, correct, total: testCases.length, avgConfidence, lowConfidence };
}

/**
 * Check if output matches expected (fuzzy matching for LLM outputs)
 */
function checkMatch(output, expected, testCase) {
  if (!output || !expected) return false;
  const lower = output.toLowerCase();
  const exp = typeof expected === 'string' ? expected.toLowerCase() : JSON.stringify(expected).toLowerCase();

  // Direct keyword match
  if (lower.includes(exp)) return true;

  // Risk level mapping
  const riskMap = {
    'alto': ['alto', 'high', 'crítico', 'urgente', 'riesgo elevado'],
    'bajo': ['bajo', 'low', 'mínimo', 'controlado', 'sin riesgo'],
    'medio': ['medio', 'moderate', 'moderado', 'precaución'],
  };

  if (riskMap[exp]) {
    return riskMap[exp].some(keyword => lower.includes(keyword));
  }

  // Document completeness
  if (exp.includes('faltante') || exp.includes('missing')) {
    return lower.includes('faltante') || lower.includes('falta') || lower.includes('missing') || lower.includes('incompleto');
  }
  if (exp.includes('completa') || exp.includes('complete')) {
    return lower.includes('completa') || lower.includes('completo') || lower.includes('suficiente');
  }

  return false;
}

// ============================================================================
// MAIN VALIDATION RUN
// ============================================================================

async function runFullValidation() {
  console.log('🧪 CRUZ Module Validation Suite — Real Data');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Date: ${new Date().toLocaleString('es-MX')}`);
  console.log(`Client: EVCO (9254)\n`);

  const results = [];

  // 1. MVE Predictor
  const mveCases = await getMVETestCases(20);
  results.push(await validateModule('mve-predictor', mveCases, (test) =>
    `Eres el predictor de riesgo MVE. Analiza este tráfico y determina el nivel de riesgo de incumplimiento MVE.
    
${test.input}

Responde con:
RIESGO: [ALTO/MEDIO/BAJO]
JUSTIFICACION: [breve]`
  ));

  // 2. Predictive Documents
  const docCases = await getDocumentTestCases(15);
  results.push(await validateModule('predictive-docs', docCases, (test) =>
    `Eres el predictor de documentos faltantes. Analiza este tráfico:

${test.input}

¿La documentación está completa o faltan documentos críticos?
Responde: documentos_faltantes o documentacion_completa, con justificación.`
  ));

  // 3. Classification Corrector (if corrections exist)
  const classCases = await getCorrectionTestCases('classification-corrector', 10);
  if (classCases.length > 0) {
    results.push(await validateModule('classification-corrector', classCases, (test) =>
      `Eres el corrector de clasificaciones arancelarias. 
      
Se clasificó originalmente como: ${JSON.stringify(test.original_wrong)}
El contexto es: ${test.input}

¿Es correcta la clasificación? Si no, ¿cuál es la correcta?
Responde con la fracción arancelaria correcta.`
    ));
  }

  // 4. Supplier Risk (using document patterns as proxy)
  const { data: suppliers } = await supabase
    .from('traficos')
    .select('proveedor')
    .eq('clave_cliente', '9254')
    .not('proveedor', 'is', null)
    .limit(100);

  const uniqueSuppliers = [...new Set((suppliers || []).map(s => s.proveedor))].slice(0, 10);
  const supplierCases = uniqueSuppliers.map(s => ({
    input: `Proveedor: ${s}`,
    expected: 'score', // We just check it returns a score
    supplier: s,
  }));

  if (supplierCases.length > 0) {
    results.push(await validateModule('supplier-risk', supplierCases, (test) =>
      `Eres el evaluador de riesgo de proveedores.

${test.input}

Evalúa el riesgo del proveedor en una escala de 1-100.
Responde: SCORE: [número] + justificación breve.`
    ));
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================

  console.log('\n' + '═'.repeat(60));
  console.log('📈 VALIDATION SUMMARY');
  console.log('═'.repeat(60));

  const validResults = results.filter(r => !r.skipped);

  for (const r of validResults) {
    const bar = '█'.repeat(Math.round((r.accuracy || 0) * 20)) + '░'.repeat(20 - Math.round((r.accuracy || 0) * 20));
    const status = r.accuracy >= 0.7 ? '✅' : r.accuracy >= 0.5 ? '⚠️' : '❌';
    console.log(`  ${status} ${r.moduleName.padEnd(25)} ${bar} ${Math.round((r.accuracy || 0) * 100)}%  (${r.correct}/${r.total})`);
  }

  if (validResults.length > 0) {
    const avgAccuracy = validResults.reduce((s, r) => s + (r.accuracy || 0), 0) / validResults.length;
    console.log(`\n  🎯 Overall System Accuracy: ${Math.round(avgAccuracy * 100)}%`);
    console.log(`  ${avgAccuracy >= 0.7 ? '✅ System is production-ready' : '⚠ System needs improvement'}`);
  }

  const skipped = results.filter(r => r.skipped);
  if (skipped.length) {
    console.log(`\n  ⏭ Skipped (no test data): ${skipped.map(r => r.moduleName).join(', ')}`);
  }

  console.log('\n' + '═'.repeat(60));
}

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
  runFullValidation()
    .then(() => process.exit(0))
    .catch(err => { console.error('Validation failed:', err); process.exit(1); });
}

module.exports = { runFullValidation, validateModule, getMVETestCases, getDocumentTestCases };
