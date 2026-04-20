import { describe, it, expect } from 'vitest'
import {
  UNIFIED_NAV_TILES,
  EMPTY_NAV_COUNTS,
  resolveNavHref,
  type NavTileKey,
} from '../../cockpit/nav-tiles'

describe('UNIFIED_NAV_TILES (post-founder-override 2026-04-19)', () => {
  it('renders exactly six tiles', () => {
    expect(UNIFIED_NAV_TILES.length).toBe(6)
  })

  it('tile #2 is Contabilidad (was Pedimentos through 2026-04-19)', () => {
    const tile = UNIFIED_NAV_TILES[1]
    expect(tile.key).toBe('contabilidad')
    expect(tile.label).toBe('Contabilidad')
  })

  it('tile keys match the canonical post-override list', () => {
    const keys = UNIFIED_NAV_TILES.map((t) => t.key as NavTileKey)
    expect(keys).toEqual([
      'traficos',
      'contabilidad',
      'expedientes',
      'catalogo',
      'entradas',
      'anexo24',
    ])
  })

  it('every tile carries non-empty label + description + icon', () => {
    for (const t of UNIFIED_NAV_TILES) {
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
      expect(t.icon).toBeTruthy()
    }
  })
})

describe('EMPTY_NAV_COUNTS', () => {
  it('carries the contabilidad key with null count', () => {
    expect(EMPTY_NAV_COUNTS.contabilidad).toBeDefined()
    expect(EMPTY_NAV_COUNTS.contabilidad?.count).toBeNull()
  })

  it('keeps pedimentos key for back-compat (legacy consumers)', () => {
    expect(EMPTY_NAV_COUNTS.pedimentos).toBeDefined()
    expect(EMPTY_NAV_COUNTS.pedimentos?.count).toBeNull()
  })
})

describe('resolveNavHref', () => {
  const contabilidadTile = UNIFIED_NAV_TILES.find((t) => t.key === 'contabilidad')!
  const traficosTile = UNIFIED_NAV_TILES.find((t) => t.key === 'traficos')!

  it('client role routes Contabilidad to /mi-cuenta (their own A/R surface)', () => {
    expect(resolveNavHref(contabilidadTile, 'client')).toBe('/mi-cuenta')
  })

  it('operator role routes Contabilidad to /contabilidad/inicio (Anabel cockpit)', () => {
    expect(resolveNavHref(contabilidadTile, 'operator')).toBe('/contabilidad/inicio')
  })

  it('admin / broker / owner route Contabilidad to /contabilidad/inicio', () => {
    expect(resolveNavHref(contabilidadTile, 'admin')).toBe('/contabilidad/inicio')
    expect(resolveNavHref(contabilidadTile, 'broker')).toBe('/contabilidad/inicio')
    expect(resolveNavHref(contabilidadTile, 'owner')).toBe('/contabilidad/inicio')
  })

  it('non-contabilidad tiles are unaffected by role (returns tile.href as-is)', () => {
    expect(resolveNavHref(traficosTile, 'client')).toBe(traficosTile.href)
    expect(resolveNavHref(traficosTile, 'operator')).toBe(traficosTile.href)
    expect(resolveNavHref(traficosTile, 'admin')).toBe(traficosTile.href)
  })

  it('unknown role falls back to default href (safe default)', () => {
    expect(resolveNavHref(contabilidadTile, 'bogus-role')).toBe('/contabilidad/inicio')
  })
})
