/**
 * SAT UMC catalog (Anexo 22 · Reglas Generales de Comercio Exterior).
 *
 * `globalpc_productos.umt` stores the SAT numeric code, not the
 * human-readable string. The reference Excel from GlobalPC leaves the
 * column empty because their own exporter doesn't translate the code
 * either — but a plant manager reading "KILO" understands the row;
 * "1" is meaningless out of context.
 *
 * Confirmed against Patente 3596 (Renato Zapata III, 2026-04-28) for
 * the codes EVCO actually uses (1, 6, 8). The remaining entries match
 * the SAT-published catalog and are insurance for clients onboarded
 * after EVCO. Unknown codes pass through unchanged so we never silently
 * drop data.
 */

export const SAT_UMC_CATALOG: Readonly<Record<string, string>> = {
  '1':  'KILO',
  '2':  'GRAMO',
  '3':  'METRO LINEAL',
  '4':  'METRO CUADRADO',
  '5':  'METRO CÚBICO',
  '6':  'PIEZA',
  '7':  'CABEZA',
  '8':  'LITRO',
  '9':  'PAR',
  '10': 'KILOWATT',
  '11': 'MILLAR',
  '12': 'JUEGO',
  '13': 'KILOWATT/HORA',
  '14': 'TONELADA',
  '15': 'BARRIL',
  '16': 'GRAMO NETO',
  '17': 'DECENAS',
  '18': 'CIENTOS',
  '19': 'DOCENAS',
  '20': 'CAJA',
  '21': 'BOTELLA',
}

/**
 * Translate a SAT UMC code to its human-readable name. If the input is
 * already a human string (e.g. "KGM" from a non-GlobalPC source) or
 * an unrecognized code, return it unchanged. Returns null only when
 * the input is null/empty.
 */
export function formatUmc(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = String(raw).trim()
  if (trimmed === '') return null
  return SAT_UMC_CATALOG[trimmed] ?? trimmed
}
