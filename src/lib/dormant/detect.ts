/**
 * CRUZ · V1.5 F7 — Dormant client detection.
 *
 * Surface clientes who have historical embarque activity but no recent embarque
 * in the last `thresholdDays` days. Clients that never onboarded (zero lifetime
 * embarques) are filtered out on purpose — we only follow up with clientes whose
 * relationship cooled, not leads who never started.
 *
 * `generateFollowUpMessage` produces a warm, broker-voice Spanish message Tito
 * or Renato IV can review and dispatch. The template is intentionally boring:
 * greeting · context · value prop · soft CTA · signature. No emojis, no bold
 * promises — this is a nudge, not a pitch.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface DormantClienteRecord {
  clienteId: string
  clienteName: string
  lastActivityAt: string | null
  diasSinMovimiento: number
  lastInvoiceAmount: number | null
  lastInvoiceCurrency: 'MXN' | 'USD' | null
  lastInvoiceDate: string | null
  rfc: string | null
}

const MIN_THRESHOLD = 7
const MAX_THRESHOLD = 60
const MAX_ROWS = 50

export function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) return 14
  const rounded = Math.floor(value)
  if (rounded < MIN_THRESHOLD) return MIN_THRESHOLD
  if (rounded > MAX_THRESHOLD) return MAX_THRESHOLD
  return rounded
}

/**
 * Fetch dormant clientes. Two-pass strategy to avoid expensive aggregates:
 *  1. Load active companies (+ RFC).
 *  2. For each, fetch the most recent embarque + most recent invoice.
 *  3. Keep those with at least one historical embarque and no motion in
 *     the last `thresholdDays` days.
 */
export async function detectDormantClients(
  supabase: SupabaseClient,
  companyId: string | null,
  thresholdDays: number = 14,
): Promise<DormantClienteRecord[]> {
  const threshold = clampThreshold(thresholdDays)
  const cutoffMs = Date.now() - threshold * 86_400_000

  const companiesQ = supabase
    .from('companies')
    .select('company_id, razon_social, name, rfc, is_active')
    .eq('is_active', true)
    .limit(500)

  // If a specific companyId is provided (rare — Eagle View reuse), pin to it.
  const { data: companies } = companyId
    ? await companiesQ.eq('company_id', companyId)
    : await companiesQ

  type CompanyRow = {
    company_id: string
    razon_social: string | null
    name: string | null
    rfc: string | null
  }

  const rows = ((companies ?? []) as CompanyRow[]).filter((c) => c.company_id)
  if (rows.length === 0) return []

  const results: DormantClienteRecord[] = []

  for (const c of rows) {
    const { data: lastTraf } = await supabase
      .from('traficos')
      .select('created_at')
      .eq('company_id', c.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const lastTrafRow = lastTraf as { created_at: string | null } | null
    if (!lastTrafRow?.created_at) continue // never onboarded — skip

    const lastMs = new Date(lastTrafRow.created_at).getTime()
    const dias = Math.floor((Date.now() - lastMs) / 86_400_000)
    if (lastMs >= cutoffMs) continue // still active — skip

    const { data: lastInv } = await supabase
      .from('invoices')
      .select('total, currency, created_at')
      .eq('company_id', c.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const invRow = lastInv as {
      total: number | null
      currency: string | null
      created_at: string | null
    } | null

    const currency: 'MXN' | 'USD' | null =
      invRow?.currency === 'MXN' || invRow?.currency === 'USD' ? invRow.currency : null

    results.push({
      clienteId: c.company_id,
      clienteName: c.razon_social ?? c.name ?? c.company_id,
      lastActivityAt: lastTrafRow.created_at,
      diasSinMovimiento: dias,
      lastInvoiceAmount: invRow?.total != null ? Number(invRow.total) : null,
      lastInvoiceCurrency: currency,
      lastInvoiceDate: invRow?.created_at ?? null,
      rfc: c.rfc,
    })
  }

  results.sort((a, b) => b.diasSinMovimiento - a.diasSinMovimiento)
  return results.slice(0, MAX_ROWS)
}

export interface FollowUpMessage {
  subject: string
  message: string
}

/**
 * Compose a warm Spanish follow-up message. Pure function — no I/O, no
 * hidden state. The signature line identifies the firm + patente; humans
 * still authorize before anything is sent.
 */
export function generateFollowUpMessage(cliente: DormantClienteRecord): FollowUpMessage {
  const displayName = cliente.clienteName?.trim() || 'estimado cliente'
  const firstName = displayName.split(/\s+/)[0] ?? displayName
  const dias = cliente.diasSinMovimiento
  const subject = `Seguimiento — ${displayName}`

  const lines = [
    `Estimado equipo de ${displayName}:`,
    '',
    `Notamos que no hemos procesado un nuevo embarque en ${dias} días y queríamos saludarlos. Valoramos la relación que el equipo de ${firstName} ha construido con nuestra firma y queremos confirmar que todo esté en orden con sus operaciones transfronterizas.`,
    '',
    'Seguimos disponibles para apoyar con clasificación arancelaria, revisión de expedientes, pedimentos, cruces por Aduana 240 y cualquier consulta regulatoria que requieran. Si hay un embarque próximo o un proyecto nuevo, con gusto lo coordinamos.',
    '',
    '¿Podemos agendar una llamada rápida de 15 minutos esta semana para ponernos al día?',
    '',
    'Quedamos atentos a sus indicaciones.',
    '',
    'Equipo Renato Zapata & Co.',
    'Patente 3596 · Aduana 240 · Laredo, Texas',
  ]

  return { subject, message: lines.join('\n') }
}
