import { describe, it, expect } from 'vitest'
import type { CockpitHeroKPI } from '@/components/aguila'
import { buildClientHeroTiles } from '@/lib/cockpit/quiet-season'

const standardTiles: CockpitHeroKPI[] = [
  { key: 'proximo-cruce', label: 'Próximo cruce', value: '—', tone: 'silver' },
  { key: 'entradas',      label: 'Entradas esta semana', value: 3, tone: 'silver' },
  { key: 'pedimentos',    label: 'Pedimentos listos',    value: 2, tone: 'silver' },
  { key: 'cruces',        label: 'Cruces este mes',      value: 12, tone: 'silver' },
]

describe('buildClientHeroTiles (quiet-season · v3.3 4-tile)', () => {
  it('activeCount > 0 → renders the caller-supplied standard KPI tiles unchanged', () => {
    const out = buildClientHeroTiles({
      activeCount: 3,
      standardTiles,
      successRatePct: 98,
      avgClearanceDays: 1.8,
      lastCruceIso: '2026-04-13T18:00:00Z',
      crucesThisMonth: 12,
      tmecYtdUsd: 9000,
    })
    expect(out.quietSeason).toBe(false)
    expect(out.heroKPIs).toBe(standardTiles)
    expect(out.summaryLine).toBeNull()
    expect(out.pedimentoMicroStatusOverride).toBeNull()
  })

  it('activeCount === 0 → 4-tile 2x2 grid: tasa + último cruce + volumen + liberación', () => {
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      successRatePct: 97,
      avgClearanceDays: 1.9,
      greenLightPct: 98,
      lastCruceIso: '2026-04-13T18:00:00Z',
      crucesThisMonth: 10,
      tmecYtdUsd: 12500,
    })
    expect(out.quietSeason).toBe(true)
    expect(out.heroKPIs.length).toBe(4)
    expect(out.heroKPIs.map(t => t.key)).toEqual([
      'tasa-exito', 'ultimo-cruce', 'volumen-mes', 'liberacion-inmediata',
    ])
    const tasa = out.heroKPIs[0]
    expect(tasa.label).toBe('Tasa de éxito')
    expect(String(tasa.value)).toBe('97%')
    const liberacion = out.heroKPIs[3]
    // v3.5 (2026-04-20): "Liberación inmediata" replaces "Velocidad
    // promedio". Renders as a % with a semáforo-verde sublabel.
    expect(liberacion.label).toBe('Liberación inmediata')
    expect(String(liberacion.value)).toBe('98%')
    expect(liberacion.sublabel).toMatch(/verde/)
  })

  it('activeCount === 0 + no greenLight → T-MEC fills the 4th slot', () => {
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      successRatePct: 95,
      avgClearanceDays: null,
      greenLightPct: null,
      lastCruceIso: '2026-04-13T18:00:00Z',
      crucesThisMonth: 10,
      tmecYtdUsd: 12500,
    })
    expect(out.heroKPIs.length).toBe(4)
    expect(out.heroKPIs.map(t => t.key)).toEqual([
      'tasa-exito', 'ultimo-cruce', 'volumen-mes', 'tmec-ytd',
    ])
    const tmec = out.heroKPIs[3]
    // v3.4: tmec uses compact formatter (K/M) to fit narrow mobile tiles.
    expect(String(tmec.value)).toBe('$12.5K')
    expect(tmec.sublabel).toMatch(/este año/)
  })

  it('activeCount === 0 + no greenLight + no tmec → "Historial confiable" fallback', () => {
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      successRatePct: 100,
      avgClearanceDays: null,
      greenLightPct: null,
      lastCruceIso: '2026-04-10T18:00:00Z',
      crucesThisMonth: 5,
      tmecYtdUsd: 0,
    })
    expect(out.heroKPIs.length).toBe(4)
    expect(out.heroKPIs.map(t => t.key)).toEqual([
      'tasa-exito', 'ultimo-cruce', 'volumen-mes', 'historial',
    ])
  })

  it('activeCount === 0 + no successRate data → "Operación estable" calm tile', () => {
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      successRatePct: null,
      avgClearanceDays: 2.0,
      lastCruceIso: '2026-04-10T18:00:00Z',
      crucesThisMonth: 5,
      tmecYtdUsd: 0,
    })
    const first = out.heroKPIs[0]
    expect(first.key).toBe('operacion-estable')
    // v3.4: copy tightened to fit mobile tiles without ellipsis.
    expect(String(first.value)).toBe('Al día')
    expect(first.sublabel).toMatch(/al corriente/)
  })

  it('quiet-season with no cruce history shows "Sin cruces aún" tile + no sublabel', () => {
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      successRatePct: null,
      avgClearanceDays: null,
      lastCruceIso: null,
      crucesThisMonth: 0,
      tmecYtdUsd: 0,
    })
    const ultimo = out.heroKPIs.find(t => t.key === 'ultimo-cruce')
    // v3.4: "Sin cruces" fits the narrow mobile tile without ellipsis.
    expect(ultimo?.value).toBe('Sin cruces')
    expect(ultimo?.sublabel).toBeUndefined()
  })

  it('sad-zero nav replacement: pedimentosMonthCount=0 + lastPedimentoIso → override string', () => {
    const iso = new Date(Date.now() - 5 * 86_400_000).toISOString()
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      successRatePct: 100,
      avgClearanceDays: 1.5,
      lastCruceIso: null,
      crucesThisMonth: 0,
      tmecYtdUsd: 0,
      lastPedimentoIso: iso,
      pedimentosMonthCount: 0,
    })
    expect(out.pedimentoMicroStatusOverride).toMatch(/Último pedimento · hace 5 días/)
  })

  it('sad-zero nav replacement: skipped when pedimentosMonthCount > 0', () => {
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      successRatePct: 100,
      avgClearanceDays: 1.5,
      lastCruceIso: null,
      crucesThisMonth: 0,
      tmecYtdUsd: 0,
      lastPedimentoIso: new Date().toISOString(),
      pedimentosMonthCount: 3,
    })
    expect(out.pedimentoMicroStatusOverride).toBeNull()
  })
})
