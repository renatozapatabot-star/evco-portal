import { describe, it, expect } from 'vitest'
import { generateClassificationSheet } from '../classification-engine'
import {
  DEFAULT_CONFIG,
  DEFAULT_PRINT_TOGGLES,
  type ClassificationSheetConfig,
  type GroupingMode,
  type OrderingMode,
  type Producto,
} from '@/types/classification'

// Realistic mini dataset — 5 products mixing fraction / country / cert /
// invoice / descripcion / cve variance so every grouping mode produces
// a distinct partida count.
const FIXTURE: Producto[] = [
  {
    cve_producto: 'P-001',
    fraccion_arancelaria: '3901.20.01',
    descripcion: 'Polietileno alta densidad',
    umc: 'KG',
    pais_origen: 'US',
    cantidad: 1000,
    valor_comercial: 2500,
    invoice_number: 'INV-100',
    certificado_origen_tmec: true,
  },
  {
    cve_producto: 'P-001',
    fraccion_arancelaria: '3901.20.01',
    descripcion: 'Polietileno alta densidad',
    umc: 'KG',
    pais_origen: 'US',
    cantidad: 500,
    valor_comercial: 1250,
    invoice_number: 'INV-100',
    certificado_origen_tmec: true,
  },
  {
    cve_producto: 'P-002',
    fraccion_arancelaria: '3901.20.01',
    descripcion: 'Polietileno baja densidad',
    umc: 'KG',
    pais_origen: 'US',
    cantidad: 300,
    valor_comercial: 900,
    invoice_number: 'INV-101',
    certificado_origen_tmec: false,
  },
  {
    cve_producto: 'P-003',
    fraccion_arancelaria: '3902.10.01',
    descripcion: 'Polipropileno',
    umc: 'KG',
    pais_origen: 'MX',
    cantidad: 200,
    valor_comercial: 800,
    invoice_number: 'INV-102',
    certificado_origen_tmec: true,
  },
  {
    cve_producto: 'P-004',
    fraccion_arancelaria: '3901.20.01',
    descripcion: 'Polietileno alta densidad',
    umc: 'LT',
    pais_origen: 'CA',
    cantidad: 150,
    valor_comercial: 600,
    invoice_number: 'INV-103',
    certificado_origen_tmec: true,
  },
]

function cfg(
  overrides: Partial<ClassificationSheetConfig> = {},
): ClassificationSheetConfig {
  return {
    ...DEFAULT_CONFIG,
    print_toggles: { ...DEFAULT_PRINT_TOGGLES },
    ...overrides,
  }
}

describe('classification-engine · grouping modes', () => {
  it('none → one partida per row (5)', () => {
    const out = generateClassificationSheet(FIXTURE, cfg({ grouping_mode: 'none' }))
    expect(out.partidas).toHaveLength(5)
  })

  it('fraction_country_umc → collapses identical key tuples', () => {
    const out = generateClassificationSheet(
      FIXTURE,
      cfg({ grouping_mode: 'fraction_country_umc' }),
    )
    // 3901.20.01|US|KG = 2 rows collapse (P-001×2 + P-002=3 rows) → 1 partida
    //   wait — P-001 appears twice with identical key; P-002 shares same key
    //   all three US/KG 3901.20.01 rows → 1 partida
    // 3902.10.01|MX|KG → 1
    // 3901.20.01|CA|LT → 1
    expect(out.partidas).toHaveLength(3)
  })

  it('fraction_umc_country → matches f_c_u count (key order same semantics on this fixture)', () => {
    const out = generateClassificationSheet(
      FIXTURE,
      cfg({ grouping_mode: 'fraction_umc_country' }),
    )
    expect(out.partidas).toHaveLength(3)
  })

  it('fraction_umc_country_certified → splits cert=true vs cert=false', () => {
    const out = generateClassificationSheet(
      FIXTURE,
      cfg({ grouping_mode: 'fraction_umc_country_certified' }),
    )
    // 3901.20.01|KG|US cert=true (P-001×2) = 1
    // 3901.20.01|KG|US cert=false (P-002)   = 1
    // 3902.10.01|KG|MX cert=true            = 1
    // 3901.20.01|LT|CA cert=true            = 1
    expect(out.partidas).toHaveLength(4)
  })

  it('fraction_umc_country_cert_invoice → adds invoice boundary split', () => {
    const out = generateClassificationSheet(
      FIXTURE,
      cfg({ grouping_mode: 'fraction_umc_country_cert_invoice' }),
    )
    // same as certified except P-001 rows share INV-100 (still 1) — total 4
    // (no additional split on this fixture because each cert group has single invoice)
    expect(out.partidas).toHaveLength(4)
  })

  it('fraction_umc_country_product_key → splits by cve_producto', () => {
    const out = generateClassificationSheet(
      FIXTURE,
      cfg({ grouping_mode: 'fraction_umc_country_product_key' }),
    )
    // P-001 rows merge, rest are distinct → 4
    expect(out.partidas).toHaveLength(4)
  })

  it('fraction_umc_country_product_desc → splits by descripcion', () => {
    const out = generateClassificationSheet(
      FIXTURE,
      cfg({ grouping_mode: 'fraction_umc_country_product_desc' }),
    )
    // 3901.20.01|KG|US "alta densidad" = 2 rows (P-001×2) → 1
    // 3901.20.01|KG|US "baja densidad" (P-002)            → 1
    // 3902.10.01|KG|MX "Polipropileno"                    → 1
    // 3901.20.01|LT|CA "alta densidad"                    → 1
    expect(out.partidas).toHaveLength(4)
  })

  it('fraction_umc_country_desc_cert → combines desc + cert split', () => {
    const out = generateClassificationSheet(
      FIXTURE,
      cfg({ grouping_mode: 'fraction_umc_country_desc_cert' }),
    )
    expect(out.partidas).toHaveLength(4)
  })

  it('subheading_fraction_umc_country → 6-digit subheading grouping', () => {
    const out = generateClassificationSheet(
      FIXTURE,
      cfg({ grouping_mode: 'subheading_fraction_umc_country' }),
    )
    // Same fraction+umc+country keys as fraction_umc_country → 3
    expect(out.partidas).toHaveLength(3)
  })
})

describe('classification-engine · distinctness across modes', () => {
  it('9 grouping modes produce distinct partida counts on same fixture', () => {
    const modes: GroupingMode[] = [
      'none',
      'fraction_country_umc',
      'fraction_umc_country',
      'fraction_umc_country_certified',
      'fraction_umc_country_cert_invoice',
      'fraction_umc_country_product_key',
      'fraction_umc_country_product_desc',
      'fraction_umc_country_desc_cert',
      'subheading_fraction_umc_country',
    ]
    const counts = modes.map(
      (m) => generateClassificationSheet(FIXTURE, cfg({ grouping_mode: m })).partidas.length,
    )
    // We expect >= 3 unique counts across the 9 modes — they are NOT
    // all collapsed into the same number. Specifically: none=5, fraction
    // variants=3, cert variants=4.
    const unique = new Set(counts)
    expect(unique.size).toBeGreaterThanOrEqual(3)
    // Guard against accidental uniform collapse
    expect(Math.max(...counts)).toBeGreaterThan(Math.min(...counts))
  })
})

describe('classification-engine · warnings', () => {
  it('surfaces warning for product without fracción', () => {
    const withMissing: Producto[] = [
      ...FIXTURE,
      {
        cve_producto: 'P-999',
        fraccion_arancelaria: null,
        descripcion: 'Desconocido',
        umc: 'PZ',
        pais_origen: null,
        cantidad: 10,
        valor_comercial: 50,
      },
    ]
    const out = generateClassificationSheet(withMissing, cfg())
    expect(out.warnings.some((w) => w.includes('sin fracción'))).toBe(true)
    expect(out.warnings.some((w) => w.includes('sin país'))).toBe(true)
  })

  it('surfaces warning when marca/modelo/serie are absent across all rows', () => {
    const out = generateClassificationSheet(FIXTURE, cfg())
    expect(out.warnings.some((w) => w.includes('marca/modelo/serie'))).toBe(true)
  })
})

describe('classification-engine · ordering modes', () => {
  it('4 ordering modes produce distinct orderings', () => {
    const base = cfg({ grouping_mode: 'none' })
    const orderings: OrderingMode[] = [
      'fraction_asc',
      'invoice_capture_item',
      'invoice_number_asc',
      'fraction_country_desc_umc',
    ]
    const signatures = orderings.map((o) => {
      const out = generateClassificationSheet(
        FIXTURE,
        { ...base, ordering_mode: o },
      )
      return out.partidas
        .map((p) => `${p.fraction}|${p.country}|${p.invoice_number ?? ''}`)
        .join('>')
    })
    const unique = new Set(signatures)
    // At least 2 distinct orderings — on this fixture invoice_asc and
    // fraction_asc produce different sequences.
    expect(unique.size).toBeGreaterThanOrEqual(2)
  })
})

describe('classification-engine · summary totals', () => {
  it('sums valor_comercial across all productos', () => {
    const out = generateClassificationSheet(FIXTURE, cfg())
    // 2500 + 1250 + 900 + 800 + 600 = 6050
    expect(out.summary.total_value).toBe(6050)
    expect(out.summary.products_count).toBe(5)
  })
})
