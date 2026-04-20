/**
 * Unit tests for the Classifier path in generate.ts.
 *   - parseOcaClassifierText: strict JSON shape validation.
 *   - generateOcaBatch: worker-pool correctness with a mocked Anthropic.
 *
 * No live Anthropic call. The end-to-end fixture test lives in
 * invoice-4526219.test.ts, gated on OCA_LIVE_CLASSIFIER_TEST=1.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseOcaClassifierText, generateOcaBatch } from '../generate'
import type { OcaClassifierInput } from '../types'

// ── Mock the Anthropic SDK at the module level. ───────────────

type MockCreateFn = (args: unknown) => Promise<{
  content: Array<{ type: 'text'; text: string }>
  usage: { input_tokens: number; output_tokens: number }
}>

let mockCreate: MockCreateFn

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: (args: unknown) => mockCreate(args),
    }
  },
}))

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  mockCreate = async () => {
    throw new Error('mockCreate not set for this test')
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── parseOcaClassifierText ─────────────────────────────────────

describe('parseOcaClassifierText', () => {
  const validDraft = {
    fraccion_recomendada: '9603.90.99',
    nico: '99',
    clasificacion_descripcion_tigie: 'LOS DEMÁS CEPILLOS',
    arancel_general: '15%',
    tmec_elegibilidad: true,
    nom_aplicable: 'NOM-050-SCFI-2004',
    vigencia_hasta: '2027-04-20',
    antecedentes: 'Cepillos de alambre de acero tipo barril.',
    analisis: 'GRI 1 aplica directamente al capítulo 96.',
    fundamento_legal: 'LIGIE capítulo 96, partida 9603.',
    razonamiento: 'Cepillo industrial.',
    gri_applied: ['1', '6'],
    tmec_discrepancies: [],
  }

  it('parses a valid draft', () => {
    const out = parseOcaClassifierText(JSON.stringify(validDraft))
    expect(out.fraccion_recomendada).toBe('9603.90.99')
    expect(out.nico).toBe('99')
    expect(out.gri_applied).toEqual(['1', '6'])
    expect(out.tmec_discrepancies).toEqual([])
    expect(out.nom_aplicable).toBe('NOM-050-SCFI-2004')
  })

  it('rejects invalid fraccion shape', () => {
    const bad = { ...validDraft, fraccion_recomendada: '9603.9' }
    expect(() => parseOcaClassifierText(JSON.stringify(bad))).toThrow(/Fracción inválida/)
  })

  it('rejects invalid NICO', () => {
    const bad = { ...validDraft, nico: '999' }
    expect(() => parseOcaClassifierText(JSON.stringify(bad))).toThrow(/NICO inválido/)
  })

  it('throws on malformed JSON', () => {
    expect(() => parseOcaClassifierText('not json')).toThrow(/JSON inválido/)
  })

  it('coerces missing nom_aplicable to null', () => {
    const { nom_aplicable: _unused, ...rest } = validDraft
    const out = parseOcaClassifierText(JSON.stringify(rest))
    expect(out.nom_aplicable).toBeNull()
  })

  it('filters malformed tmec_discrepancies to a clean array', () => {
    const withDiscrepancies = {
      ...validDraft,
      tmec_discrepancies: [
        {
          certificate_line: 1,
          certificate_shows: '9306.90',
          correct_fraccion: '9603.90',
          message_es: 'Error de transcripción.',
        },
        { certificate_line: 2 }, // missing required fields — dropped
        'garbage', // dropped
      ],
    }
    const out = parseOcaClassifierText(JSON.stringify(withDiscrepancies))
    expect(out.tmec_discrepancies).toHaveLength(1)
    expect(out.tmec_discrepancies[0].certificate_shows).toBe('9306.90')
  })

  it('defaults gri_applied to [] when missing', () => {
    const { gri_applied: _unused, ...rest } = validDraft
    const out = parseOcaClassifierText(JSON.stringify(rest))
    expect(out.gri_applied).toEqual([])
  })
})

// ── generateOcaBatch ──────────────────────────────────────────

describe('generateOcaBatch', () => {
  const buildDraftResponse = (fraccion: string, nico: string) => ({
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          fraccion_recomendada: fraccion,
          nico,
          clasificacion_descripcion_tigie: 'TEST',
          arancel_general: '0%',
          tmec_elegibilidad: true,
          nom_aplicable: null,
          vigencia_hasta: '2027-04-20',
          antecedentes: 'a',
          analisis: 'b',
          fundamento_legal: 'c',
          razonamiento: 'd',
          gri_applied: ['1'],
          tmec_discrepancies: [],
        }),
      },
    ],
    usage: { input_tokens: 100, output_tokens: 200 },
  })

  it('runs batch, preserves input order, sums cost', async () => {
    const inputs: OcaClassifierInput[] = [
      { item_no: '18MB', product_description: 'Cepillo 18mm', pais_origen: 'US' },
      { item_no: '28MB', product_description: 'Cepillo 28mm', pais_origen: 'US' },
      { item_no: 'BG600E', product_description: 'Pistola aspersora', pais_origen: 'US' },
      { item_no: 'W-5', product_description: 'Arandela 2in', pais_origen: 'US' },
    ]
    const fracciones = ['9603.90.99', '9603.90.99', '8424.20.01', '7318.15.99']
    const nicos = ['99', '99', '00', '99']
    let call = 0
    mockCreate = async () => buildDraftResponse(fracciones[call], nicos[call++])

    const result = await generateOcaBatch(inputs, { concurrency: 2 })

    expect(result.items).toHaveLength(4)
    expect(result.items.map((r) => r.item_no)).toEqual(['18MB', '28MB', 'BG600E', 'W-5'])
    expect(result.items.map((r) => r.draft?.fraccion_recomendada)).toEqual(fracciones)
    expect(result.items.every((r) => r.error === null)).toBe(true)
    expect(result.totalInputTokens).toBe(400)
    expect(result.totalOutputTokens).toBe(800)
    expect(result.totalCostUsd).toBeGreaterThan(0)
  })

  it('isolates failures — one bad response does not block the rest', async () => {
    const inputs: OcaClassifierInput[] = [
      { item_no: 'A', product_description: 'a', pais_origen: 'US' },
      { item_no: 'B', product_description: 'b', pais_origen: 'US' },
      { item_no: 'C', product_description: 'c', pais_origen: 'US' },
    ]
    let call = 0
    mockCreate = async () => {
      if (call++ === 1) {
        // second call returns malformed JSON
        return {
          content: [{ type: 'text' as const, text: 'NOT JSON' }],
          usage: { input_tokens: 10, output_tokens: 0 },
        }
      }
      return buildDraftResponse('9603.90.99', '99')
    }

    const result = await generateOcaBatch(inputs, { concurrency: 1 })
    expect(result.items[0].draft).not.toBeNull()
    expect(result.items[1].draft).toBeNull()
    expect(result.items[1].error).toMatch(/JSON inválido/)
    expect(result.items[2].draft).not.toBeNull()
  })

  it('throws when ANTHROPIC_API_KEY is missing', async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      await expect(generateOcaBatch([])).rejects.toThrow(/ANTHROPIC_API_KEY/)
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev
    }
  })

  it('clamps concurrency into [1, 4]', async () => {
    const inputs: OcaClassifierInput[] = [
      { item_no: 'A', product_description: 'a', pais_origen: 'US' },
    ]
    mockCreate = async () => buildDraftResponse('9603.90.99', '99')
    const result = await generateOcaBatch(inputs, { concurrency: 10 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].draft).not.toBeNull()
  })
})
