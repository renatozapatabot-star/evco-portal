import { describe, it, expect, vi } from 'vitest'
import {
  classifyProduct,
  estimateCostUsd,
  parseSelfClassifyResponse,
  pickModel,
  TEXT_MODEL,
  VISION_MODEL,
} from '../self-service'

function fakeClient(text: string, usage = { input_tokens: 100, output_tokens: 50 }) {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: 'text', text }],
        usage,
      })),
    },
  } as unknown as import('@anthropic-ai/sdk').default
}

describe('parseSelfClassifyResponse', () => {
  it('preserves dots in fracción and parses full payload', () => {
    const raw = JSON.stringify({
      fraccion: '3901.20.01',
      tmec_eligible: true,
      nom_required: ['NOM-050-SCFI'],
      confidence: 92,
      justificacion: 'Polietileno de baja densidad para inyección.',
      alternatives: [
        { fraccion: '3901.10.01', descripcion: 'PE alta densidad', confidence: 60 },
      ],
    })
    const parsed = parseSelfClassifyResponse(raw)
    expect(parsed.fraccion).toBe('3901.20.01')
    expect(parsed.tmec_eligible).toBe(true)
    expect(parsed.nom_required).toEqual(['NOM-050-SCFI'])
    expect(parsed.confidence).toBe(92)
    expect(parsed.alternatives).toHaveLength(1)
    expect(parsed.alternatives[0].fraccion).toBe('3901.10.01')
  })

  it('strips markdown fences', () => {
    const raw = '```json\n{"fraccion":"3901.20.01","confidence":80}\n```'
    expect(parseSelfClassifyResponse(raw).fraccion).toBe('3901.20.01')
  })

  it('reformats 8-digit fraccion without dots', () => {
    const raw = JSON.stringify({ fraccion: '39012001', confidence: 75 })
    expect(parseSelfClassifyResponse(raw).fraccion).toBe('3901.20.01')
  })

  it('returns null fraccion when malformed', () => {
    const raw = JSON.stringify({ fraccion: 'abc', confidence: 0 })
    expect(parseSelfClassifyResponse(raw).fraccion).toBeNull()
  })

  it('clamps confidence and converts 0-1 to 0-100', () => {
    expect(parseSelfClassifyResponse(JSON.stringify({ confidence: 0.93 })).confidence).toBe(93)
    expect(parseSelfClassifyResponse(JSON.stringify({ confidence: 250 })).confidence).toBe(100)
  })

  it('throws on non-object JSON', () => {
    expect(() => parseSelfClassifyResponse('[1,2,3]')).toThrow()
  })
})

describe('pickModel', () => {
  it('uses Haiku for text-only', () => {
    expect(pickModel({ description: 'x' })).toBe(TEXT_MODEL)
  })

  it('uses Sonnet when image attached', () => {
    expect(pickModel({ description: 'x', imageBase64: 'aGVsbG8=', imageMime: 'image/png' })).toBe(VISION_MODEL)
  })
})

describe('estimateCostUsd', () => {
  it('uses Sonnet pricing for vision model', () => {
    expect(estimateCostUsd(VISION_MODEL, 1000, 500)).toBeCloseTo(1000 * 0.003 / 1000 + 500 * 0.015 / 1000)
  })

  it('uses Haiku pricing for text model', () => {
    expect(estimateCostUsd(TEXT_MODEL, 1000, 500)).toBeCloseTo(1000 * 0.001 / 1000 + 500 * 0.005 / 1000)
  })
})

describe('classifyProduct', () => {
  it('rejects empty descriptions', async () => {
    const out = await classifyProduct({ description: 'x' })
    expect(out.error?.code).toBe('INVALID_INPUT')
  })

  it('returns parsed result with token + latency metadata', async () => {
    const client = fakeClient(JSON.stringify({ fraccion: '3901.20.01', confidence: 88 }))
    const out = await classifyProduct({ description: 'Resina PE baja densidad' }, { client })
    expect(out.error).toBeNull()
    expect(out.data?.fraccion).toBe('3901.20.01')
    expect(out.data?.model).toBe(TEXT_MODEL)
    expect(out.data?.input_tokens).toBe(100)
    expect(out.data?.output_tokens).toBe(50)
  })

  it('returns PARSE_ERROR when the response is not JSON', async () => {
    const client = fakeClient('I am not JSON')
    const out = await classifyProduct({ description: 'Resina' }, { client })
    expect(out.data).toBeNull()
    expect(out.error?.code).toBe('PARSE_ERROR')
  })

  it('switches to vision model when an image is provided', async () => {
    const client = fakeClient(JSON.stringify({ fraccion: '3901.20.01', confidence: 80 }))
    const out = await classifyProduct(
      { description: 'caja', imageBase64: 'aGVsbG8=', imageMime: 'image/png' },
      { client },
    )
    expect(out.data?.model).toBe(VISION_MODEL)
  })
})
