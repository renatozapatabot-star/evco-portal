/**
 * Extract structured references from CRUZ AI free-text output.
 *
 * The synthesis pass produces a polished Spanish answer in one string.
 * The UI wants inline chips for pedimentos, tráficos, fracciones, and
 * amounts so the user can tap through to a detail page. This module
 * runs canonical-format regexes over the answer text (and optionally
 * the tool-result payloads) and returns a deduplicated ref bundle.
 *
 * All formats preserve their canonical shape:
 *   - Pedimentos keep spaces: "DD AD PPPP SSSSSSS" (invariant #7).
 *   - Fracciones keep dots:   "XXXX.XX.XX"          (invariant #8).
 *   - Amounts carry explicit MXN / USD currency     (invariant #10).
 */

const PEDIMENTO_RX = /\b\d{2}\s\d{2}\s\d{4}\s\d{7}\b/g
const FRACCION_RX = /\b\d{4}\.\d{2}\.\d{2}\b/g
// Y-1234 tráfico IDs — EVCO's convention is Y + 3-6 digits. The
// tolerant form with optional dash is kept lenient since tool outputs
// and AI text use both "Y1234" and "Y-1234".
const TRAFICO_RX = /\bY-?\d{3,6}\b/g
// Amounts: optional $, 1-3 digits, optional thousand groups, optional
// 1-2 decimals, then MXN or USD. No flat ×0.16 shortcuts here —
// whatever the text says is what we show.
const AMOUNT_RX = /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(MXN|USD)\b/g
// RFC (Mexican tax id). Moral persons: 3 letters + 6 digits + 3 alphanum
// (12 chars). Natural persons: 4 letters + 6 digits + 3 alphanum (13 chars).
// `&` and `Ñ` are valid in moral-person stems; use a leading char class
// that admits both.
const RFC_RX = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g
// PRV_N supplier codes — GlobalPC's legacy code for proveedores whose
// real name hasn't been resolved yet. Ursula sees real names most
// places, but AI tool output still surfaces these for unresolved rows.
const PRV_CODE_RX = /\bPRV_\d{1,6}\b/g

const MAX_REFS_PER_KIND = 10

export interface DataRefAmount {
  value: number
  currency: 'MXN' | 'USD'
  raw: string
}

export interface DataRefs {
  traficos: string[]
  pedimentos: string[]
  fracciones: string[]
  amounts: DataRefAmount[]
  suppliers: string[]
}

export const EMPTY_DATA_REFS: DataRefs = {
  traficos: [],
  pedimentos: [],
  fracciones: [],
  amounts: [],
  suppliers: [],
}

/**
 * Scan each provided text and collect canonical-format references.
 * Deduplicates within a kind. Caps at MAX_REFS_PER_KIND so the UI
 * never has to render an unbounded chip list.
 */
export function extractDataRefs(texts: ReadonlyArray<string | null | undefined>): DataRefs {
  const pedimentos = new Set<string>()
  const fracciones = new Set<string>()
  const traficos = new Set<string>()
  const suppliers = new Set<string>()
  const amountsSeen = new Set<string>()
  const amounts: DataRefAmount[] = []

  for (const raw of texts) {
    if (!raw) continue
    for (const match of raw.matchAll(PEDIMENTO_RX)) pedimentos.add(match[0])
    for (const match of raw.matchAll(FRACCION_RX)) fracciones.add(match[0])
    for (const match of raw.matchAll(TRAFICO_RX)) {
      // Normalize "Y1234" → "Y-1234" so the UI renders one canonical form.
      const id = match[0].startsWith('Y-') ? match[0] : `Y-${match[0].slice(1)}`
      traficos.add(id)
    }
    for (const match of raw.matchAll(RFC_RX)) suppliers.add(match[0])
    for (const match of raw.matchAll(PRV_CODE_RX)) suppliers.add(match[0])
    for (const match of raw.matchAll(AMOUNT_RX)) {
      const key = `${match[1]}|${match[2]}`
      if (amountsSeen.has(key)) continue
      const value = Number(match[1].replace(/,/g, ''))
      if (!Number.isFinite(value)) continue
      amounts.push({
        value,
        currency: match[2] as 'MXN' | 'USD',
        raw: match[0],
      })
      amountsSeen.add(key)
    }
  }

  return {
    traficos: Array.from(traficos).slice(0, MAX_REFS_PER_KIND),
    pedimentos: Array.from(pedimentos).slice(0, MAX_REFS_PER_KIND),
    fracciones: Array.from(fracciones).slice(0, MAX_REFS_PER_KIND),
    amounts: amounts.slice(0, MAX_REFS_PER_KIND),
    suppliers: Array.from(suppliers).slice(0, MAX_REFS_PER_KIND),
  }
}

export const DATA_REFS_CONSTANTS = { MAX_REFS_PER_KIND } as const
