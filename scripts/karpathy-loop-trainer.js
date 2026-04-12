#!/usr/bin/env node
/**
 * V2-B: Karpathy Loop Trainer
 * Reads operator_actions + agent_decisions + globalpc_productos
 * Identifies repeatable patterns and proposes automation rules
 * Run: node scripts/karpathy-loop-trainer.js [--dry-run]
 * Cron: 30 3 * * * (3:30 AM daily, after karpathy-loop at 3 AM)
 */

const { runJob, supabase, sendTelegram } = require('./lib/job-runner');

const MAX_PROPOSALS_PER_RUN = 10;
const MIN_PATTERN_COUNT = 3;
const MIN_CONFIDENCE = 0.85;
const DRY_RUN = process.argv.includes('--dry-run');

// =====================================================================
// P1: Classification Consistency (globalpc_productos — 748K rows)
// Find supplier+product combos consistently mapped to the same fraccion.
// Uses Postgres RPC for efficient GROUP BY.
// VIABILITY: HIGH
// =====================================================================

async function analyzeClassificationConsistency() {
  const { data, error } = await supabase.rpc('find_classification_patterns', {
    p_min_count: MIN_PATTERN_COUNT,
    p_min_consistency: MIN_CONFIDENCE,
    p_max_results: MAX_PROPOSALS_PER_RUN,
  });

  if (error) {
    console.error('[P1] RPC error:', error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  return data.map(row => ({
    pattern_type: 'classification_consistency',
    pattern_key: `${row.cve_proveedor}::${(row.descripcion || '').slice(0, 80)}->${row.fraccion}`,
    company_id: null,
    proposal: {
      rule: 'auto_classify',
      cve_proveedor: row.cve_proveedor,
      descripcion: row.descripcion,
      fraccion: row.fraccion,
      consistency: parseFloat(row.consistency),
      total_count: parseInt(row.total_count),
      fraccion_count: parseInt(row.fraccion_count),
    },
    confidence: parseFloat(row.consistency),
    evidence_count: parseInt(row.total_count),
    evidence_sample: (row.sample_ids || []).map(id => ({ globalpc_productos_id: id })),
  }));
}

// =====================================================================
// P2: Agent Decision Patterns (agent_decisions — 946+ rows)
// Group by workflow + decision. Propose auto-execute when same workflow
// always yields same decision at high confidence.
// Confidence capped at 0.95 — no human feedback available yet.
// VIABILITY: MEDIUM
// =====================================================================

async function analyzeAgentDecisionPatterns() {
  const { data: decisions, error } = await supabase
    .from('agent_decisions')
    .select('workflow, decision, confidence, action_taken')
    .not('workflow', 'is', null)
    .not('decision', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    console.error('[P2] Query error:', error.message);
    return [];
  }
  if (!decisions || decisions.length === 0) return [];

  const groups = {};
  for (const d of decisions) {
    const key = `${d.workflow}::${d.decision}`;
    if (!groups[key]) groups[key] = { workflow: d.workflow, decision: d.decision, items: [] };
    groups[key].items.push(d);
  }

  const proposals = [];
  for (const [key, group] of Object.entries(groups)) {
    if (group.items.length < MIN_PATTERN_COUNT) continue;

    const validConf = group.items.filter(i => i.confidence != null);
    if (validConf.length === 0) continue;
    const avgConf = validConf.reduce((s, i) => s + parseFloat(i.confidence), 0) / validConf.length;
    // Normalize: agent_decisions stores confidence as 0-100, we need 0-1
    const normalizedConf = avgConf > 1 ? avgConf / 100 : avgConf;

    if (normalizedConf < MIN_CONFIDENCE) continue;

    const actions = new Set(group.items.map(i => i.action_taken).filter(Boolean));
    if (actions.size > 1) continue;

    proposals.push({
      pattern_type: 'agent_auto_execute',
      pattern_key: key,
      company_id: null,
      proposal: {
        rule: 'auto_execute_decision',
        workflow: group.workflow,
        decision: group.decision,
        action_taken: group.items[0].action_taken,
        avg_confidence: normalizedConf,
        instance_count: group.items.length,
        note: 'No human feedback available (was_correct always null). Pattern based on consistency only.',
      },
      confidence: Math.min(normalizedConf, 0.95),
      evidence_count: group.items.length,
      evidence_sample: group.items.slice(0, 5).map(i => ({
        workflow: i.workflow,
        decision: i.decision,
        confidence: i.confidence,
        action_taken: i.action_taken,
      })),
    });
  }
  return proposals;
}

// =====================================================================
// P3: Escalation Patterns (operator_actions — thin data)
// Filters out noise (view_cockpit, login). Groups by action_type.
// Skeleton pattern — activates when data accumulates.
// VIABILITY: LOW
// =====================================================================

const NOISE_ACTIONS = ['view_cockpit', 'login', 'operator_login', 'view_page', 'karpathy_trainer_run'];

async function analyzeEscalationPatterns() {
  const { data: actions, error } = await supabase
    .from('operator_actions')
    .select('action_type, target_table, target_id, company_id, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('[P3] Query error:', error.message);
    return [];
  }
  if (!actions || actions.length === 0) return [];

  const filtered = actions.filter(a => !NOISE_ACTIONS.includes(a.action_type));
  if (filtered.length < MIN_PATTERN_COUNT) return [];

  const groups = {};
  for (const a of filtered) {
    if (!groups[a.action_type]) groups[a.action_type] = [];
    groups[a.action_type].push(a);
  }

  const proposals = [];
  for (const [actionType, items] of Object.entries(groups)) {
    if (items.length < MIN_PATTERN_COUNT) continue;

    const payloadKeys = items
      .map(i => i.payload ? Object.keys(i.payload).sort().join(',') : '')
      .filter(Boolean);
    const keyFreq = {};
    for (const k of payloadKeys) keyFreq[k] = (keyFreq[k] || 0) + 1;
    const topEntry = Object.entries(keyFreq).sort(([, a], [, b]) => b - a)[0];
    const consistency = topEntry ? topEntry[1] / items.length : items.length >= MIN_PATTERN_COUNT ? 0.9 : 0;

    if (consistency < MIN_CONFIDENCE) continue;

    proposals.push({
      pattern_type: 'escalation_pattern',
      pattern_key: `operator::${actionType}`,
      company_id: items[0].company_id || null,
      proposal: {
        rule: 'auto_escalate',
        action_type: actionType,
        payload_pattern: topEntry ? topEntry[0] : null,
        instance_count: items.length,
        note: `Based on ${items.length} operator actions. Data is thin — review carefully.`,
      },
      confidence: Math.min(consistency, 0.90),
      evidence_count: items.length,
      evidence_sample: items.slice(0, 5).map(i => ({
        action_type: i.action_type,
        target_table: i.target_table,
        payload_keys: i.payload ? Object.keys(i.payload) : [],
        created_at: i.created_at,
      })),
    });
  }
  return proposals;
}

// =====================================================================
// P4: Autonomy Graduation (agent_decisions + autonomy_config)
// Check if any action type has enough consistent agent decisions
// to propose level 0→1 promotion.
// VIABILITY: CONDITIONAL (depends on workflow/action_type alignment)
// =====================================================================

async function analyzeAutonomyGraduation() {
  const { data: configs, error: cfgErr } = await supabase
    .from('autonomy_config')
    .select('*');

  if (cfgErr || !configs || configs.length === 0) {
    if (cfgErr) console.error('[P4] autonomy_config error:', cfgErr.message);
    return [];
  }

  const proposals = [];
  for (const config of configs) {
    if (config.current_level >= 1) continue;
    if (config.action_type === 'pedimento_filing') continue;

    const { data: decisions, error: decErr } = await supabase
      .from('agent_decisions')
      .select('decision, confidence, was_correct')
      .eq('workflow', config.action_type)
      .order('created_at', { ascending: false })
      .limit(200);

    if (decErr || !decisions || decisions.length < 50) continue;

    const validConf = decisions.filter(d => d.confidence != null);
    if (validConf.length === 0) continue;

    const avgConf = validConf.reduce((s, d) => s + parseFloat(d.confidence), 0) / validConf.length;
    const normalizedConf = avgConf > 1 ? avgConf / 100 : avgConf;

    if (normalizedConf < MIN_CONFIDENCE) continue;

    proposals.push({
      pattern_type: 'autonomy_graduation',
      pattern_key: `autonomy::${config.action_type}::0->1`,
      company_id: null,
      proposal: {
        rule: 'promote_autonomy',
        action_type: config.action_type,
        current_level: config.current_level,
        proposed_level: 1,
        avg_confidence: normalizedConf,
        total_decisions: decisions.length,
        note: 'Meets 50-precedent threshold for Level 0->1 promotion.',
      },
      confidence: Math.min(normalizedConf, 0.95),
      evidence_count: decisions.length,
      evidence_sample: decisions.slice(0, 5).map(d => ({
        decision: d.decision,
        confidence: d.confidence,
        was_correct: d.was_correct,
      })),
    });
  }
  return proposals;
}

// =====================================================================
// MAIN
// =====================================================================

runJob('karpathy-loop-trainer', async () => {
  const t0 = Date.now();

  console.log(`[trainer] Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const [p1, p2, p3, p4] = await Promise.all([
    analyzeClassificationConsistency().catch(err => { console.error('[P1] Fatal:', err.message); return []; }),
    analyzeAgentDecisionPatterns().catch(err => { console.error('[P2] Fatal:', err.message); return []; }),
    analyzeEscalationPatterns().catch(err => { console.error('[P3] Fatal:', err.message); return []; }),
    analyzeAutonomyGraduation().catch(err => { console.error('[P4] Fatal:', err.message); return []; }),
  ]);

  const allProposals = [...p1, ...p2, ...p3, ...p4];
  console.log(`[trainer] Raw proposals: ${allProposals.length} (P1:${p1.length} P2:${p2.length} P3:${p3.length} P4:${p4.length})`);

  // Deduplicate against existing pending proposals
  const { data: existing } = await supabase
    .from('proposed_automations')
    .select('pattern_type, pattern_key')
    .eq('status', 'pending');

  const existingKeys = new Set((existing || []).map(e => `${e.pattern_type}::${e.pattern_key}`));
  const fresh = allProposals.filter(p => !existingKeys.has(`${p.pattern_type}::${p.pattern_key}`));

  // Sort by confidence DESC, take top N
  fresh.sort((a, b) => b.confidence - a.confidence);
  const toInsert = fresh.slice(0, MAX_PROPOSALS_PER_RUN);

  console.log(`[trainer] ${fresh.length} novel (${existingKeys.size} already pending), inserting top ${toInsert.length}`);

  let inserted = 0;
  for (const p of toInsert) {
    if (DRY_RUN) {
      console.log(`  [DRY] ${p.pattern_type} | ${p.pattern_key} | conf=${p.confidence.toFixed(3)} | evidence=${p.evidence_count}`);
      inserted++;
      continue;
    }

    const { error } = await supabase.from('proposed_automations').insert({
      pattern_type: p.pattern_type,
      pattern_key: p.pattern_key,
      company_id: p.company_id || null,
      proposal: p.proposal,
      confidence: p.confidence,
      evidence_count: p.evidence_count,
      evidence_sample: p.evidence_sample || [],
      status: 'pending',
    });

    if (error) {
      console.error(`  [ERR] ${p.pattern_key}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  // Telegram summary
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const summary = [
    `*ADUANA Karpathy Trainer*`,
    ``,
    `Patrones: ${allProposals.length} encontrados`,
    `Nuevos: ${fresh.length} (${existingKeys.size} ya pendientes)`,
    `Insertados: ${inserted}`,
    ``,
    `P1 Clasificacion: ${p1.length}`,
    `P2 Decisiones: ${p2.length}`,
    `P3 Escalamiento: ${p3.length}`,
    `P4 Autonomia: ${p4.length}`,
    ``,
    `${elapsed}s${DRY_RUN ? ' (DRY RUN)' : ''}`,
  ].join('\n');

  await sendTelegram(summary);

  return {
    rowsProcessed: inserted,
    metadata: {
      total_patterns: allProposals.length,
      fresh: fresh.length,
      inserted,
      by_type: { classification: p1.length, agent: p2.length, escalation: p3.length, autonomy: p4.length },
      elapsed_s: parseFloat(elapsed),
      dry_run: DRY_RUN,
    },
  };
});
