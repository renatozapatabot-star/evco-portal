/**
 * Block 5 — Classification sheet engine.
 *
 * Pure functions, no I/O. Consumers hand in productos + a config and
 * receive a flattened partidas[] plus summary + warnings. The 9 grouping
 * strategies + 4 ordering strategies implement the GlobalPC M3
 * "Hoja de clasificación" matrix faithfully — each mode produces a
 * distinct output on the same input (see the engine tests).
 */

import type {
  ClassificationSheetConfig,
  GeneratedSheet,
  GroupingMode,
  OrderingMode,
  Partida,
  Producto,
} from '@/types/classification'

const MISSING = 'sin especificar'

function fractionOf(p: Producto): string {
  return (p.fraccion_arancelaria ?? p.fraccion ?? '').trim()
}

function subheadingOf(p: Producto): string {
  const f = fractionOf(p)
  // Subheading = first 6 digits (stripping dots) → "3901.20" from "3901.20.01"
  const digits = f.replace(/\./g, '')
  if (digits.length < 6) return f || MISSING
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`
}

function countryOf(p: Producto): string {
  return (p.pais_origen ?? '').trim() || MISSING
}

function umcOf(p: Producto): string {
  return (p.umc ?? '').trim() || MISSING
}

function invoiceOf(p: Producto): string {
  return (p.invoice_number ?? p.factura_numero ?? '').trim() || MISSING
}

function descOf(p: Producto): string {
  return (p.descripcion_especifica ?? p.descripcion ?? '').trim() || MISSING
}

function keyOf(p: Producto): string {
  return (p.cve_producto ?? '').trim() || MISSING
}

function certOf(p: Producto): boolean {
  return !!p.certificado_origen_tmec
}

function supplierOf(p: Producto): string {
  return (p.supplier ?? p.proveedor ?? '').trim() || MISSING
}

function marcaModeloOf(p: Producto): string {
  const parts = [p.marca, p.modelo, p.serie].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : MISSING
}

// ── Grouping strategies — each returns the stable grouping key string ──

type KeyFn = (p: Producto) => string

const groupingKeyFns: Record<GroupingMode, KeyFn> = {
  // Sentinel — the engine handles 'none' with per-call unique keys.
  // This fn is only used when grouping_mode !== 'none'.
  none: (p) => `row:${p.cve_producto ?? ''}`,
  fraction_country_umc: (p) => `${fractionOf(p)}|${countryOf(p)}|${umcOf(p)}`,
  fraction_umc_country: (p) => `${fractionOf(p)}|${umcOf(p)}|${countryOf(p)}`,
  fraction_umc_country_certified: (p) =>
    `${fractionOf(p)}|${umcOf(p)}|${countryOf(p)}|cert:${certOf(p) ? 'yes' : 'no'}`,
  fraction_umc_country_cert_invoice: (p) =>
    `${fractionOf(p)}|${umcOf(p)}|${countryOf(p)}|cert:${certOf(p) ? 'y' : 'n'}|inv:${invoiceOf(p)}`,
  fraction_umc_country_product_key: (p) =>
    `${fractionOf(p)}|${umcOf(p)}|${countryOf(p)}|key:${keyOf(p)}`,
  fraction_umc_country_product_desc: (p) =>
    `${fractionOf(p)}|${umcOf(p)}|${countryOf(p)}|desc:${descOf(p)}`,
  fraction_umc_country_desc_cert: (p) =>
    `${fractionOf(p)}|${umcOf(p)}|${countryOf(p)}|desc:${descOf(p)}|cert:${certOf(p) ? 'y' : 'n'}`,
  subheading_fraction_umc_country: (p) =>
    `${subheadingOf(p)}|${fractionOf(p)}|${umcOf(p)}|${countryOf(p)}`,
}

// ── Ordering strategies ──

type OrderFn = (a: Partida, b: Partida) => number

const orderingFns: Record<OrderingMode, OrderFn> = {
  fraction_asc: (a, b) => a.fraction.localeCompare(b.fraction),
  invoice_capture_item: (a, b) => {
    const inv = (a.invoice_number ?? '').localeCompare(b.invoice_number ?? '')
    if (inv !== 0) return inv
    return a.fraction.localeCompare(b.fraction)
  },
  invoice_number_asc: (a, b) => (a.invoice_number ?? '').localeCompare(b.invoice_number ?? ''),
  fraction_country_desc_umc: (a, b) => {
    const f = a.fraction.localeCompare(b.fraction)
    if (f !== 0) return f
    const c = a.country.localeCompare(b.country)
    if (c !== 0) return c
    const d = a.description.localeCompare(b.description)
    if (d !== 0) return d
    return a.umc.localeCompare(b.umc)
  },
}

// ── Partida builder (fold multiple productos into one row) ──

function buildPartida(key: string, rows: Producto[]): Partida {
  const first = rows[0]
  const quantity = rows.reduce((s, r) => s + Number(r.cantidad ?? 0), 0)
  const totalValue = rows.reduce((s, r) => s + Number(r.valor_comercial ?? 0), 0)
  const unitValue = quantity > 0 ? totalValue / quantity : null

  const restrictions = Array.from(
    new Set(rows.map((r) => (r.restriccion ?? '').trim()).filter(Boolean)),
  )

  return {
    fraction: fractionOf(first) || MISSING,
    description: descOf(first),
    country: countryOf(first),
    umc: umcOf(first),
    quantity,
    unit_value: unitValue,
    total_value: totalValue,
    invoice_number: invoiceOf(first) === MISSING ? null : invoiceOf(first),
    supplier: supplierOf(first) === MISSING ? null : supplierOf(first),
    certified_tmec: certOf(first),
    marca_modelo: marcaModeloOf(first) === MISSING ? null : marcaModeloOf(first),
    restrictions,
    products_count: rows.length,
    grouping_key: key,
  }
}

// ── Warnings collector ──

function collectWarnings(productos: Producto[], mode: GroupingMode): string[] {
  const warnings: string[] = []

  const missingFraction = productos.filter((p) => !fractionOf(p)).length
  if (missingFraction > 0) {
    warnings.push(`Productos sin fracción arancelaria: ${missingFraction}`)
  }

  const missingCountry = productos.filter((p) => !p.pais_origen).length
  if (missingCountry > 0) {
    warnings.push(`Productos sin país de origen: ${missingCountry}`)
  }

  const missingDesc = productos.filter((p) => !(p.descripcion ?? p.descripcion_especifica)).length
  if (missingDesc > 0) {
    warnings.push(`Productos sin descripción: ${missingDesc}`)
  }

  if (
    mode === 'fraction_umc_country_product_desc' ||
    mode === 'fraction_umc_country_desc_cert'
  ) {
    if (missingDesc > 0) {
      warnings.push(
        `Agrupación por descripción con descripción vacía para ${missingDesc} producto(s) — se usa "${MISSING}"`,
      )
    }
  }

  const anyMarca = productos.some((p) => p.marca || p.modelo || p.serie)
  if (!anyMarca) {
    warnings.push(
      'Modos que referencian marca/modelo/serie muestran "sin especificar" — no hay datos en productos',
    )
  }

  return warnings
}

/**
 * Build the classification sheet. Pure. No I/O. Deterministic for a
 * given input+config pair (except when grouping_mode='none' uses random
 * fallback keys for productos without cve_producto — each row is still
 * a distinct partida so ordering remains stable).
 */
export function generateClassificationSheet(
  productos: Producto[],
  config: ClassificationSheetConfig,
): GeneratedSheet {
  const orderFn = orderingFns[config.ordering_mode]

  // Group productos by the mode's key function. 'none' mode is a pass-through:
  // every row becomes its own partida regardless of duplicate content.
  const groups = new Map<string, Producto[]>()
  if (config.grouping_mode === 'none') {
    productos.forEach((p, i) => groups.set(`row:${i}`, [p]))
  } else {
    const keyFn = groupingKeyFns[config.grouping_mode]
    for (const p of productos) {
      const k = keyFn(p)
      const bucket = groups.get(k)
      if (bucket) {
        bucket.push(p)
      } else {
        groups.set(k, [p])
      }
    }
  }

  const partidas: Partida[] = Array.from(groups.entries()).map(([key, rows]) =>
    buildPartida(key, rows),
  )
  partidas.sort(orderFn)

  const summary = {
    total_value: partidas.reduce((s, p) => s + p.total_value, 0),
    partidas_count: partidas.length,
    products_count: productos.length,
  }

  const warnings = collectWarnings(productos, config.grouping_mode)

  return { partidas, summary, warnings }
}
