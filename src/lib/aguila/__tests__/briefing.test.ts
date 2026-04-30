import { describe, it, expect } from 'vitest'
import { composeMorningBriefing, type MorningBriefingInput } from '../briefing'
import type {
  AnomalyOnlyResponseEs,
  TenantScanResponseEs,
  AgentToolResponse,
} from '../tools'

// ── Fixtures ──────────────────────────────────────────────────────

function tenantScanOk(
  overrides: Partial<TenantScanResponseEs> = {},
): AgentToolResponse<TenantScanResponseEs> {
  return {
    success: true,
    error: null,
    data: {
      type: 'tenant_scan',
      headline_es: 'evco: verde base 88% · 2 anomalías · Proveedor nuevo (1), Salto de volumen (1).',
      summary_es: 'evco: 2 anomalías detectadas en la ventana.',
      company_id: 'evco',
      baseline_verde_pct: 88,
      anomaly_count: 2,
      anomaly_groups_es: [
        { label_es: 'Proveedor nuevo', count: 1 },
        { label_es: 'Salto de volumen', count: 1 },
      ],
      top_focus_es: [
        { cve_producto: 'SKU-RISK', probability_pct: 60, band_es: 'baja', summary_es: 'SKU-RISK 60%' },
        { cve_producto: 'SKU-SIDE', probability_pct: 78, band_es: 'media', summary_es: 'SKU-SIDE 78%' },
      ],
      recommendations: [
        {
          priority_es: 'alta',
          action_es: 'Prepara documentación de SKU-RISK antes del cruce — probabilidad verde 60%.',
          rationale_es: 'Confianza baja.',
        },
        {
          priority_es: 'media',
          action_es: 'Valida proveedor nuevo PRV_NEW antes de escalar volumen.',
          rationale_es: 'Primer cruce observado.',
        },
      ],
      ...overrides,
    },
  }
}

function anomalyOnlyOk(
  overrides: Partial<AnomalyOnlyResponseEs> = {},
): AgentToolResponse<AnomalyOnlyResponseEs> {
  return {
    success: true,
    error: null,
    data: {
      type: 'anomaly_only',
      headline_es: 'evco: 2 anomalías · Proveedor nuevo (1), Salto de volumen (1).',
      summary_es: 'evco: 2 anomalías.',
      company_id: 'evco',
      anomaly_count: 2,
      anomaly_groups_es: [
        {
          label_es: 'Proveedor nuevo',
          count: 1,
          top_subjects: ['PRV_NEW'],
        },
        {
          label_es: 'Salto de volumen',
          count: 1,
          top_subjects: ['SKU-HOT'],
        },
      ],
      recommendations: [
        {
          priority_es: 'media',
          action_es: 'Valida proveedor nuevo PRV_NEW antes de escalar volumen.',
          rationale_es: 'Primer cruce.',
        },
      ],
      ...overrides,
    },
  }
}

function calmAnomalies(): AgentToolResponse<AnomalyOnlyResponseEs> {
  return {
    success: true,
    error: null,
    data: {
      type: 'anomaly_only',
      headline_es: 'evco: operación en calma · sin anomalías.',
      summary_es: 'evco: sin anomalías.',
      company_id: 'evco',
      anomaly_count: 0,
      anomaly_groups_es: [],
      recommendations: [],
    },
  }
}

function failed<T>(error = 'db_down'): AgentToolResponse<T> {
  return { success: false, error, data: null }
}

function baseInput(
  overrides: Partial<MorningBriefingInput> = {},
): MorningBriefingInput {
  return {
    companyId: 'evco',
    intelligence: tenantScanOk(),
    anomalies: anomalyOnlyOk(),
    generatedAt: '2026-04-22T12:30:00Z',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────

describe('composeMorningBriefing — headline + structure', () => {
  it('builds a rich briefing when both responses succeed', () => {
    const out = composeMorningBriefing(baseInput())
    expect(out.degraded).toBe(false)
    expect(out.headline_es).toContain('verde base 88%')
    expect(out.text_html).toContain('<b>☀️ Briefing matutino')
    expect(out.text_html).toContain('📊 Panorama')
    expect(out.text_html).toContain('⚠️ Anomalías')
    expect(out.text_html).toContain('✅ Recomendaciones')
    expect(out.text_html).toContain('🎯 SKUs a revisar')
    expect(out.text_html).toContain('solo interno')
  })

  it('includes plain-text equivalent without HTML tags', () => {
    const out = composeMorningBriefing(baseInput())
    expect(out.text_plain).not.toMatch(/<[a-z]+>/)
    expect(out.text_plain).toContain('Briefing matutino')
    expect(out.text_plain).toContain('📊 Panorama')
  })

  it('builds a decision log entry with workflow + no action yet', () => {
    const out = composeMorningBriefing(baseInput())
    expect(out.decision_log_entry.workflow).toBe('morning_briefing')
    expect(out.decision_log_entry.trigger_type).toBe('cron')
    expect(out.decision_log_entry.trigger_id).toBe('morning_briefing:2026-04-22')
    expect(out.decision_log_entry.company_id).toBe('evco')
    expect(out.decision_log_entry.autonomy_level).toBe(0)
    expect(out.decision_log_entry.confidence).toBe(1.0)
    expect(out.decision_log_entry.action_taken).toBeNull()
    expect(out.decision_log_entry.decision).toContain('verde base 88%')
    expect(out.decision_log_entry.reasoning).toContain('Panorama')
  })
})

describe('composeMorningBriefing — caps top-3', () => {
  it('caps anomaly groups at 3', () => {
    const anomalies = anomalyOnlyOk({
      anomaly_groups_es: [
        { label_es: 'G1', count: 1, top_subjects: ['A'] },
        { label_es: 'G2', count: 1, top_subjects: ['B'] },
        { label_es: 'G3', count: 1, top_subjects: ['C'] },
        { label_es: 'G4', count: 1, top_subjects: ['D'] },
        { label_es: 'G5', count: 1, top_subjects: ['E'] },
      ],
    })
    const out = composeMorningBriefing(baseInput({ anomalies }))
    expect(out.text_plain).toContain('G1')
    expect(out.text_plain).toContain('G2')
    expect(out.text_plain).toContain('G3')
    expect(out.text_plain).not.toContain('G4')
    expect(out.text_plain).not.toContain('G5')
  })

  it('caps recommendations at 3 and sorts by priority', () => {
    const intel = tenantScanOk({
      recommendations: [
        { priority_es: 'baja', action_es: 'Accion baja 1', rationale_es: '' },
        { priority_es: 'alta', action_es: 'Accion alta 1', rationale_es: '' },
        { priority_es: 'media', action_es: 'Accion media 1', rationale_es: '' },
        { priority_es: 'alta', action_es: 'Accion alta 2', rationale_es: '' },
        { priority_es: 'baja', action_es: 'Accion baja 2', rationale_es: '' },
      ],
    })
    const out = composeMorningBriefing(baseInput({ intelligence: intel }))
    // Top 3 in priority order: 2 altas then 1 media
    expect(out.text_plain).toContain('Accion alta 1')
    expect(out.text_plain).toContain('Accion alta 2')
    expect(out.text_plain).toContain('Accion media 1')
    expect(out.text_plain).not.toContain('Accion baja 1')
    expect(out.text_plain).not.toContain('Accion baja 2')
  })

  it('caps top_focus at 3', () => {
    const intel = tenantScanOk({
      top_focus_es: [
        { cve_producto: 'F1', probability_pct: 50, band_es: 'baja', summary_es: '' },
        { cve_producto: 'F2', probability_pct: 60, band_es: 'baja', summary_es: '' },
        { cve_producto: 'F3', probability_pct: 70, band_es: 'media', summary_es: '' },
        { cve_producto: 'F4', probability_pct: 80, band_es: 'media', summary_es: '' },
        { cve_producto: 'F5', probability_pct: 90, band_es: 'alta', summary_es: '' },
      ],
    })
    const out = composeMorningBriefing(baseInput({ intelligence: intel }))
    expect(out.text_plain).toContain('F1')
    expect(out.text_plain).toContain('F2')
    expect(out.text_plain).toContain('F3')
    expect(out.text_plain).not.toContain('F4')
    expect(out.text_plain).not.toContain('F5')
  })
})

describe('composeMorningBriefing — calm days', () => {
  it('renders "sin anomalías" when there are zero', () => {
    const out = composeMorningBriefing(
      baseInput({
        intelligence: tenantScanOk({
          anomaly_count: 0,
          anomaly_groups_es: [],
          recommendations: [],
          headline_es: 'evco: verde base 92% · sin anomalías.',
        }),
        anomalies: calmAnomalies(),
      }),
    )
    expect(out.text_plain).toContain('Sin anomalías detectadas')
    expect(out.degraded).toBe(false)
  })

  it('omits focus section when top_focus is empty', () => {
    const out = composeMorningBriefing(
      baseInput({
        intelligence: tenantScanOk({ top_focus_es: [] }),
      }),
    )
    expect(out.text_plain).not.toContain('SKUs a revisar')
  })
})

describe('composeMorningBriefing — degraded modes', () => {
  it('marks degraded when both responses fail', () => {
    const out = composeMorningBriefing(
      baseInput({
        intelligence: failed<TenantScanResponseEs | AnomalyOnlyResponseEs>(),
        anomalies: failed<AnomalyOnlyResponseEs>(),
      }),
    )
    expect(out.degraded).toBe(true)
    expect(out.headline_es).toMatch(/no se pudo generar/)
  })

  it('still produces a briefing when only intelligence fails', () => {
    const out = composeMorningBriefing(
      baseInput({
        intelligence: failed<TenantScanResponseEs | AnomalyOnlyResponseEs>(),
      }),
    )
    expect(out.degraded).toBe(false) // anomalies still OK
    expect(out.text_plain).toContain('anomalías')
  })
})

describe('composeMorningBriefing — safety', () => {
  it('escapes HTML entities in user-provided strings', () => {
    const intel = tenantScanOk({
      recommendations: [
        {
          priority_es: 'alta',
          action_es: '<script>alert(1)</script>',
          rationale_es: 'x',
        },
      ],
    })
    const out = composeMorningBriefing(baseInput({ intelligence: intel }))
    expect(out.text_html).not.toContain('<script>')
    expect(out.text_html).toContain('&lt;script&gt;')
  })

  it('includes internal-only footer', () => {
    const out = composeMorningBriefing(baseInput())
    expect(out.text_plain).toContain('solo interno')
    expect(out.text_plain).toContain('no enviar a clientes')
  })

  it('truncates to ≤ 4096 chars (Telegram limit)', () => {
    // Build an oversized anomaly group list to stress the truncator.
    const bigRecs = Array.from({ length: 50 }, (_, i) => ({
      priority_es: 'alta' as const,
      action_es: `Accion ${i} `.repeat(50),
      rationale_es: 'racional',
    }))
    const out = composeMorningBriefing(
      baseInput({ intelligence: tenantScanOk({ recommendations: bigRecs }) }),
    )
    expect(out.text_html.length).toBeLessThanOrEqual(4096)
    expect(out.text_plain.length).toBeLessThanOrEqual(4096)
  })
})
