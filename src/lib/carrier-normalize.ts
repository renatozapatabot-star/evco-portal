/**
 * CRUZ · Carrier-name normalization + multi-source derivation.
 *
 * The explore agent found that GlobalPC's source data for carriers is
 * sparse — many entradas/traficos have NULL for both transportista_*
 * columns. This helper tries every source we have in priority order
 * and normalizes the string so "Dummy", "UNKNOWN", "  ESTAFETA EXPRESS  "
 * all collapse to a consistent display.
 *
 * Column naming reality:
 *   traficos.transportista_extranjero   (US/foreign carrier)
 *   traficos.transportista_mexicano     (MX carrier)
 *   entradas.transportista_americano    (US carrier — note divergence!)
 *   entradas.transportista_mexicano     (MX carrier)
 */

const JUNK_TOKENS = new Set([
  'DUMMY', 'UNKNOWN', 'PENDIENTE', 'N/A', 'NA', 'NONE', 'NULL',
  'SIN ASIGNAR', 'SIN CARRIER', 'SIN TRANSPORTE', '---', '--',
])

export function fmtCarrier(raw: string | null | undefined): string {
  if (!raw) return ''
  const cleaned = String(raw).trim()
  if (!cleaned) return ''
  const upper = cleaned.toUpperCase()
  if (JUNK_TOKENS.has(upper)) return ''
  // Collapse multi-space, title-case.
  const collapsed = cleaned.replace(/\s+/g, ' ')
  return collapsed
    .split(' ')
    .map((w) => w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

interface EntradaInput {
  transportista_americano?: string | null
  transportista_mexicano?: string | null
}
interface TraficoInput {
  transportista_extranjero?: string | null
  transportista_mexicano?: string | null
  transportista_americano?: string | null  // rare but seen in some tenants
}
interface FacturaInput {
  /** Free-text carrier fields some pedimento/factura variants carry. */
  transportista?: string | null
}

export interface DerivedTransporte {
  mexicano: string
  americano: string
  /** Which source contributed the americano value (for debugging). */
  source: 'entrada' | 'trafico' | 'factura' | 'none'
}

/**
 * Resolve US + MX carrier from multiple sources. Priority for the US
 * (americano) slot: entrada.transportista_americano →
 * trafico.transportista_extranjero → trafico.transportista_americano →
 * factura.transportista → null.
 *
 * The MX slot follows the same priority order.
 */
export function deriveTransporte({
  entrada,
  trafico,
  factura,
}: {
  entrada?: EntradaInput | null
  trafico?: TraficoInput | null
  factura?: FacturaInput | null
}): DerivedTransporte {
  let americano = fmtCarrier(entrada?.transportista_americano)
  let sourceAm: DerivedTransporte['source'] = americano ? 'entrada' : 'none'
  if (!americano) {
    americano = fmtCarrier(trafico?.transportista_extranjero)
    if (americano) sourceAm = 'trafico'
  }
  if (!americano) {
    americano = fmtCarrier(trafico?.transportista_americano)
    if (americano) sourceAm = 'trafico'
  }
  if (!americano) {
    americano = fmtCarrier(factura?.transportista)
    if (americano) sourceAm = 'factura'
  }

  let mexicano = fmtCarrier(entrada?.transportista_mexicano)
  if (!mexicano) mexicano = fmtCarrier(trafico?.transportista_mexicano)

  return { mexicano, americano, source: sourceAm }
}
