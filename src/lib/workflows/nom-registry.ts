/**
 * NOM-regulated fracción prefixes — minimum viable registry.
 *
 * These 4-digit prefixes route a large fraction of shipments into
 * NOM compliance (labeling, safety, or product standards). The list
 * is conservative: every entry is backed by a published NOM that
 * applies to the tariff chapter. Adding a prefix here immediately
 * flags every shipment without a `nom_certificate` field — so false
 * positives are worse than false negatives. The runner's feedback
 * loop down-weights signatures that Ursula repeatedly marks 👎.
 *
 * Sources:
 *   · NOM-004-SE-2021 (textiles, chapters 61/62/63)
 *   · NOM-015-SCFI-2007 (commercial information, multiple chapters)
 *   · NOM-024-SCFI-2013 (electrical appliances, chapter 85)
 *   · NOM-050-SCFI-2004 (general commercial information)
 *   · NOM-003-SCFI-2014 (electrical safety, chapter 85)
 *   · NOM-051-SCFI-2010 (food labeling, chapters 16/19/20)
 *
 * This is the "minimum-viable" list — enough to run end-to-end for
 * EVCO (plastics / containers / electrical) and MAFESA (pending
 * clave + RFC but seeded with same shape). The Anexo 24 + OCA
 * classification pipeline will supersede this when it lands.
 */

export const NOM_REGULATED_FRACTION_PREFIXES: ReadonlySet<string> = new Set([
  // Textiles (NOM-004-SE-2021 · commercial-info labeling)
  '6101', '6102', '6103', '6104', '6105', '6106', '6107', '6108', '6109', '6110',
  '6201', '6202', '6203', '6204', '6205', '6206', '6207', '6208', '6209',
  '6301', '6302', '6303', '6304',
  // Footwear (NOM-020-SCFI)
  '6401', '6402', '6403', '6404', '6405',
  // Toys (NOM-015-SCFI)
  '9501', '9503',
  // Electrical appliances (NOM-003-SCFI, NOM-024-SCFI)
  '8418', '8419', '8450', '8451', '8452', '8509', '8516',
  // Consumer electronics (NOM-024-SCFI)
  '8517', '8518', '8519', '8521', '8525', '8528',
  // Lighting (NOM-003-SCFI)
  '9405',
  // Food labeling (NOM-051-SCFI, NOM-002-SCFI)
  '1601', '1602', '1604', '1605',
  '1901', '1902', '1904', '1905',
  '2001', '2005', '2007', '2008', '2009',
  // Cosmetics + personal care (NOM-141-SSA1, NOM-142-SSA1)
  '3303', '3304', '3305', '3306', '3307',
  // Packaged plastics (NOM-050-SCFI commercial info on containers)
  '3923', '3924',
])

/**
 * Extracts the 4-digit chapter prefix of a fracción. Preserves dots
 * per core-invariant #8. Returns null if input isn't a well-formed
 * fracción arancelaria.
 */
export function fractionPrefix4(fraccion: string | null | undefined): string | null {
  if (!fraccion) return null
  const trimmed = fraccion.trim()
  // Expect DDDD.DD.DD (preserve dots — never strip them).
  const match = /^(\d{4})\.\d{2}\.\d{2}$/.exec(trimmed)
  return match ? match[1]! : null
}

export function isNomRegulated(fraccion: string | null | undefined): boolean {
  const prefix = fractionPrefix4(fraccion)
  if (!prefix) return false
  return NOM_REGULATED_FRACTION_PREFIXES.has(prefix)
}
