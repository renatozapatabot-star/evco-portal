import { describe, it, expect } from 'vitest'
import type { CockpitHeroKPI } from '@/components/aguila'
import { buildClientHeroTiles } from '@/lib/cockpit/quiet-season'

const standardTiles: CockpitHeroKPI[] = [
  { key: 'proximo-cruce', label: 'Próximo cruce', value: '—', tone: 'silver' },
  { key: 'entradas',      label: 'Entradas esta semana', value: 3, tone: 'silver' },
  { key: 'pedimentos',    label: 'Pedimentos listos',    value: 2, tone: 'silver' },
  { key: 'cruces',        label: 'Cruces este mes',      value: 12, tone: 'silver' },
]

describe('buildClientHeroTiles (quiet-season)', () => {
  it('activeCount > 0 → renders the caller-supplied standard KPI tiles unchanged', () => {
    const out = buildClientHeroTiles({
      activeCount: 3,
      standardTiles,
      daysSinceLastIncident: 30,
      lastCruceIso: '2026-04-13T18:00:00Z',
      crucesThisMonth: 12,
      tmecYtdUsd: 9000,
    })
    expect(out.quietSeason).toBe(false)
    expect(out.heroKPIs).toBe(standardTiles)
    expect(out.summaryLine).toBeNull()
    expect(out.pedimentoMicroStatusOverride).toBeNull()
  })

  it('activeCount === 0 → renders 4 quiet-season tiles when T-MEC YTD > 0', () => {
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      daysSinceLastIncident: 45,
      lastCruceIso: '2026-04-13T18:00:00Z',
      crucesThisMonth: 10,
      tmecYtdUsd: 12500,
    })
    expect(out.quietSeason).toBe(true)
    expect(out.heroKPIs.length).toBe(4)
    expect(out.heroKPIs.map(t => t.key)).toEqual([
      'operacion-estable', 'ultimo-cruce', 'volumen-mes', 'tmec-ytd',
    ])
    const operacion = out.heroKPIs[0]
    expect(operacion.label).toBe('Días sin incidencias')
    expect(operacion.value).toBe(45)
    // Último cruce tile now splits into value (relative) + sublabel (absolute)
    const ultimo = out.heroKPIs[1]
    expect(typeof ultimo.value).toBe('string')
    expect(String(ultimo.value)).toMatch(/^hace \d+ días?$|^hoy$/)
    expect(typeof ultimo.sublabel).toBe('string')
    expect(ultimo.sublabel?.length ?? 0).toBeGreaterThan(0)
    const tmec = out.heroKPIs[3]
    expect(String(tmec.value)).toMatch(/^\$12,500 USD$/)
    expect(out.summaryLine).toMatch(/al corriente/)
  })

  it('activeCount === 0 + tmecYtdUsd === 0 → drops T-MEC tile, 3 tiles total', () => {
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      daysSinceLastIncident: 30,
      lastCruceIso: '2026-04-10T18:00:00Z',
      crucesThisMonth: 5,
      tmecYtdUsd: 0,
    })
    expect(out.quietSeason).toBe(true)
    expect(out.heroKPIs.length).toBe(3)
    expect(out.heroKPIs.find(t => t.key === 'tmec-ytd')).toBeUndefined()
  })

  it('activeCount === 0 + tmecYtdUsd === null → drops T-MEC tile', () => {
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      daysSinceLastIncident: 10,
      lastCruceIso: '2026-04-10T18:00:00Z',
      crucesThisMonth: 5,
      tmecYtdUsd: null,
    })
    expect(out.heroKPIs.length).toBe(3)
  })

  it('quiet-season with no cruce history shows "Sin cruces aún" tile + no sublabel', () => {
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      daysSinceLastIncident: 0,
      lastCruceIso: null,
      crucesThisMonth: 0,
      tmecYtdUsd: 0,
    })
    const ultimo = out.heroKPIs.find(t => t.key === 'ultimo-cruce')
    expect(ultimo?.value).toBe('Sin cruces aún')
    expect(ultimo?.sublabel).toBeUndefined()
  })

  it('sad-zero nav replacement: pedimentosMonthCount=0 + lastPedimentoIso → override string', () => {
    const iso = new Date(Date.now() - 5 * 86_400_000).toISOString()
    const out = buildClientHeroTiles({
      activeCount: 0,
      standardTiles,
      daysSinceLastIncident: 30,
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
      daysSinceLastIncident: 30,
      lastCruceIso: null,
      crucesThisMonth: 0,
      tmecYtdUsd: 0,
      lastPedimentoIso: new Date().toISOString(),
      pedimentosMonthCount: 3,
    })
    expect(out.pedimentoMicroStatusOverride).toBeNull()
  })
})
