import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Next USMCA certificate number: `TMEC-YYYY-NNN`. Sequenced per calendar year.
 * UNIQUE constraint on certificate_number catches any race.
 */
export async function nextCertificateNumber(
  supabase: SupabaseClient,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const prefix = `TMEC-${year}-`
  const { data } = await supabase
    .from('usmca_certificates')
    .select('certificate_number')
    .like('certificate_number', `${prefix}%`)
    .order('certificate_number', { ascending: false })
    .limit(1)

  const last = data?.[0]?.certificate_number as string | undefined
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) : 0
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1
  return `${prefix}${String(nextSeq).padStart(3, '0')}`
}

/** HS code must be at least 6 digits (optionally with a dot every 2 chars). */
export function isValidHsCode(hs: string): boolean {
  const normalized = hs.replace(/\s/g, '')
  return /^\d{6}(\.\d{2}){0,2}$/.test(normalized) || /^\d{6,10}$/.test(normalized)
}
