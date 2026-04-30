import { describe, it, expect, vi } from 'vitest'
import {
  draftMensajeria,
  suggestMessageType,
  type DraftRequest,
} from '../draft-composer'
import {
  personalizeDraft,
  toneGuard,
  MESSAGE_TYPE_LABEL_ES,
} from '../templates'
import * as fullInsightModule from '@/lib/intelligence/full-insight'
import * as decisionLogModule from '@/lib/intelligence/decision-log'
import type { FullCrossingInsight } from '@/lib/intelligence/full-insight'

// ── Fixtures ──────────────────────────────────────────────────────

function mkInsight(overrides: Partial<FullCrossingInsight> = {}): FullCrossingInsight {
  const base: FullCrossingInsight = {
    target: { type: 'trafico', traficoId: 'T-1' },
    cve_producto: 'SKU-HOT',
    generated_at: '2026-04-22T00:00:00Z',
    company_id: 'evco',
    signals: {
      prediction: {
        cve_producto: 'SKU-HOT',
        probability: 0.6,
        band: 'low',
        summary: 'Probabilidad 60%',
        factors: [
          { factor: 'streak_break', delta_pp: -15, detail: 'Racha reciente rota (-15 pp)' },
        ],
        baseline_pct: 85,
        cve_proveedor: 'PRV_1',
        last_fecha_cruce: '2026-04-20T00:00:00Z',
        total_crossings: 5,
      },
      streak: {
        cve_producto: 'SKU-HOT',
        current_verde_streak: 0,
        longest_verde_streak: 3,
        just_broke_streak: true,
        last_semaforo: 1,
        last_fecha_cruce: '2026-04-20T00:00:00Z',
        total_crossings: 5,
      },
      proveedor: null,
      fraccionHealth: null,
      baselinePct: 85,
      fraccion: '3903.20.01',
    },
    explanation: {
      headline: 'Probabilidad 60%',
      confidence_band_label: 'baja',
      confidence_band_en: 'low',
      probability_pct: 60,
      bullets: [
        {
          kind: 'streak_break',
          signed_delta: -15,
          label: 'Racha reciente rota (-15 pp)',
          tone: 'negative',
        },
      ],
      meta: '',
    },
    one_line: 'SKU-HOT · 60% verde',
    plain_text: 'x',
    recommendations: [
      {
        kind: 'prioritize_rojo_review',
        priority: 'high',
        subject: 'SKU-HOT',
        action_es: 'Prepara documentación de SKU-HOT antes del cruce.',
        rationale_es: 'Racha rota.',
        metadata: {},
      },
    ],
    summary_es: 'Tráfico T-1 · 60% verde · prepara docs.',
  }
  return { ...base, ...overrides }
}

// ── templates: personalizeDraft — per-template render ────────────

describe('personalizeDraft — preventive_alert (client)', () => {
  it('renders calm Spanish body with Renato Zapata & Company sender', () => {
    const draft = personalizeDraft({
      type: 'preventive_alert',
      cve_producto: 'SKU-HOT',
      product_name: 'Granular de polietileno',
      trafico_id: 'T-1',
      probability_pct: 95,
      short_reason_es: 'racha de 5 verdes consecutivos',
    })
    expect(draft.audience).toBe('client')
    expect(draft.subject_es).toContain('Granular de polietileno')
    expect(draft.body_es).toContain('Granular de polietileno')
    expect(draft.body_es).toContain('95%')
    expect(draft.body_es).toContain('Renato Zapata & Company')
    expect(draft.body_es).toMatch(/Todo marcha según lo previsto/)
    // Calm tone — no urgency markers.
    expect(draft.body_es).not.toMatch(/urgente|VENCIDO|!!/)
  })

  it('falls back to cve_producto when product_name is empty', () => {
    const draft = personalizeDraft({
      type: 'preventive_alert',
      cve_producto: 'SKU-RAW',
      probability_pct: 80,
    })
    expect(draft.subject_es).toContain('SKU-RAW')
    expect(draft.body_es).toContain('SKU-RAW')
  })
})

describe('personalizeDraft — document_request (client)', () => {
  it('renders bulleted doc list + reason', () => {
    const draft = personalizeDraft({
      type: 'document_request',
      cve_producto: 'SKU-A',
      trafico_id: 'T-1',
      requested_docs_es: ['factura comercial firmada', 'certificado de origen'],
      reason_es: 'para asegurar cruce verde',
    })
    expect(draft.audience).toBe('client')
    expect(draft.body_es).toContain('• factura comercial firmada')
    expect(draft.body_es).toContain('• certificado de origen')
    expect(draft.body_es).toContain('Motivo:')
    expect(draft.body_es).toContain('Renato Zapata & Company')
  })

  it('handles empty doc list gracefully', () => {
    const draft = personalizeDraft({
      type: 'document_request',
      cve_producto: 'SKU-A',
      requested_docs_es: [],
    })
    expect(draft.body_es).toContain('documentación complementaria')
  })
})

describe('personalizeDraft — status_update (client)', () => {
  it('includes pedimento number + status + optional schedule', () => {
    const draft = personalizeDraft({
      type: 'status_update',
      pedimento_number: '26 24 3596 6500441',
      status_es: 'Cruzado',
      trafico_id: 'T-1',
      fecha_programada: '23 abr 14:30 CT',
    })
    expect(draft.audience).toBe('client')
    expect(draft.subject_es).toContain('26 24 3596 6500441')
    expect(draft.body_es).toContain('26 24 3596 6500441')
    expect(draft.body_es).toContain('Cruzado')
    expect(draft.body_es).toContain('23 abr 14:30 CT')
    expect(draft.body_es).toContain('Renato Zapata & Company')
  })

  it('omits schedule line when fecha_programada missing', () => {
    const draft = personalizeDraft({
      type: 'status_update',
      pedimento_number: '26 24 3596 6500441',
      status_es: 'En proceso',
    })
    expect(draft.body_es).not.toContain('Próximo evento programado')
  })
})

describe('personalizeDraft — anomaly_escalation (internal)', () => {
  it('renders internal heads-up with score + action', () => {
    const draft = personalizeDraft({
      type: 'anomaly_escalation',
      anomaly_kind: 'new_proveedor',
      anomaly_label_es: 'Proveedor nuevo',
      subject: 'PRV_NEW',
      detail_es: 'Primer cruce observado',
      score: 0.7,
      action_es: 'Valida RFC antes de escalar volumen.',
    })
    expect(draft.audience).toBe('internal')
    expect(draft.subject_es).toContain('Proveedor nuevo')
    expect(draft.subject_es).toContain('PRV_NEW')
    expect(draft.body_es).toContain('Score: 70/100')
    expect(draft.body_es).toContain('Valida RFC')
    // Internal — NOT sent to clients, so no brand sender required.
    expect(draft.body_es).not.toContain('Renato Zapata & Company')
  })

  it('falls back to generic recommendation when action_es missing', () => {
    const draft = personalizeDraft({
      type: 'anomaly_escalation',
      anomaly_kind: 'volume_spike',
      anomaly_label_es: 'Salto de volumen',
      subject: 'SKU-X',
      detail_es: '3x volumen semanal',
      score: 0.5,
    })
    expect(draft.body_es).toMatch(/Recomendación:/)
  })

  it('clamps score > 1 to 100', () => {
    const draft = personalizeDraft({
      type: 'anomaly_escalation',
      anomaly_kind: 'x',
      anomaly_label_es: 'x',
      subject: 'y',
      detail_es: 'z',
      score: 2.5,
    })
    expect(draft.body_es).toContain('Score: 100/100')
  })
})

describe('personalizeDraft — driver_dispatch', () => {
  it('renders short imperative dispatch with lane + ETA', () => {
    const draft = personalizeDraft({
      type: 'driver_dispatch',
      driver_name: 'Juan Pérez',
      trafico_id: 'T-1',
      bridge_label_es: 'Puente II',
      lane_label_es: 'Carril 7',
      eta_hhmm: '14:30',
      docs_status_es: 'completas',
    })
    expect(draft.audience).toBe('driver')
    expect(draft.body_es).toContain('Juan Pérez')
    expect(draft.body_es).toContain('Puente II')
    expect(draft.body_es).toContain('Carril 7')
    expect(draft.body_es).toContain('Docs: completas')
    expect(draft.body_es).toContain('ETA 14:30')
    expect(draft.body_es).toContain('Confirma recepción')
  })

  it('warns on pending docs', () => {
    const draft = personalizeDraft({
      type: 'driver_dispatch',
      driver_name: 'x',
      trafico_id: 'T-2',
      bridge_label_es: 'P',
      lane_label_es: 'L',
      eta_hhmm: '00:00',
      docs_status_es: 'pendientes',
    })
    expect(draft.body_es).toContain('confirma antes de arrancar')
  })
})

// ── toneGuard ─────────────────────────────────────────────────────

describe('toneGuard', () => {
  it('returns empty array for a calm client draft', () => {
    const draft = personalizeDraft({
      type: 'preventive_alert',
      cve_producto: 'x',
      probability_pct: 90,
    })
    expect(toneGuard(draft)).toEqual([])
  })

  it('flags denylist strings in client bodies', () => {
    const draft = personalizeDraft({
      type: 'document_request',
      cve_producto: 'x',
      requested_docs_es: ['factura'],
      reason_es: 'es URGENTE tener estos documentos',
    })
    const issues = toneGuard(draft)
    expect(issues.some((i) => i.includes('urgente'))).toBe(true)
  })

  it('flags ALL-CAPS shouting on client copy', () => {
    const draft = personalizeDraft({
      type: 'preventive_alert',
      cve_producto: 'x',
      probability_pct: 80,
      product_name: 'ATENCIÓN INMEDIATA REQUERIDA',
    })
    const issues = toneGuard(draft)
    expect(issues.some((i) => i.includes('allcaps'))).toBe(true)
  })

  it('does not run on internal drafts (full palette allowed)', () => {
    const draft = personalizeDraft({
      type: 'anomaly_escalation',
      anomaly_kind: 'x',
      anomaly_label_es: 'x',
      subject: 'X',
      detail_es: 'URGENTE: cliente reportó VENCIDO con sistema',
      score: 0.8,
    })
    expect(toneGuard(draft)).toEqual([])
  })
})

// ── suggestMessageType ────────────────────────────────────────────

describe('suggestMessageType — rule routing', () => {
  it('driver context wins over everything else', () => {
    const s = suggestMessageType({
      has_driver_context: true,
      band_es: 'baja',
      anomaly_kind: 'new_proveedor',
    })
    expect(s?.type).toBe('driver_dispatch')
    expect(s?.audience).toBe('driver')
  })

  it('status transition routes to status_update', () => {
    const s = suggestMessageType({ has_status_transition: true })
    expect(s?.type).toBe('status_update')
    expect(s?.audience).toBe('client')
  })

  it('anomaly routes to internal escalation', () => {
    const s = suggestMessageType({ anomaly_kind: 'volume_spike' })
    expect(s?.type).toBe('anomaly_escalation')
    expect(s?.audience).toBe('internal')
  })

  it('missing docs routes to document_request', () => {
    const s = suggestMessageType({ missing_docs: true, band_es: 'baja' })
    expect(s?.type).toBe('document_request')
    expect(s?.audience).toBe('client')
  })

  it('low band (without missing docs) routes to preventive_alert', () => {
    const s = suggestMessageType({ band_es: 'baja' })
    expect(s?.type).toBe('preventive_alert')
  })

  it('broken streak also routes to preventive_alert', () => {
    const s = suggestMessageType({ just_broke_streak: true })
    expect(s?.type).toBe('preventive_alert')
  })

  it('high-priority rec kinds route to preventive_alert as fallback', () => {
    const s = suggestMessageType({
      top_recommendation_kind: 'prioritize_rojo_review',
    })
    expect(s?.type).toBe('preventive_alert')
  })

  it('returns null when no rule fires', () => {
    expect(suggestMessageType({})).toBeNull()
    expect(suggestMessageType({ band_es: 'alta' })).toBeNull()
  })
})

// ── draftMensajeria — orchestrator tests ─────────────────────────

describe('draftMensajeria — envelope + validation', () => {
  it('rejects empty companyId', async () => {
    const out = await draftMensajeria({} as never, '', {
      kind: 'trafico',
      traficoId: 'T-1',
    })
    expect(out.success).toBe(false)
    expect(out.error).toBe('invalid_companyId')
  })

  it('returns success=false with structured error on unexpected throw', async () => {
    const spy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockRejectedValue(new Error('db_boom'))
    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'trafico',
      traficoId: 'T-1',
    })
    expect(out.success).toBe(false)
    expect(out.error).toContain('db_boom')
    spy.mockRestore()
  })

  it('returns no-signal envelope when insight is null', async () => {
    const spy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(null)
    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'trafico',
      traficoId: 'T-GHOST',
    })
    expect(out.success).toBe(true)
    expect(out.data).toBeNull()
    expect(out.error).toMatch(/señal insuficiente/)
    spy.mockRestore()
  })
})

describe('draftMensajeria — bindings escape hatch', () => {
  it('renders exact bindings without fetching', async () => {
    // No fullInsight mock — if it tried to fetch the test would fail
    // because the supabase stub is empty.
    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'bindings',
      bindings: {
        type: 'preventive_alert',
        cve_producto: 'SKU-DIRECT',
        probability_pct: 99,
      },
    })
    expect(out.success).toBe(true)
    expect(out.data!.draft.subject_es).toContain('SKU-DIRECT')
    expect(out.data!.message_type).toBe('preventive_alert')
    expect(out.data!.message_type_label_es).toBe(
      MESSAGE_TYPE_LABEL_ES.preventive_alert,
    )
    expect(out.data!.tone_issues).toEqual([])
  })
})

describe('draftMensajeria — status + driver + anomaly short paths', () => {
  it('status kind renders from request alone (no fetch)', async () => {
    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'status',
      pedimento_number: '26 24 3596 6500441',
      status_es: 'Cruzado',
      trafico_id: 'T-1',
    })
    expect(out.success).toBe(true)
    expect(out.data!.draft.body_es).toContain('Cruzado')
    expect(out.data!.message_type).toBe('status_update')
    expect(out.data!.audience).toBe('client')
  })

  it('driver kind renders from request alone', async () => {
    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'driver',
      dispatch: {
        driver_name: 'Juan',
        trafico_id: 'T-3',
        bridge_label_es: 'Puente II',
        lane_label_es: 'Carril 3',
        eta_hhmm: '08:00',
        docs_status_es: 'completas',
      },
    })
    expect(out.success).toBe(true)
    expect(out.data!.audience).toBe('driver')
    expect(out.data!.draft.body_es).toContain('Juan')
  })

  it('anomaly kind routes to internal escalation', async () => {
    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'anomaly',
      anomaly: {
        kind: 'new_proveedor',
        subject: 'PRV_NEW',
        detail_es: 'Primer cruce observado',
        score: 0.6,
      },
    })
    expect(out.success).toBe(true)
    expect(out.data!.audience).toBe('internal')
    expect(out.data!.draft.body_es).toContain('Proveedor nuevo')
    expect(out.data!.draft.body_es).toContain('PRV_NEW')
  })
})

describe('draftMensajeria — trafico path uses buildFullCrossingInsight', () => {
  it('low-band trafico composes preventive_alert with probability', async () => {
    const spy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(mkInsight())
    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'trafico',
      traficoId: 'T-1',
      productName: 'Granular',
    })
    expect(out.success).toBe(true)
    expect(out.data!.message_type).toBe('preventive_alert')
    expect(out.data!.draft.body_es).toContain('Granular')
    expect(out.data!.draft.body_es).toContain('60%')
    expect(out.data!.suggestion_rationale_es).toMatch(
      /Probabilidad verde baja/,
    )
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it('missing-docs factor routes to document_request', async () => {
    const insight = mkInsight()
    insight.signals.prediction.factors = [
      { factor: 'fraccion_risk', delta_pp: -10, detail: 'falta factura comercial' },
    ]
    insight.explanation.bullets = [
      {
        kind: 'fraccion_risk',
        signed_delta: -10,
        label: 'falta factura comercial',
        tone: 'negative',
      },
    ]
    const spy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(insight)
    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'trafico',
      traficoId: 'T-1',
    })
    expect(out.success).toBe(true)
    expect(out.data!.message_type).toBe('document_request')
    expect(out.data!.draft.body_es).toContain('• factura comercial')
    spy.mockRestore()
  })

  it('messageType override wins over suggestion', async () => {
    const spy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(mkInsight())
    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'trafico',
      traficoId: 'T-1',
      messageType: 'anomaly_escalation',
    })
    expect(out.success).toBe(true)
    expect(out.data!.message_type).toBe('anomaly_escalation')
    expect(out.data!.audience).toBe('internal')
    spy.mockRestore()
  })
})

describe('draftMensajeria — logger integration', () => {
  it('logs a clean draft via withDecisionLog on the happy path', async () => {
    const insightSpy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(mkInsight())
    const logSpy = vi
      .spyOn(decisionLogModule, 'withDecisionLog')
      .mockImplementation(async (_sb, _ctx, fn) => fn())

    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'trafico',
      traficoId: 'T-1',
    })
    expect(out.success).toBe(true)
    expect(logSpy).toHaveBeenCalledOnce()
    const ctx = logSpy.mock.calls[0][1] as { toolName: string; workflow: string }
    expect(ctx.toolName).toBe('draft_mensajeria')
    expect(ctx.workflow).toBe('mensajeria_draft')

    insightSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('tone-issue draft writes a minimal blocked row instead', async () => {
    const insight = mkInsight()
    const logSpy = vi
      .spyOn(decisionLogModule, 'withDecisionLog')
      .mockImplementation(async (_sb, _ctx, fn) => fn())
    const minimalSpy = vi
      .spyOn(decisionLogModule, 'logDecision')
      .mockResolvedValue('dec-blocked')
    const insightSpy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(insight)

    const out = await draftMensajeria({} as never, 'evco', {
      kind: 'trafico',
      traficoId: 'T-1',
      productName: 'ATENCIÓN URGENTE REQUERIDA', // triggers ALL-CAPS + urgente
    })
    expect(out.success).toBe(true)
    expect(out.data!.tone_issues.length).toBeGreaterThan(0)
    // withDecisionLog skipped; logDecision (minimal) called.
    expect(logSpy).not.toHaveBeenCalled()
    expect(minimalSpy).toHaveBeenCalledOnce()
    expect(out.data!.decision_log_id).toBe('dec-blocked')

    insightSpy.mockRestore()
    logSpy.mockRestore()
    minimalSpy.mockRestore()
  })

  it('logToneIssues: true still writes via withDecisionLog on tone issues', async () => {
    const insight = mkInsight()
    const logSpy = vi
      .spyOn(decisionLogModule, 'withDecisionLog')
      .mockImplementation(async (_sb, _ctx, fn) => fn())
    const insightSpy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(insight)

    const out = await draftMensajeria(
      {} as never,
      'evco',
      {
        kind: 'trafico',
        traficoId: 'T-1',
        productName: 'URGENTE REVIEW',
      },
      { logToneIssues: true },
    )
    expect(out.success).toBe(true)
    expect(logSpy).toHaveBeenCalledOnce()

    insightSpy.mockRestore()
    logSpy.mockRestore()
  })
})
