#!/usr/bin/env node
/**
 * V2-B: Karpathy Loop Trainer — Verification Script
 * Checks table, RPC, and data availability.
 * Run: node scripts/verify-karpathy.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('=== V2-B Karpathy Trainer Verification ===\n');
  let pass = 0;
  let fail = 0;

  // 1. Table exists
  const { error: tableErr } = await supabase.from('proposed_automations').select('id').limit(1);
  if (tableErr) {
    console.log(`  [FAIL] proposed_automations table: ${tableErr.message}`);
    console.log('         Run migration: supabase/migrations/20260410130000_v2b_proposed_automations.sql');
    fail++;
  } else {
    console.log('  [PASS] proposed_automations table exists');
    pass++;
  }

  // 2. RPC exists
  const { error: rpcErr } = await supabase.rpc('find_classification_patterns', {
    p_min_count: 1,
    p_min_consistency: 0.99,
    p_max_results: 1,
  });
  if (rpcErr) {
    console.log(`  [FAIL] find_classification_patterns RPC: ${rpcErr.message}`);
    fail++;
  } else {
    console.log('  [PASS] find_classification_patterns RPC works');
    pass++;
  }

  // 3. Data availability
  console.log('\n  Data sources:');

  const { count: prodCount } = await supabase
    .from('globalpc_productos')
    .select('id', { count: 'exact', head: true })
    .not('fraccion', 'is', null);
  console.log(`    globalpc_productos (with fraccion): ${prodCount ?? 'error'}`);

  const { count: decCount } = await supabase
    .from('agent_decisions')
    .select('id', { count: 'exact', head: true });
  console.log(`    agent_decisions: ${decCount ?? 'error'}`);

  const { count: actCount } = await supabase
    .from('operator_actions')
    .select('id', { count: 'exact', head: true });
  console.log(`    operator_actions: ${actCount ?? 'error'}`);

  const { data: autoConfig } = await supabase
    .from('autonomy_config')
    .select('action_type, current_level');
  if (autoConfig) {
    console.log(`    autonomy_config: ${autoConfig.length} action types`);
    for (const c of autoConfig) {
      console.log(`      ${c.action_type}: level ${c.current_level}`);
    }
  }

  // 4. Existing proposals
  const { data: proposals, count: propCount } = await supabase
    .from('proposed_automations')
    .select('pattern_type, status', { count: 'exact' });
  if (proposals && proposals.length > 0) {
    const byStatus = {};
    for (const p of proposals) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    console.log(`\n  Existing proposals (${propCount}):`);
    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`    ${status}: ${count}`);
    }
  } else {
    console.log('\n  No proposals yet (table empty — run the trainer first)');
  }

  console.log(`\n  Result: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log('\n  Apply the migration first, then re-run this script.');
  } else {
    console.log('\n  Ready. Run: node scripts/karpathy-loop-trainer.js --dry-run');
  }

  process.exit(fail > 0 ? 1 : 0);
}

verify().catch(err => {
  console.error('Verify failed:', err.message);
  process.exit(1);
});
