import { describe, it, expect } from 'vitest'
import {
  linkForTrafico,
  linkForPedimento,
  linkForEntrada,
  linkForProducto,
  linkForFraccion,
  linkForProveedor,
  linkForFactura,
} from '../entity-links'

describe('entity-links helpers', () => {
  it('returns null for null / undefined / empty string input', () => {
    expect(linkForTrafico(null)).toBeNull()
    expect(linkForTrafico(undefined)).toBeNull()
    expect(linkForTrafico('')).toBeNull()
    expect(linkForPedimento(null)).toBeNull()
    expect(linkForEntrada(null)).toBeNull()
    expect(linkForProducto(null)).toBeNull()
    expect(linkForFraccion(null)).toBeNull()
    expect(linkForProveedor(null)).toBeNull()
    expect(linkForFactura(null)).toBeNull()
  })

  it('builds trafico link under /embarques', () => {
    expect(linkForTrafico('TRF-1234')).toBe('/embarques/TRF-1234')
  })

  it('builds pedimento link under /pedimentos (new V1 detail page)', () => {
    expect(linkForPedimento('TRF-1234')).toBe('/pedimentos/TRF-1234')
  })

  it('builds entrada link under /entradas/[cve]', () => {
    expect(linkForEntrada('ENT-5678')).toBe('/entradas/ENT-5678')
  })

  it('builds producto link under /catalogo/partes/[cve]', () => {
    expect(linkForProducto('PRD-9999')).toBe('/catalogo/partes/PRD-9999')
  })

  it('builds fraccion deep-link into catalogo', () => {
    expect(linkForFraccion('3901.20.01')).toBe('/catalogo?fraccion=3901.20.01')
  })

  it('builds proveedor filter on entradas list', () => {
    expect(linkForProveedor('PRV_ABC')).toBe('/entradas?proveedor=PRV_ABC')
  })

  it('builds factura row anchor on entradas list', () => {
    expect(linkForFactura('INV-2026-042')).toBe('/entradas?q=INV-2026-042')
  })

  it('URL-encodes identifiers with special characters', () => {
    expect(linkForProducto('PRD 123 / A')).toBe('/catalogo/partes/PRD%20123%20%2F%20A')
    expect(linkForFraccion('3901.20 01')).toBe('/catalogo?fraccion=3901.20%2001')
  })
})
