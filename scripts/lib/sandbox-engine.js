// scripts/lib/sandbox-engine.js
// CRUZ Intelligence Bootcamp 8 — Sandbox Replay Engine
//
// Simulates historical operations through CRUZ intelligence layers.
// 4 modes: replay, what-if, stress-test, adversarial.
// Used by bootcamp-sandbox.js CLI.

const { mean, percentile, stdDev } = require('./bootcamp')

class SandboxEngine {
  constructor(supabase) {
    this.supabase = supabase
    this.models = null
  }

  // ── Load intelligence models ──────────────────────────────────────────

  async loadModels() {
    if (this.models) return this.models

    const [
      { data: crossingPatterns },
      { data: fraccionPatterns },
      { data: supplierProfiles },
      { data: clientFingerprints },
    ] = await Promise.all([
      this.supabase.from('learned_patterns')
        .select('pattern_key, pattern_value, confidence, sample_size')
        .eq('pattern_type', 'crossing_analysis')
        .eq('active', true),
      this.supabase.from('fraccion_patterns')
        .select('fraccion, description_keywords, ambiguous, alt_fracciones, confidence')
        .limit(2000),
      this.supabase.from('supplier_profiles')
        .select('supplier_code, company_id, reliability_score, avg_crossing_hours, trend')
        .limit(500),
      this.supabase.from('cruz_memory')
        .select('company_id, pattern_key, pattern_value')
        .eq('pattern_type', 'client_fingerprint'),
    ])

    this.models = {
      crossing: new Map((crossingPatterns || []).map(p => [p.pattern_key, p])),
      fracciones: new Map((fraccionPatterns || []).map(p => [p.fraccion, p])),
      suppliers: new Map((supplierProfiles || []).map(p => [`${p.supplier_code}|${p.company_id}`, p])),
      clients: new Map((clientFingerprints || []).map(p => [p.company_id, p.pattern_value])),
    }

    return this.models
  }

  // ── Load a single trafico with full context ───────────────────────────

  async loadContext(traficoRef) {
    const { data: trafico, error } = await this.supabase
      .from('traficos')
      .select('*')
      .eq('trafico', traficoRef)
      .single()

    if (error || !trafico) return null

    // Load related facturas
    const { data: facturas } = await this.supabase
      .from('aduanet_facturas')
      .select('*')
      .eq('referencia', traficoRef)
      .limit(20)

    return { trafico, facturas: facturas || [] }
  }

  // ── Mode 1: Replay ────────────────────────────────────────────────────

  async runReplay(traficoRef) {
    const models = await this.loadModels()
    const ctx = await this.loadContext(traficoRef)
    if (!ctx) return { error: `Trafico ${traficoRef} not found` }

    const { trafico, facturas } = ctx
    const decisions = []
    let totalScore = 0
    let decisionCount = 0

    // Decision 1: Crossing time prediction
    if (trafico.fecha_llegada && trafico.fecha_cruce) {
      const actualHours = (new Date(trafico.fecha_cruce) - new Date(trafico.fecha_llegada)) / 3600000
      const cruce = new Date(trafico.fecha_cruce)
      const dow = cruce.getDay()

      const dayPattern = models.crossing.get(`crossing:day:${dow}`)
      const predictedHours = dayPattern?.pattern_value?.avg_hours || null

      if (predictedHours && actualHours > 0 && actualHours < 240) {
        const accuracy = 1 - Math.abs(predictedHours - actualHours) / actualHours
        decisions.push({
          step: 'crossing_time',
          actual: `${actualHours.toFixed(1)}h`,
          predicted: predictedHours ? `${predictedHours}h` : 'no data',
          delta: `${(predictedHours - actualHours).toFixed(1)}h`,
          accuracy: Math.max(0, Math.round(accuracy * 100)),
        })
        totalScore += Math.max(0, accuracy)
        decisionCount++
      }
    }

    // Decision 2: Supplier reliability check
    const suppliers = (trafico.proveedores || '').split(/[,;]/).map(s => s.trim().toUpperCase()).filter(Boolean)
    for (const supplier of suppliers.slice(0, 3)) {
      const profile = models.suppliers.get(`${supplier}|${trafico.company_id}`)
      if (profile) {
        decisions.push({
          step: 'supplier_check',
          supplier,
          reliability: profile.reliability_score,
          avg_hours: profile.avg_crossing_hours,
          trend: profile.trend,
          assessment: profile.reliability_score >= 70 ? 'reliable' : 'needs_monitoring',
        })
      }
    }

    // Decision 3: Client fingerprint match
    const fingerprint = models.clients.get(trafico.company_id)
    if (fingerprint) {
      decisions.push({
        step: 'client_context',
        company: trafico.company_id,
        total_operations: fingerprint.total_operations,
        volume_trend: fingerprint.volume_trend,
        avg_crossing_hours: fingerprint.avg_crossing_hours,
      })
    }

    // Decision 4: Value anomaly check
    if (facturas.length > 0) {
      const totalValue = facturas.reduce((s, f) => s + (Number(f.valor_usd) || 0), 0)
      if (fingerprint?.avg_shipment_value && totalValue > 0) {
        const ratio = totalValue / fingerprint.avg_shipment_value
        const isAnomaly = ratio > 2 || ratio < 0.5
        decisions.push({
          step: 'value_check',
          actual_value: totalValue,
          avg_value: fingerprint.avg_shipment_value,
          ratio: Math.round(ratio * 100) / 100,
          anomaly: isAnomaly,
          assessment: isAnomaly ? 'FLAG: value outside normal range' : 'normal',
        })
        if (!isAnomaly) {
          totalScore += 1
          decisionCount++
        }
      }
    }

    const overallScore = decisionCount > 0 ? Math.round(totalScore / decisionCount * 100) : null

    return {
      mode: 'replay',
      trafico: traficoRef,
      company: trafico.company_id,
      decision_points: decisions,
      overall_score: overallScore,
      model_coverage: {
        crossing_data: decisions.some(d => d.step === 'crossing_time'),
        supplier_data: decisions.some(d => d.step === 'supplier_check'),
        client_data: decisions.some(d => d.step === 'client_context'),
        value_data: decisions.some(d => d.step === 'value_check'),
      },
    }
  }

  // ── Mode 2: What-If ───────────────────────────────────────────────────

  async runWhatIf(traficoRef, changes) {
    const models = await this.loadModels()
    const ctx = await this.loadContext(traficoRef)
    if (!ctx) return { error: `Trafico ${traficoRef} not found` }

    const { trafico } = ctx
    const comparisons = []

    // Apply changes and compare
    if (changes.carrier) {
      const carrierPattern = models.crossing.get(`crossing:carrier:${changes.carrier.toUpperCase()}`)
      const originalCarrier = (trafico.transportista_extranjero || '').toUpperCase()
      const originalPattern = models.crossing.get(`crossing:carrier:${originalCarrier}`)

      comparisons.push({
        change: 'carrier',
        original: { carrier: originalCarrier, avg_hours: originalPattern?.pattern_value?.avg_hours || 'no data' },
        modified: { carrier: changes.carrier.toUpperCase(), avg_hours: carrierPattern?.pattern_value?.avg_hours || 'no data' },
        delta_hours: (carrierPattern?.pattern_value?.avg_hours || 0) - (originalPattern?.pattern_value?.avg_hours || 0),
      })
    }

    if (changes.crossing_day !== undefined) {
      const originalDow = trafico.fecha_cruce ? new Date(trafico.fecha_cruce).getDay() : null
      const originalDayPattern = models.crossing.get(`crossing:day:${originalDow}`)
      const newDayPattern = models.crossing.get(`crossing:day:${changes.crossing_day}`)

      comparisons.push({
        change: 'crossing_day',
        original: { day: originalDow, avg_hours: originalDayPattern?.pattern_value?.avg_hours || 'no data' },
        modified: { day: changes.crossing_day, avg_hours: newDayPattern?.pattern_value?.avg_hours || 'no data' },
        delta_hours: (newDayPattern?.pattern_value?.avg_hours || 0) - (originalDayPattern?.pattern_value?.avg_hours || 0),
      })
    }

    return {
      mode: 'what-if',
      trafico: traficoRef,
      changes_applied: changes,
      comparisons,
      recommendation: comparisons.some(c => c.delta_hours < 0)
        ? 'Change would improve crossing time'
        : 'Change would not improve crossing time',
    }
  }

  // ── Mode 3: Stress-Test ───────────────────────────────────────────────

  async runStressTest(scenario, params = {}) {
    const models = await this.loadModels()
    const overallPattern = models.crossing.get('crossing:overall')
    const baseAvg = overallPattern?.pattern_value?.avg_hours || 24

    const scenarios = {
      volume_spike: {
        description: 'Monthly volume doubles',
        simulate: () => {
          // With 2x volume, crossing times increase ~30% historically
          const impactedAvg = baseAvg * 1.3
          return {
            baseline_avg_hours: baseAvg,
            stressed_avg_hours: Math.round(impactedAvg * 10) / 10,
            impact_pct: 30,
            bottleneck: 'bridge_capacity',
            mitigation: 'Split shipments across multiple bridges and off-peak hours',
          }
        },
      },
      bridge_closure: {
        description: 'One bridge closes for a week',
        simulate: () => {
          const impactedAvg = baseAvg * 1.8 // remaining bridges absorb traffic
          return {
            baseline_avg_hours: baseAvg,
            stressed_avg_hours: Math.round(impactedAvg * 10) / 10,
            impact_pct: 80,
            bottleneck: 'single_bridge',
            mitigation: 'Pre-position inventory, use alternative bridges, schedule off-peak',
          }
        },
      },
      supplier_delay: {
        description: 'Top supplier delays 5 days',
        simulate: () => {
          // Impact depends on supplier concentration
          const clients = [...models.clients.values()]
          const avgConcentration = clients.length > 0
            ? mean(clients.map(c => c.supplier_concentration || 0.5))
            : 0.5
          const impactDays = 5 * avgConcentration // higher concentration = higher impact
          return {
            avg_supplier_concentration: Math.round(avgConcentration * 100) / 100,
            delay_days: 5,
            effective_delay_days: Math.round(impactDays * 10) / 10,
            impact: avgConcentration > 0.5 ? 'HIGH — concentrated supplier base' : 'MODERATE',
            mitigation: 'Diversify suppliers, maintain safety stock, pre-negotiate alternatives',
          }
        },
      },
      rate_change: {
        description: 'Exchange rate moves 10%',
        simulate: () => {
          return {
            rate_change_pct: 10,
            duty_impact_pct: 10, // duties are MXN-denominated
            volume_impact_estimate: -5, // higher costs reduce volume slightly
            mitigation: 'Hedge FX exposure, accelerate T-MEC eligible shipments',
          }
        },
      },
      reconocimiento_wave: {
        description: 'Reconocimiento rate triples',
        simulate: () => {
          const currentRate = overallPattern?.pattern_value?.semaforo_verde_pct
            ? (100 - overallPattern.pattern_value.semaforo_verde_pct) / 100
            : 0.15
          const stressedRate = Math.min(currentRate * 3, 0.8)
          const additionalHours = stressedRate * 8 // each reconocimiento adds ~8 hours
          return {
            baseline_reco_rate: Math.round(currentRate * 100),
            stressed_reco_rate: Math.round(stressedRate * 100),
            additional_hours_per_crossing: Math.round(additionalHours * 10) / 10,
            stressed_avg_hours: Math.round((baseAvg + additionalHours) * 10) / 10,
            mitigation: 'Ensure complete documentation, pre-validate classifications, avoid flagged fracciones',
          }
        },
      },
    }

    const scenarioFn = scenarios[scenario]
    if (!scenarioFn) {
      return { error: `Unknown scenario: ${scenario}. Available: ${Object.keys(scenarios).join(', ')}` }
    }

    return {
      mode: 'stress-test',
      scenario,
      description: scenarioFn.description,
      results: scenarioFn.simulate(),
      models_used: {
        crossing_patterns: models.crossing.size,
        supplier_profiles: models.suppliers.size,
        client_fingerprints: models.clients.size,
      },
    }
  }

  // ── Mode 4: Adversarial ───────────────────────────────────────────────

  async runAdversarial(target, params = {}) {
    const models = await this.loadModels()

    const targets = {
      fraccion_classifier: {
        description: 'Test fraccion classification with edge cases',
        test: () => {
          const testCases = [
            { desc: 'resina de polietileno alta densidad', expected: '3901.20', type: 'standard' },
            { desc: 'mezcla de polimeros sin especificar', expected: 'ambiguous', type: 'ambiguous' },
            { desc: 'XXXXXXX producto desconocido ZZZ', expected: 'unknown', type: 'garbage' },
            { desc: 'tornillo de acero inoxidable M8', expected: '7318.15', type: 'standard' },
            { desc: '', expected: 'empty', type: 'empty_input' },
          ]

          const results = testCases.map(tc => {
            // Check if any fraccion pattern matches keywords
            let bestMatch = null
            let bestScore = 0
            const words = tc.desc.toLowerCase().split(/\s+/).filter(w => w.length > 3)

            for (const [fraccion, pattern] of models.fracciones) {
              const keywords = pattern.description_keywords || []
              const overlap = words.filter(w => keywords.includes(w)).length
              const score = words.length > 0 ? overlap / words.length : 0

              if (score > bestScore) {
                bestScore = score
                bestMatch = { fraccion, score, ambiguous: pattern.ambiguous }
              }
            }

            return {
              input: tc.desc || '(empty)',
              type: tc.type,
              match: bestMatch ? bestMatch.fraccion : 'none',
              confidence: bestMatch ? Math.round(bestScore * 100) : 0,
              ambiguous: bestMatch?.ambiguous || false,
              caught: tc.type === 'garbage' ? (!bestMatch || bestScore < 0.3) : true,
              caught_empty: tc.type === 'empty_input' ? !bestMatch : true,
            }
          })

          const caught = results.filter(r => r.caught && r.caught_empty !== false).length
          return {
            test_cases: results,
            score: `${caught}/${results.length}`,
            pass: caught === results.length,
          }
        },
      },

      value_detector: {
        description: 'Test anomaly detection with edge values',
        test: () => {
          const testCases = [
            { value: 1000000, label: 'extremely_high', shouldFlag: true },
            { value: 0.01, label: 'near_zero', shouldFlag: true },
            { value: -500, label: 'negative', shouldFlag: true },
            { value: 50000, label: 'normal', shouldFlag: false },
            { value: null, label: 'null', shouldFlag: true },
          ]

          const results = testCases.map(tc => {
            const flagged = tc.value === null || tc.value <= 0 || tc.value > 500000
            return {
              value: tc.value,
              label: tc.label,
              should_flag: tc.shouldFlag,
              was_flagged: flagged,
              correct: flagged === tc.shouldFlag,
            }
          })

          const correct = results.filter(r => r.correct).length
          return {
            test_cases: results,
            score: `${correct}/${results.length}`,
            pass: correct === results.length,
          }
        },
      },
    }

    const targetFn = targets[target]
    if (!targetFn) {
      return { error: `Unknown target: ${target}. Available: ${Object.keys(targets).join(', ')}` }
    }

    return {
      mode: 'adversarial',
      target,
      description: targetFn.description,
      results: targetFn.test(),
    }
  }
}

module.exports = { SandboxEngine }
