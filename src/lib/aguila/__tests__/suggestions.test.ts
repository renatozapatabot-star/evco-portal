import { describe, it, expect } from 'vitest'
import { deriveSuggestions, SUGGESTION_CONSTANTS, DEFAULT_SUGGESTION_ES } from '../suggestions'
import type { ToolName } from '../tools'

const { MAX_SUGGESTIONS } = SUGGESTION_CONSTANTS

describe('deriveSuggestions', () => {
  it('returns [] on fallback (don\'t prompt a broken system)', () => {
    const r = deriveSuggestions({
      toolsCalled: ['query_traficos'] as ToolName[],
      topicClass: 'estatus_trafico',
      hasFallback: true,
    })
    expect(r).toEqual([])
  })

  it('returns [] on pure saludo with no tools (greetings don\'t need a follow-up pill)', () => {
    const r = deriveSuggestions({ toolsCalled: [], topicClass: 'saludo', hasFallback: false })
    expect(r).toEqual([])
  })

  it('analyze_trafico prompts the documents follow-up', () => {
    const r = deriveSuggestions({
      toolsCalled: ['analyze_trafico'] as ToolName[],
      topicClass: 'estatus_trafico',
      hasFallback: false,
    })
    expect(r).toContain('¿Revisamos los documentos faltantes?')
  })

  it('check_tmec_eligibility prompts the YTD savings follow-up', () => {
    const r = deriveSuggestions({
      toolsCalled: ['check_tmec_eligibility'] as ToolName[],
      topicClass: 'otro',
      hasFallback: false,
    })
    expect(r).toContain('¿Calculamos el ahorro acumulado YTD?')
  })

  it('falls back to topic-based suggestion when no tool prompt matched', () => {
    const r = deriveSuggestions({
      toolsCalled: [],
      topicClass: 'pregunta_financiera',
      hasFallback: false,
    })
    expect(r).toEqual(['¿Revisamos la CxC del mes?'])
  })

  it('falls back to the default catch-all on unknown topic', () => {
    const r = deriveSuggestions({
      toolsCalled: [],
      topicClass: null,
      hasFallback: false,
    })
    expect(r).toEqual([DEFAULT_SUGGESTION_ES])
  })

  it('caps at MAX_SUGGESTIONS even when many tools fired', () => {
    const r = deriveSuggestions({
      toolsCalled: [
        'analyze_trafico', 'analyze_pedimento', 'check_tmec_eligibility',
        'suggest_clasificacion', 'search_supplier_history', 'find_missing_documents',
      ] as ToolName[],
      topicClass: 'otro',
      hasFallback: false,
    })
    expect(r.length).toBeLessThanOrEqual(MAX_SUGGESTIONS)
    expect(r.length).toBeGreaterThan(0)
  })

  it('deduplicates if the same suggestion would fire twice', () => {
    const r = deriveSuggestions({
      toolsCalled: ['analyze_trafico', 'analyze_trafico'] as ToolName[],
      topicClass: 'estatus_trafico',
      hasFallback: false,
    })
    const counts = new Map<string, number>()
    for (const s of r) counts.set(s, (counts.get(s) ?? 0) + 1)
    for (const v of counts.values()) expect(v).toBe(1)
  })

  it('priority order: analyze_trafico comes before query_traficos when both fired', () => {
    const r = deriveSuggestions({
      toolsCalled: ['query_traficos', 'analyze_trafico'] as ToolName[],
      topicClass: 'estatus_trafico',
      hasFallback: false,
    })
    const aIdx = r.indexOf('¿Revisamos los documentos faltantes?')
    const qIdx = r.indexOf('¿Te muestro los próximos cruces?')
    // If both are present, analyze_trafico's suggestion lands first.
    if (aIdx !== -1 && qIdx !== -1) expect(aIdx).toBeLessThan(qIdx)
    // At minimum, analyze_trafico's prompt is included.
    expect(aIdx).toBeGreaterThanOrEqual(0)
  })
})
