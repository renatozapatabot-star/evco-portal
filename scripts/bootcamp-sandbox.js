#!/usr/bin/env node
// ============================================================================
// CRUZ Intelligence Bootcamp 8 — The Sandbox
//
// Replay engine for historical operations. Tests CRUZ intelligence
// against real data without risking live operations.
//
// 4 Modes:
//   replay       — Replay historical traficos through intelligence layers
//   what-if      — Apply hypothetical changes to historical operations
//   stress-test  — Simulate extreme scenarios against CRUZ models
//   adversarial  — Test CRUZ against edge cases and bad data
//
// Usage:
//   node scripts/bootcamp-sandbox.js --mode=replay --limit=100
//   node scripts/bootcamp-sandbox.js --mode=replay --trafico=REF-123
//   node scripts/bootcamp-sandbox.js --mode=what-if --trafico=REF-123 --change='{"carrier":"FEDEX"}'
//   node scripts/bootcamp-sandbox.js --mode=stress-test --scenario=volume_spike
//   node scripts/bootcamp-sandbox.js --mode=adversarial --target=fraccion_classifier
//   node scripts/bootcamp-sandbox.js --dry-run --mode=replay --limit=5
//
// Cron: On-demand only. No scheduled runs.
// ============================================================================

const {
  initBootcamp, upsertChunked, saveCheckpoint, fatalHandler,
  mean,
} = require('./lib/bootcamp')
const { SandboxEngine } = require('./lib/sandbox-engine')

const SCRIPT_NAME = 'bootcamp-sandbox'

async function run() {
  const { supabase, sendTelegram, logHeartbeat, args } = initBootcamp(SCRIPT_NAME)
  const start = Date.now()

  const mode = args.mode || 'replay'

  console.log(`\n🎓 BOOTCAMP 8: The Sandbox`)
  console.log(`   Mode: ${mode}`)
  console.log(`   Dry run: ${args.dryRun}`)

  const engine = new SandboxEngine(supabase)
  await engine.loadModels()
  console.log('   Models loaded ✓')

  let results = []
  const sessionId = `sandbox-${Date.now()}`

  // ── Mode routing ──────────────────────────────────────────────────────

  if (mode === 'replay') {
    if (args.trafico) {
      // Single trafico replay
      console.log(`\n▶️ Replaying: ${args.trafico}`)
      const result = await engine.runReplay(args.trafico)
      results.push(result)
      console.log(JSON.stringify(result, null, 2))
    } else {
      // Batch replay
      const limit = args.limit || 100
      console.log(`\n▶️ Batch replay: ${limit} traficos`)

      // Get recent traficos with crossing data
      const { data: traficos } = await supabase
        .from('traficos')
        .select('trafico')
        .not('fecha_cruce', 'is', null)
        .not('fecha_llegada', 'is', null)
        .order('fecha_cruce', { ascending: false })
        .limit(limit)

      if (!traficos || traficos.length === 0) {
        console.log('  No traficos with crossing data found.')
        return
      }

      console.log(`  Found ${traficos.length} traficos to replay`)

      let successCount = 0
      let errorCount = 0
      const scores = []

      for (let i = 0; i < traficos.length; i++) {
        const result = await engine.runReplay(traficos[i].trafico)

        if (result.error) {
          errorCount++
        } else {
          successCount++
          if (result.overall_score !== null) scores.push(result.overall_score)
          results.push(result)
        }

        if ((i + 1) % 10 === 0 || i === traficos.length - 1) {
          const avgScore = scores.length > 0 ? Math.round(mean(scores)) : 'N/A'
          process.stdout.write(`\r  Replayed: ${i + 1}/${traficos.length} · Score: ${avgScore}% · Errors: ${errorCount}`)
        }
      }

      const avgScore = scores.length > 0 ? Math.round(mean(scores)) : null
      console.log(`\n\n  📊 Replay Summary:`)
      console.log(`     Replayed: ${successCount} · Errors: ${errorCount}`)
      console.log(`     Average accuracy: ${avgScore !== null ? avgScore + '%' : 'N/A'}`)
      console.log(`     Score distribution:`)
      if (scores.length > 0) {
        const buckets = { '90-100': 0, '70-89': 0, '50-69': 0, '<50': 0 }
        for (const s of scores) {
          if (s >= 90) buckets['90-100']++
          else if (s >= 70) buckets['70-89']++
          else if (s >= 50) buckets['50-69']++
          else buckets['<50']++
        }
        Object.entries(buckets).forEach(([range, count]) => {
          const pct = Math.round(count / scores.length * 100)
          console.log(`       ${range}: ${count} (${pct}%)`)
        })
      }
    }

  } else if (mode === 'what-if') {
    if (!args.trafico) {
      console.error('Error: --trafico=REF required for what-if mode')
      process.exit(1)
    }
    if (!args.change) {
      console.error('Error: --change=\'{"key":"value"}\' required for what-if mode')
      process.exit(1)
    }

    console.log(`\n🔮 What-If: ${args.trafico} with changes ${JSON.stringify(args.change)}`)
    const result = await engine.runWhatIf(args.trafico, args.change)
    results.push(result)
    console.log(JSON.stringify(result, null, 2))

  } else if (mode === 'stress-test') {
    const scenario = args.scenario

    if (!scenario) {
      console.log('\n📋 Available stress-test scenarios:')
      console.log('   volume_spike      — Monthly volume doubles')
      console.log('   bridge_closure    — One bridge closes for a week')
      console.log('   supplier_delay    — Top supplier delays 5 days')
      console.log('   rate_change       — Exchange rate moves 10%')
      console.log('   reconocimiento_wave — Reconocimiento rate triples')
      console.log('\nUsage: --mode=stress-test --scenario=volume_spike')
      return
    }

    console.log(`\n💥 Stress-Test: ${scenario}`)
    const result = await engine.runStressTest(scenario)
    results.push(result)

    if (result.error) {
      console.error(`  Error: ${result.error}`)
    } else {
      console.log(`\n  Scenario: ${result.description}`)
      console.log('  Results:')
      console.log(JSON.stringify(result.results, null, 2))
    }

  } else if (mode === 'adversarial') {
    const target = args.target

    if (!target) {
      console.log('\n📋 Available adversarial targets:')
      console.log('   fraccion_classifier  — Test classification with edge cases')
      console.log('   value_detector       — Test anomaly detection with edge values')
      console.log('\nUsage: --mode=adversarial --target=fraccion_classifier')
      return
    }

    console.log(`\n⚔️ Adversarial: ${target}`)
    const result = await engine.runAdversarial(target)
    results.push(result)

    if (result.error) {
      console.error(`  Error: ${result.error}`)
    } else {
      console.log(`\n  Target: ${result.description}`)
      console.log(`  Score: ${result.results.score}`)
      console.log(`  Pass: ${result.results.pass ? '✅' : '❌'}`)
      console.log('  Test cases:')
      result.results.test_cases.forEach(tc => {
        const icon = tc.correct !== false && tc.caught !== false ? '✅' : '❌'
        console.log(`    ${icon} ${tc.input || tc.label}: ${tc.match || tc.was_flagged}`)
      })
    }

  } else {
    console.error(`Unknown mode: ${mode}. Use: replay, what-if, stress-test, adversarial`)
    process.exit(1)
  }

  // ── Save results to cruz_sandbox ──────────────────────────────────────
  if (!args.dryRun && results.length > 0) {
    console.log('\n💾 Saving results to cruz_sandbox...')

    const sandboxRows = results
      .filter(r => !r.error)
      .slice(0, 100) // cap at 100 per session
      .map(r => ({
        session_id: sessionId,
        model_type: mode === 'what-if' ? 'what_if' : mode === 'stress-test' ? 'stress_test' : mode,
        training_samples: r.decision_points?.length || r.comparisons?.length || 1,
        validation_samples: 0,
        accuracy_score: r.overall_score || null,
        baseline_accuracy: null,
        improvement_delta: null,
        sample_predictions: r,
        notes: `Bootcamp 8 ${mode} session`,
      }))

    if (sandboxRows.length > 0) {
      const { error } = await supabase.from('cruz_sandbox').insert(sandboxRows)
      if (error) {
        console.error(`  Error saving to cruz_sandbox: ${error.message}`)
      } else {
        console.log(`  Saved ${sandboxRows.length} results`)
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - start) / 1000)
  const summary = {
    mode,
    results_count: results.length,
    errors: results.filter(r => r.error).length,
    session_id: sessionId,
    elapsed_s: elapsed,
  }

  console.log(`\n✅ Bootcamp 8 complete in ${elapsed}s`)
  console.log(`   Mode: ${mode} · Results: ${results.length} · Session: ${sessionId}`)

  if (!args.dryRun) {
    await logHeartbeat('success', summary)
    await sendTelegram(
      `🎓 <b>Bootcamp 8: Sandbox</b>\n` +
      `Mode: ${mode} · ${results.length} resultados\n` +
      `Session: ${sessionId}\n` +
      `${elapsed}s · — CRUZ 🦀`
    )
  }
}

run().catch(async err => {
  const { supabase, sendTelegram, logHeartbeat } = initBootcamp(SCRIPT_NAME)
  await fatalHandler(SCRIPT_NAME, sendTelegram, logHeartbeat, err)
})
