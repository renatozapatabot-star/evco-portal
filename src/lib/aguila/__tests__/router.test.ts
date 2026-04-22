import { describe, it, expect } from 'vitest'
import { pickToolCandidates, filterToolsByName, ROUTER_CONSTANTS } from '../router'
import type { ToolName } from '../tools'

const { MIN_TOOLS, MAX_TOOLS } = ROUTER_CONSTANTS

describe('pickToolCandidates — topic + keyword scoring', () => {
  it('saludo returns empty tools (pure small-talk path)', () => {
    const r = pickToolCandidates('hola!', 'client', 'saludo')
    expect(r.tools).toEqual([])
    expect(r.topic).toBe('saludo')
  })

  it('pregunta_pedimento + full SAT pedimento number → pedimento-cluster wins', () => {
    const r = pickToolCandidates(
      '¿cómo va el pedimento 26 24 3596 6500441?',
      'operator',
      'pregunta_pedimento',
    )
    expect(r.tools).toContain('analyze_pedimento')
    expect(r.tools).toContain('validate_pedimento')
    expect(r.tools).toContain('query_pedimentos')
    expect(r.matched_keywords).toContain('pedimento_number')
  })

  it('duda_documento → find_missing_documents + query_expedientes promoted', () => {
    const r = pickToolCandidates(
      '¿qué documentos me faltan para Y-1234?',
      'operator',
      'duda_documento',
    )
    expect(r.tools).toContain('find_missing_documents')
    expect(r.tools).toContain('query_expedientes')
    expect(r.tools).toContain('analyze_trafico') // from Y-1234 id pattern
    expect(r.matched_keywords).toContain('documentos')
    expect(r.matched_keywords).toContain('trafico_id')
  })

  it('classification question pulls in suggest_clasificacion', () => {
    const r = pickToolCandidates(
      '¿qué fracción arancelaria le corresponde al polipropileno?',
      'client',
      'otro',
    )
    expect(r.tools).toContain('suggest_clasificacion')
    expect(r.matched_keywords).toContain('clasificación')
  })

  it('T-MEC question surfaces check_tmec_eligibility', () => {
    const r = pickToolCandidates(
      '¿aplica T-MEC para polipropileno de USA?',
      'client',
      'otro',
    )
    expect(r.tools).toContain('check_tmec_eligibility')
    expect(r.matched_keywords).toContain('t-mec')
  })

  it('supplier term surfaces search_supplier_history', () => {
    const r = pickToolCandidates('dame el historial del proveedor Duratech', 'broker', 'otro')
    expect(r.tools).toContain('search_supplier_history')
    expect(r.matched_keywords).toContain('proveedor')
  })

  it('@mention adds route_mention to the cluster', () => {
    const r = pickToolCandidates(
      '@anabel revisa este cruce',
      'operator',
      'escalacion',
    )
    expect(r.tools).toContain('route_mention')
    expect(r.matched_keywords).toContain('@mention')
  })

  it('panorama query routes to intelligence_scan', () => {
    const r = pickToolCandidates(
      '¿cómo está la operación esta semana?',
      'broker',
      'otro',
    )
    expect(r.tools).toContain('intelligence_scan')
    expect(r.matched_keywords).toContain('panorama')
  })
})

describe('pickToolCandidates — role gates', () => {
  it('client role: query_financiero NEVER appears even with financial keywords', () => {
    const r = pickToolCandidates(
      '¿cuál es mi saldo de facturación?',
      'client',
      'pregunta_financiera',
    )
    expect(r.tools).not.toContain('query_financiero')
    // Role-gated — financial topic yields a padded baseline instead.
    expect(r.tools.length).toBeGreaterThanOrEqual(MIN_TOOLS)
  })

  it('broker role: query_financiero is included for financial question', () => {
    const r = pickToolCandidates(
      '¿cuál es el saldo de EVCO?',
      'broker',
      'pregunta_financiera',
    )
    expect(r.tools).toContain('query_financiero')
  })

  it('contabilidad role: query_financiero allowed', () => {
    const r = pickToolCandidates('dame la CxC del mes', 'contabilidad', 'pregunta_financiera')
    expect(r.tools).toContain('query_financiero')
  })

  it('warehouse role: query_financiero blocked (not in canSeeFinance list)', () => {
    const r = pickToolCandidates(
      'CxC del mes',
      'warehouse',
      'pregunta_financiera',
    )
    expect(r.tools).not.toContain('query_financiero')
  })
})

describe('pickToolCandidates — floors and caps', () => {
  it('empty question + unknown topic → pads to at least MIN_TOOLS from baseline', () => {
    const r = pickToolCandidates('', 'client', null)
    expect(r.tools.length).toBeGreaterThanOrEqual(MIN_TOOLS)
    expect(r.tools).toEqual(expect.arrayContaining(['query_traficos', 'query_pedimentos']))
    expect(r.reason_es).toContain('baseline')
  })

  it('hallucinated topic from classifier is treated as null, still pads baseline', () => {
    const r = pickToolCandidates('asdf', 'client', 'topic_does_not_exist')
    expect(r.topic).toBeNull()
    expect(r.tools.length).toBeGreaterThanOrEqual(MIN_TOOLS)
  })

  it('lots of matches: capped at MAX_TOOLS', () => {
    // Pack every keyword pattern we can into one question.
    const r = pickToolCandidates(
      'prepara un borrador de alerta: proveedor Duratech, fracción 3901.20.01, T-MEC, revisa IVA del pedimento 26 24 3596 6500441 para Y-1234 @anabel panorama',
      'broker',
      'pregunta_pedimento',
    )
    expect(r.tools.length).toBeLessThanOrEqual(MAX_TOOLS)
    expect(r.tools.length).toBeGreaterThanOrEqual(MIN_TOOLS)
  })

  it('no duplicates in the returned list', () => {
    const r = pickToolCandidates(
      'pedimento 26 24 3596 6500441 proveedor Duratech fracción',
      'broker',
      'pregunta_pedimento',
    )
    const unique = new Set(r.tools)
    expect(unique.size).toBe(r.tools.length)
  })

  it('token-savings smoke: typical question routes to ≤5 vs 17 total', () => {
    const r = pickToolCandidates(
      '¿me falta algún documento para Y-1234?',
      'client',
      'duda_documento',
    )
    expect(r.tools.length).toBeLessThanOrEqual(5)
    // Sanity: well below 17 — the whole point of the router.
    expect(r.tools.length).toBeLessThan(17)
  })
})

describe('filterToolsByName', () => {
  const defs = [
    { name: 'query_traficos', description: 'A' },
    { name: 'query_pedimentos', description: 'B' },
    { name: 'analyze_trafico', description: 'C' },
    { name: 'intelligence_scan', description: 'D' },
  ]

  it('returns only the requested subset', () => {
    const filtered = filterToolsByName(defs, ['query_traficos', 'intelligence_scan'] as ToolName[])
    expect(filtered.map(d => d.name)).toEqual(['query_traficos', 'intelligence_scan'])
  })

  it('empty names → empty result', () => {
    expect(filterToolsByName(defs, [])).toEqual([])
  })

  it('unknown names silently skipped (does not throw)', () => {
    const filtered = filterToolsByName(defs, ['query_traficos', 'not_a_tool' as ToolName])
    expect(filtered).toHaveLength(1)
  })

  it('preserves the input order of definitions (not the name list)', () => {
    const filtered = filterToolsByName(defs, ['intelligence_scan', 'query_traficos'] as ToolName[])
    // defs order places query_traficos first, intelligence_scan last
    expect(filtered.map(d => d.name)).toEqual(['query_traficos', 'intelligence_scan'])
  })
})
