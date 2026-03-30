#!/usr/bin/env node
/**
 * CRUZ Module Health Monitor
 * 
 * Runs weekly (or on demand) to answer:
 * - Which modules are actually running?
 * - Which haven't run in 7+ days? (dormant)
 * - Which have low confidence? (degraded)
 * - Which have high correction rates? (failing)
 * - What's the overall system health?
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

// All 25 modules that SHOULD be running
const ALL_MODULES = [
  'qwen-client', 'daily-intelligence', 'meta-learner', 'neural-bridge',
  'border-intel', 'sat-translator', 'supplier-risk', 'mve-predictor',
  'training-simulator', 'predictive-docs', 'classification-corrector',
  'trade-lane-optimizer', 'inspector-analyzer', 'document-organizer',
  'reputation-monitor', 'anomaly-detector', 'audit-defense',
  'pricing-engine', 'deadline-calendar', 'customs-rag',
  'supplier-negotiator', 'document-intel', 'view-latest',
  'meta-cruz', 'event-bus',
];

async function checkModuleHealth() {
  console.log('🏥 CRUZ Module Health Report');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Date: ${new Date().toLocaleString('es-MX')}\n`);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  // Get execution data per module
  const { data: executions } = await supabase
    .from('module_executions')
    .select('module_name, confidence, latency_ms, error, created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  // Get corrections per module
  const { data: corrections } = await supabase
    .from('cruz_corrections')
    .select('module_name, created_at')
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Get active improvements per module
  const { data: improvements } = await supabase
    .from('prompt_improvements')
    .select('module_name')
    .eq('active', true);

  // Aggregate by module
  const moduleStats = {};
  for (const mod of ALL_MODULES) {
    moduleStats[mod] = {
      totalRuns: 0,
      errors: 0,
      lastRun: null,
      avgConfidence: 0,
      avgLatency: 0,
      corrections: 0,
      activeImprovements: 0,
      confidences: [],
      latencies: [],
    };
  }

  for (const exec of (executions || [])) {
    const mod = moduleStats[exec.module_name];
    if (!mod) {
      moduleStats[exec.module_name] = {
        totalRuns: 0, errors: 0, lastRun: null, avgConfidence: 0,
        avgLatency: 0, corrections: 0, activeImprovements: 0,
        confidences: [], latencies: [],
      };
    }
    const s = moduleStats[exec.module_name];
    s.totalRuns++;
    if (exec.error) s.errors++;
    if (!s.lastRun || exec.created_at > s.lastRun) s.lastRun = exec.created_at;
    if (exec.confidence) s.confidences.push(exec.confidence);
    if (exec.latency_ms) s.latencies.push(exec.latency_ms);
  }

  for (const c of (corrections || [])) {
    if (moduleStats[c.module_name]) moduleStats[c.module_name].corrections++;
  }

  for (const imp of (improvements || [])) {
    if (moduleStats[imp.module_name]) moduleStats[imp.module_name].activeImprovements++;
  }

  // Calculate averages and determine status
  const statusCounts = { healthy: 0, degraded: 0, failing: 0, dormant: 0, unknown: 0 };

  const moduleResults = Object.entries(moduleStats).map(([name, stats]) => {
    stats.avgConfidence = stats.confidences.length
      ? stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length
      : 0;
    stats.avgLatency = stats.latencies.length
      ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
      : 0;

    let status;
    if (stats.totalRuns === 0) {
      status = ALL_MODULES.includes(name) ? 'dormant' : 'unknown';
    } else if (stats.lastRun && new Date(stats.lastRun) < sevenDaysAgo) {
      status = 'dormant';
    } else if (stats.errors / stats.totalRuns > 0.3) {
      status = 'failing';
    } else if (stats.avgConfidence < 0.5 || stats.corrections > stats.totalRuns * 0.2) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    statusCounts[status]++;

    return { name, ...stats, status };
  });

  // Sort: failing first, then degraded, dormant, healthy
  const statusOrder = { failing: 0, degraded: 1, dormant: 2, unknown: 3, healthy: 4 };
  moduleResults.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  // Print results
  const statusIcons = {
    healthy: '🟢', degraded: '🟡', failing: '🔴', dormant: '💤', unknown: '⚪'
  };

  console.log('MODULE STATUS');
  console.log('─'.repeat(90));
  console.log(
    'Status'.padEnd(8) +
    'Module'.padEnd(28) +
    'Runs'.padStart(6) +
    'Errors'.padStart(8) +
    'Conf'.padStart(7) +
    'Latency'.padStart(9) +
    'Fixes'.padStart(7) +
    'Rules'.padStart(7) +
    'Last Run'.padStart(14)
  );
  console.log('─'.repeat(90));

  for (const m of moduleResults) {
    const lastRun = m.lastRun
      ? new Date(m.lastRun).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
      : 'never';

    console.log(
      `${statusIcons[m.status]}`.padEnd(8) +
      m.name.padEnd(28) +
      `${m.totalRuns}`.padStart(6) +
      `${m.errors}`.padStart(8) +
      `${m.avgConfidence ? Math.round(m.avgConfidence * 100) + '%' : '—'}`.padStart(7) +
      `${m.avgLatency ? m.avgLatency + 'ms' : '—'}`.padStart(9) +
      `${m.corrections}`.padStart(7) +
      `${m.activeImprovements}`.padStart(7) +
      lastRun.padStart(14)
    );
  }

  // System summary
  console.log('\n' + '═'.repeat(90));
  console.log('SYSTEM SUMMARY');
  console.log('─'.repeat(90));
  console.log(`  🟢 Healthy:  ${statusCounts.healthy}`);
  console.log(`  🟡 Degraded: ${statusCounts.degraded}`);
  console.log(`  🔴 Failing:  ${statusCounts.failing}`);
  console.log(`  💤 Dormant:  ${statusCounts.dormant}`);
  console.log(`  ⚪ Unknown:  ${statusCounts.unknown}`);

  const totalActive = statusCounts.healthy + statusCounts.degraded;
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  console.log(`\n  Active modules: ${totalActive}/${total}`);
  console.log(`  System health: ${Math.round(totalActive / total * 100)}%`);

  // Actionable recommendations
  const failing = moduleResults.filter(m => m.status === 'failing');
  const dormant = moduleResults.filter(m => m.status === 'dormant');

  if (failing.length) {
    console.log(`\n  🔴 ACTION NEEDED — Failing modules:`);
    for (const m of failing) {
      console.log(`     ${m.name}: ${m.errors}/${m.totalRuns} errors, ${Math.round(m.avgConfidence * 100)}% confidence`);
    }
  }

  if (dormant.length) {
    console.log(`\n  💤 DORMANT — Haven't run in 7+ days (kill or fix):`);
    for (const m of dormant) {
      console.log(`     ${m.name}: last run ${m.lastRun ? new Date(m.lastRun).toLocaleDateString('es-MX') : 'never'}`);
    }
  }

  // Update module_health table
  for (const m of moduleResults) {
    await supabase.from('module_health').upsert({
      module_name: m.name,
      last_execution: m.lastRun,
      total_runs: m.totalRuns,
      total_errors: m.errors,
      avg_confidence: m.avgConfidence || null,
      avg_latency_ms: m.avgLatency || null,
      accuracy_30d: m.totalRuns > 0 ? (m.totalRuns - m.errors) / m.totalRuns : null,
      correction_count_30d: m.corrections,
      status: m.status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'module_name' });
  }

  console.log('\n✅ Health data saved to module_health table');
  return { statusCounts, moduleResults };
}

if (require.main === module) {
  checkModuleHealth()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { checkModuleHealth };
