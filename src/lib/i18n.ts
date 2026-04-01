export type CRUZLocale = 'es' | 'en'

export const formatCurrency = (
  value: number,
  currency = 'USD',
  locale: CRUZLocale = 'es'
): string => new Intl.NumberFormat(
  locale === 'es' ? 'es-MX' : 'en-US',
  { style: 'currency', currency, minimumFractionDigits: 2 }
).format(value)

export const formatDate = (
  iso: string,
  style: 'short' | 'medium' = 'short',
  locale: CRUZLocale = 'es'
): string => {
  const d = new Date(iso)
  const loc = locale === 'es' ? 'es-MX' : 'en-US'
  if (style === 'short') return d.toLocaleDateString(loc,
    { day: 'numeric', month: 'short', timeZone: 'America/Chicago' })
  return d.toLocaleDateString(loc,
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Chicago' })
}

// Domain terms — never translate these
export const DOMAIN_TERMS = [
  'Tráfico', 'Pedimento', 'Expediente', 'Entrada',
  'Fracción arancelaria', 'MVE', 'Aduana', 'Patente'
] as const
