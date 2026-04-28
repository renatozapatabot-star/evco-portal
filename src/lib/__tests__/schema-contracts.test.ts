import { describe, it, expect } from 'vitest'
import {
  col,
  cols,
  realColumns,
  TRAFICOS_COLUMNS,
  GLOBALPC_PARTIDAS_COLUMNS,
  GLOBALPC_FACTURAS_COLUMNS,
  GLOBALPC_PRODUCTOS_COLUMNS,
  GLOBALPC_PROVEEDORES_COLUMNS,
  COMPANIES_COLUMNS,
  EXPEDIENTE_DOCUMENTOS_COLUMNS,
  ENTRADAS_COLUMNS,
} from '../schema-contracts'

/**
 * Schema contract regression fence.
 *
 * These tests lock the real-column tuples. Any drift here means the
 * live Supabase schema changed — verify with a fresh
 * `scripts/_m16-crosslink-audit.mjs` run before updating the tuples,
 * and always pair a schema migration with the matching contract edit.
 *
 * The M16 phantom-column paydown (63 → 0 sites) concluded when these
 * contracts were authoritative. Keep them authoritative.
 */

describe('schema-contracts · real-column tuples (M16 lock)', () => {
  it('traficos has 42 real columns (post-M16)', () => {
    expect(TRAFICOS_COLUMNS.length).toBe(42)
    expect(TRAFICOS_COLUMNS).toContain('trafico')
    expect(TRAFICOS_COLUMNS).toContain('pedimento')
    expect(TRAFICOS_COLUMNS).toContain('proveedores') // plural — singular is phantom
    expect(TRAFICOS_COLUMNS).toContain('bultos_recibidos') // not `bultos`
    expect(TRAFICOS_COLUMNS).not.toContain('trafico_id' as never)
    expect(TRAFICOS_COLUMNS).not.toContain('trafico_number' as never)
    expect(TRAFICOS_COLUMNS).not.toContain('cve_trafico' as never)
    expect(TRAFICOS_COLUMNS).not.toContain('proveedor' as never)
    expect(TRAFICOS_COLUMNS).not.toContain('moneda' as never)
    expect(TRAFICOS_COLUMNS).not.toContain('fraccion_arancelaria' as never)
    expect(TRAFICOS_COLUMNS).not.toContain('cruz_score' as never)
    expect(TRAFICOS_COLUMNS).not.toContain('mve_folio' as never)
    expect(TRAFICOS_COLUMNS).not.toContain('tipo_operacion' as never)
    expect(TRAFICOS_COLUMNS).not.toContain('fecha_cruce_planeada' as never)
  })

  it('globalpc_partidas has no cve_trafico, fraccion, descripcion, valor_comercial', () => {
    expect(GLOBALPC_PARTIDAS_COLUMNS.length).toBe(16)
    expect(GLOBALPC_PARTIDAS_COLUMNS).toContain('folio')
    expect(GLOBALPC_PARTIDAS_COLUMNS).toContain('cve_producto')
    expect(GLOBALPC_PARTIDAS_COLUMNS).toContain('cantidad')
    expect(GLOBALPC_PARTIDAS_COLUMNS).toContain('precio_unitario')
    // The classic phantoms:
    expect(GLOBALPC_PARTIDAS_COLUMNS).not.toContain('cve_trafico' as never)
    expect(GLOBALPC_PARTIDAS_COLUMNS).not.toContain('fraccion' as never)
    expect(GLOBALPC_PARTIDAS_COLUMNS).not.toContain('fraccion_arancelaria' as never)
    expect(GLOBALPC_PARTIDAS_COLUMNS).not.toContain('descripcion' as never)
    expect(GLOBALPC_PARTIDAS_COLUMNS).not.toContain('valor_comercial' as never)
    expect(GLOBALPC_PARTIDAS_COLUMNS).not.toContain('fecha_llegada' as never)
    expect(GLOBALPC_PARTIDAS_COLUMNS).not.toContain('umc' as never)
    expect(GLOBALPC_PARTIDAS_COLUMNS).not.toContain('tmec' as never)
  })

  it('globalpc_facturas has cve_trafico but not pedimento or valor_usd', () => {
    expect(GLOBALPC_FACTURAS_COLUMNS).toContain('cve_trafico')
    expect(GLOBALPC_FACTURAS_COLUMNS).toContain('valor_comercial')
    expect(GLOBALPC_FACTURAS_COLUMNS).toContain('cove_vucem')
    expect(GLOBALPC_FACTURAS_COLUMNS).toContain('cve_proveedor')
    // Phantoms (live on traficos, not facturas):
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('pedimento' as never)
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('valor_usd' as never)
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('dta' as never)
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('igi' as never)
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('iva' as never)
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('fecha_pago' as never)
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('valor' as never)
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('proveedor' as never)
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('cove' as never)
    // MySQL-native names never mirrored:
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('iValorComercial' as never)
    expect(GLOBALPC_FACTURAS_COLUMNS).not.toContain('sCveMoneda' as never)
  })

  it('globalpc_productos has fraccion + descripcion, not partida fields', () => {
    expect(GLOBALPC_PRODUCTOS_COLUMNS).toContain('fraccion')
    expect(GLOBALPC_PRODUCTOS_COLUMNS).toContain('descripcion')
    expect(GLOBALPC_PRODUCTOS_COLUMNS).toContain('umt')
    // Phantom partida-level fields:
    expect(GLOBALPC_PRODUCTOS_COLUMNS).not.toContain('cve_trafico' as never)
    expect(GLOBALPC_PRODUCTOS_COLUMNS).not.toContain('cantidad' as never)
    expect(GLOBALPC_PRODUCTOS_COLUMNS).not.toContain('valor_unitario' as never)
    expect(GLOBALPC_PRODUCTOS_COLUMNS).not.toContain('valor_total' as never)
    // Phantom permit columns (migration pending):
    expect(GLOBALPC_PRODUCTOS_COLUMNS).not.toContain('nom_numero' as never)
    expect(GLOBALPC_PRODUCTOS_COLUMNS).not.toContain('sedue_permit' as never)
    expect(GLOBALPC_PRODUCTOS_COLUMNS).not.toContain('semarnat_cert' as never)
  })

  it('globalpc_proveedores uses id_fiscal, not rfc', () => {
    expect(GLOBALPC_PROVEEDORES_COLUMNS).toContain('id_fiscal')
    expect(GLOBALPC_PROVEEDORES_COLUMNS).toContain('nombre')
    expect(GLOBALPC_PROVEEDORES_COLUMNS).not.toContain('rfc' as never)
  })

  it('companies uses name + active, not razon_social/nombre_comercial/is_active/updated_at', () => {
    expect(COMPANIES_COLUMNS).toContain('name')
    expect(COMPANIES_COLUMNS).toContain('active')
    expect(COMPANIES_COLUMNS).toContain('clave_cliente')
    expect(COMPANIES_COLUMNS).toContain('branding')
    expect(COMPANIES_COLUMNS).toContain('features')
    // Classic phantoms:
    expect(COMPANIES_COLUMNS).not.toContain('razon_social' as never)
    expect(COMPANIES_COLUMNS).not.toContain('nombre_comercial' as never)
    expect(COMPANIES_COLUMNS).not.toContain('is_active' as never)
    expect(COMPANIES_COLUMNS).not.toContain('updated_at' as never)
    // Config sub-paths (must live inside a config jsonb col, not top-level):
    expect(COMPANIES_COLUMNS).not.toContain('general' as never)
    expect(COMPANIES_COLUMNS).not.toContain('direcciones' as never)
    expect(COMPANIES_COLUMNS).not.toContain('contactos' as never)
    expect(COMPANIES_COLUMNS).not.toContain('fiscal' as never)
    expect(COMPANIES_COLUMNS).not.toContain('aduanal_defaults' as never)
    expect(COMPANIES_COLUMNS).not.toContain('notificaciones' as never)
    expect(COMPANIES_COLUMNS).not.toContain('notas_internas' as never)
  })

  it('expediente_documentos uses doc_type/file_name/pedimento_id/uploaded_at', () => {
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).toContain('doc_type')
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).toContain('file_name')
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).toContain('pedimento_id') // holds trafico slug
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).toContain('uploaded_at')
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).toContain('metadata')
    // Phantoms:
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).not.toContain('document_type' as never)
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).not.toContain('document_type_confidence' as never)
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).not.toContain('doc_type_code' as never)
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).not.toContain('trafico_id' as never)
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).not.toContain('nombre' as never)
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).not.toContain('created_at' as never)
    expect(EXPEDIENTE_DOCUMENTOS_COLUMNS).not.toContain('custom_doc_name' as never)
  })

  it('entradas has tipo_operacion (lives here, NOT on traficos)', () => {
    expect(ENTRADAS_COLUMNS).toContain('tipo_operacion')
    expect(ENTRADAS_COLUMNS).toContain('trafico')
    expect(ENTRADAS_COLUMNS).toContain('cve_entrada')
    expect(ENTRADAS_COLUMNS).toContain('fecha_llegada_mercancia')
  })
})

describe('schema-contracts · helpers', () => {
  it('col() returns the column name (compile-time check fails on phantom)', () => {
    expect(col('traficos', 'trafico')).toBe('trafico')
    expect(col('globalpc_partidas', 'folio')).toBe('folio')
    expect(col('globalpc_productos', 'fraccion')).toBe('fraccion')
    expect(col('companies', 'name')).toBe('name')
  })

  it('cols() accepts valid lists', () => {
    expect(cols('traficos', 'trafico, pedimento')).toBe('trafico, pedimento')
    expect(cols('globalpc_partidas', 'folio, cve_producto, cantidad')).toBe('folio, cve_producto, cantidad')
  })

  it('cols() throws on phantom column in dev mode', () => {
    // NODE_ENV is 'test' under vitest — dev path is active.
    expect(() => cols('traficos', 'trafico, proveedor')).toThrow(/proveedor.*not a real column on 'traficos'/)
    expect(() => cols('globalpc_partidas', 'cve_trafico')).toThrow(/cve_trafico.*not a real column on 'globalpc_partidas'/)
    expect(() => cols('companies', 'razon_social')).toThrow(/razon_social.*not a real column on 'companies'/)
  })

  it('realColumns() returns the canonical tuple', () => {
    expect(realColumns('traficos')).toBe(TRAFICOS_COLUMNS)
    expect(realColumns('entradas')).toBe(ENTRADAS_COLUMNS)
  })
})
