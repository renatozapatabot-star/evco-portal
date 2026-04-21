import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Next opinion number for a given year: `OCA-YYYY-NNN`.
 *
 * Sequencing is per-calendar-year. We read the largest existing suffix
 * for the year and increment. Two concurrent writers could race into the
 * same number — the UNIQUE constraint on `opinion_number` will fail one,
 * and the caller retries. Cheap enough: OCA generation is rare.
 */
export async function nextOpinionNumber(
  supabase: SupabaseClient,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const prefix = `OCA-${year}-`
  const { data } = await supabase
    .from('oca_database')
    .select('opinion_number')
    .like('opinion_number', `${prefix}%`)
    .order('opinion_number', { ascending: false })
    .limit(1)

  const last = data?.[0]?.opinion_number as string | undefined
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) : 0
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1
  return `${prefix}${String(nextSeq).padStart(3, '0')}`
}

/** Validate XXXX.XX.XX format. Dots preserved — core-invariant 8. */
export function isValidFraccion(f: string): boolean {
  return /^\d{4}\.\d{2}\.\d{2}$/.test(f)
}
