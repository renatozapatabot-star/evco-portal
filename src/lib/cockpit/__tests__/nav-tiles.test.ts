import { describe, it, expect } from 'vitest'
import {
  UNIFIED_NAV_TILES,
  EMPTY_NAV_COUNTS,
  resolveNavHref,
  resolveNavTile,
  type NavTileKey,
} from '../../cockpit/nav-tiles'

describe('UNIFIED_NAV_TILES (V1 Clean Visibility · 2026-04-24)', () => {
  it('renders exactly five tiles', () => {
    expect(UNIFIED_NAV_TILES.length).toBe(5)
  })

  it('tile #1 is Entradas (shipper asks "did it arrive?" first)', () => {
    const tile = UNIFIED_NAV_TILES[0]
    expect(tile.key).toBe('entradas')
    expect(tile.label).toBe('Entradas')
    expect(tile.href).toBe('/entradas')
  })

  it('tile #2 is Pedimentos', () => {
    const tile = UNIFIED_NAV_TILES[1]
    expect(tile.key).toBe('pedimentos')
    expect(tile.label).toBe('Pedimentos')
    expect(tile.href).toBe('/pedimentos')
  })

  it('tile #3 is Expediente Digital', () => {
    const tile = UNIFIED_NAV_TILES[2]
    expect(tile.key).toBe('expedientes')
    expect(tile.label).toBe('Expediente Digital')
    expect(tile.href).toBe('/expedientes')
  })

  it('tile keys match the canonical V1 list', () => {
    const keys = UNIFIED_NAV_TILES.map((t) => t.key as NavTileKey)
    expect(keys).toEqual([
      'entradas',
      'pedimentos',
      'expedientes',
      'catalogo',
      'anexo24',
    ])
  })

  it('Contabilidad is NOT in the rendered client nav (V1 reset)', () => {
    const keys = UNIFIED_NAV_TILES.map((t) => t.key)
    expect(keys).not.toContain('contabilidad')
  })

  it('Tráficos/Embarques is NOT in the rendered client nav (reachable by cross-link)', () => {
    const keys = UNIFIED_NAV_TILES.map((t) => t.key)
    expect(keys).not.toContain('traficos')
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
  it('carries the pedimentos key with null count', () => {
    expect(EMPTY_NAV_COUNTS.pedimentos).toBeDefined()
    expect(EMPTY_NAV_COUNTS.pedimentos?.count).toBeNull()
  })

  it('keeps contabilidad key for back-compat (legacy consumers)', () => {
    expect(EMPTY_NAV_COUNTS.contabilidad).toBeDefined()
    expect(EMPTY_NAV_COUNTS.contabilidad?.count).toBeNull()
  })

  it('keeps traficos key for back-compat', () => {
    expect(EMPTY_NAV_COUNTS.traficos).toBeDefined()
  })
})

describe('resolveNavHref (V1: signature preserved, role ignored)', () => {
  const pedimentosTile = UNIFIED_NAV_TILES.find((t) => t.key === 'pedimentos')!
  const entradasTile = UNIFIED_NAV_TILES.find((t) => t.key === 'entradas')!

  it('returns tile.href regardless of role', () => {
    expect(resolveNavHref(pedimentosTile, 'client')).toBe('/pedimentos')
    expect(resolveNavHref(pedimentosTile, 'operator')).toBe('/pedimentos')
    expect(resolveNavHref(pedimentosTile, 'admin')).toBe('/pedimentos')
    expect(resolveNavHref(entradasTile, 'client')).toBe('/entradas')
  })

  it('unknown role falls back to tile.href (safe default)', () => {
    expect(resolveNavHref(pedimentosTile, 'bogus-role')).toBe('/pedimentos')
  })
})

describe('resolveNavTile (V1: returns tile unchanged)', () => {
  const pedimentosTile = UNIFIED_NAV_TILES.find((t) => t.key === 'pedimentos')!

  it('returns the tile as-declared for every role', () => {
    expect(resolveNavTile(pedimentosTile, 'client').label).toBe('Pedimentos')
    expect(resolveNavTile(pedimentosTile, 'operator').label).toBe('Pedimentos')
    expect(resolveNavTile(pedimentosTile, 'admin').label).toBe('Pedimentos')
    expect(resolveNavTile(pedimentosTile, 'broker').label).toBe('Pedimentos')
  })
})
