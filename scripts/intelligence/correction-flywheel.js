#!/usr/bin/env node
/**
 * CRUZ Correction Flywheel — The Learning Loop
 * 
 * The loop:
 * 1. Human corrects a module output (Tito, Ursula, Renato)
 * 2. recordCorrection() saves it + emits 'correction_made' event
 * 3. Event bus triggers meta-learner to generate a prompt improvement rule
 * 4. Rule saved to prompt_improvements (active=true)
 * 5. Next time that module runs, qwen-client-v2 injects the rule into the prompt
 * 6. Module output is (hopefully) better
 * 7. If same correction type stops appearing → rule is working
 * 8. nightly audit checks rule effectiveness and deactivates bad ones
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

const { emitEvent } = require('./event-bus');
const { callQwen } = require('./qwen-client-v2');

// ============================================================================
// RECORD A CORRECTION
// ============================================================================

/**
 * Record a human correction and trigger the learning loop
 * 
 * @param {string} moduleName - Which module produced wrong output
 * @param {Object} original - What the module said
 * @param {Object} corrected - What the human says it should be
 * @param {string} correctionType - 'classification', 'risk_level', 'recommendation', 'data_error'
 * @param {string} correctedBy - 'tito', 'ursula', 'renato'
 * @param {Object} context - Additional context (tráfico, fracción, etc.)
 * @returns {Object} The saved correction
 */
async function recordCorrection(moduleName, original, corrected, correctionType, correctedBy = 'renato', context = {}) {
  // 1. Save the correction
  const { data: correction, error } = await supabase
    .from('cruz_corrections')
    .insert({
      module_name: moduleName,
      original_output: typeof original === 'string' ? { text: original } : original,
      corrected_output: typeof corrected === 'string' ? { text: corrected } : corrected,
      correction_type: correctionType,
      corrected_by: correctedBy,
      context,
      applied_to_prompt: false,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to save correction:', error.message);
    throw error;
  }

  console.log(`📝 Correction recorded: ${moduleName} by ${correctedBy} (${correctionType})`);

  // 2. Also save as ground truth for future validation
  await supabase.from('ground_truth').upsert({
    module_name: moduleName,
    test_case_id: `correction-${correction.id}`,
    input_data: context,
    known_outcome: typeof corrected === 'string' ? { text: corrected } : corrected,
    source: 'correction',
    clave_trafico: context.trafico || null,
  }, { onConflict: 'module_name,test_case_id' });

  // 3. Emit event to trigger meta-learner via event bus
  await emitEvent('correction_made', 'correction-flywheel', {
    module_name: moduleName,
    original,
    corrected,
    correction_type: correctionType,
    context,
  });

  return correction;
}

// ============================================================================
// NIGHTLY IMPROVEMENT GENERATOR (runs at 3:15 AM after daily intelligence)
// ============================================================================

/**
 * Process all unapplied corrections and generate prompt improvements
 * This is the backup — normally the event bus handles this in real-time
 */
async function processUnappliedCorrections() {
  const { data: corrections } = await supabase
    .from('cruz_corrections')
    .select('*')
    .eq('applied_to_prompt', false)
    .order('created_at', { ascending: true });

  if (!corrections?.length) {
    console.log('✅ No unapplied corrections');
    return 0;
  }

  console.log(`📚 Processing ${corrections.length} unapplied corrections...\n`);

  // Group by module for batch processing
  const byModule = {};
  for (const c of corrections) {
    if (!byModule[c.module_name]) byModule[c.module_name] = [];
    byModule[c.module_name].push(c);
  }

  let generated = 0;

  for (const [moduleName, moduleCorrections] of Object.entries(byModule)) {
    console.log(`\n🔧 ${moduleName}: ${moduleCorrections.length} corrections`);

    // If multiple corrections of the same type, generate one consolidated rule
    const byType = {};
    for (const c of moduleCorrections) {
      if (!byType[c.correction_type]) byType[c.correction_type] = [];
      byType[c.correction_type].push(c);
    }

    for (const [type, typedCorrections] of Object.entries(byType)) {
      const examples = typedCorrections.slice(0, 5).map((c, i) =>
        `Ejemplo ${i + 1}: Original="${JSON.stringify(c.original_output).slice(0, 200)}" → Correcto="${JSON.stringify(c.corrected_output).slice(0, 200)}"`
      ).join('\n');

      const { output } = await callQwen(
        `Eres el sistema de mejora continua de CRUZ. Analiza estas ${typedCorrections.length} correcciones humanas del módulo "${moduleName}" (tipo: ${type}):

${examples}

Genera UNA regla consolidada que prevenga TODOS estos errores.
La regla debe ser:
- Específica al tipo de error "${type}"
- Aplicable como instrucción directa al módulo
- En español
- Máximo 3 oraciones

Responde SOLO con la regla, sin preámbulo.`,
        { module: 'correction-flywheel', temperature: 0.2, injectImprovements: false }
      );

      if (output) {
        // Check for duplicate rules
        const { data: existing } = await supabase
          .from('prompt_improvements')
          .select('improvement_text')
          .eq('module_name', moduleName)
          .eq('active', true);

        const isDuplicate = existing?.some(e =>
          e.improvement_text.toLowerCase().includes(output.slice(0, 50).toLowerCase())
        );

        if (!isDuplicate) {
          await supabase.from('prompt_improvements').insert({
            module_name: moduleName,
            improvement_text: output.trim(),
            based_on_correction_id: typedCorrections[0].id,
            priority: typedCorrections.length, // More corrections = higher priority
            active: true,
          });
          generated++;
          console.log(`  ✅ Rule generated (priority ${typedCorrections.length}): ${output.trim().slice(0, 80)}...`);
        } else {
          console.log(`  ⏭ Duplicate rule skipped`);
        }
      }

      // Mark corrections as applied
      const ids = typedCorrections.map(c => c.id);
      await supabase
        .from('cruz_corrections')
        .update({ applied_to_prompt: true })
        .in('id', ids);
    }
  }

  console.log(`\n📊 Generated ${generated} new prompt improvements`);
  return generated;
}

// ============================================================================
// NIGHTLY RULE EFFECTIVENESS AUDIT
// ============================================================================

/**
 * Check if existing rules are working
 * Deactivate rules that aren't reducing errors
 */
async function auditRuleEffectiveness() {
  console.log('\n🔍 Auditing rule effectiveness...\n');

  const { data: rules } = await supabase
    .from('prompt_improvements')
    .select('*')
    .eq('active', true);

  if (!rules?.length) {
    console.log('No active rules to audit');
    return;
  }

  for (const rule of rules) {
    // Count corrections for this module AFTER the rule was created
    const { count: correctionsAfter } = await supabase
      .from('cruz_corrections')
      .select('*', { count: 'exact', head: true })
      .eq('module_name', rule.module_name)
      .gte('created_at', rule.created_at);

    // Count corrections BEFORE the rule (same window length)
    const ruleAge = Date.now() - new Date(rule.created_at).getTime();
    const beforeDate = new Date(new Date(rule.created_at).getTime() - ruleAge).toISOString();
    const { count: correctionsBefore } = await supabase
      .from('cruz_corrections')
      .select('*', { count: 'exact', head: true })
      .eq('module_name', rule.module_name)
      .gte('created_at', beforeDate)
      .lt('created_at', rule.created_at);

    const improved = (correctionsAfter || 0) < (correctionsBefore || 0);
    const stale = rule.applied_count === 0 && ruleAge > 7 * 24 * 3600 * 1000; // Never used in 7 days

    if (stale) {
      // Deactivate stale rules
      await supabase.from('prompt_improvements').update({ active: false }).eq('id', rule.id);
      console.log(`  🗑 Deactivated stale rule for ${rule.module_name}: "${rule.improvement_text.slice(0, 60)}..."`);
    } else {
      const status = improved ? '✅ Effective' : '⚠ Monitoring';
      console.log(`  ${status} ${rule.module_name}: ${correctionsBefore || 0} → ${correctionsAfter || 0} corrections`);
    }
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'process':
      processUnappliedCorrections().then(n => {
        console.log(`\nDone. Generated ${n} improvements.`);
        process.exit(0);
      }).catch(err => { console.error(err); process.exit(1); });
      break;

    case 'audit':
      auditRuleEffectiveness().then(() => {
        process.exit(0);
      }).catch(err => { console.error(err); process.exit(1); });
      break;

    case 'test':
      // Test with a sample correction
      recordCorrection(
        'classification-corrector',
        { fraccion: '3926.90.99', description: 'Plastic parts' },
        { fraccion: '8480.71.00', description: 'Injection mold for plastics' },
        'classification',
        'renato',
        { trafico: '9254-Y4466', reason: 'Es un molde, no una parte plástica' }
      ).then(result => {
        console.log('\nTest correction recorded:', result.id);
        process.exit(0);
      }).catch(err => { console.error(err); process.exit(1); });
      break;

    default:
      console.log(`
CRUZ Correction Flywheel

Usage:
  node correction-flywheel.js process   Process unapplied corrections
  node correction-flywheel.js audit     Audit rule effectiveness
  node correction-flywheel.js test      Record a test correction
      `);
      process.exit(0);
  }
}

module.exports = { recordCorrection, processUnappliedCorrections, auditRuleEffectiveness };
