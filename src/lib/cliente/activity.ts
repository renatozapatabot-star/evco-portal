import type { SupabaseClient } from '@supabase/supabase-js'
import { auditRowToTimelineItem, type AuditRow } from '@/lib/cockpit/audit-format'
import type { TimelineItem } from '@/components/aguila'

// Only tables whose events are meaningful and safe to surface to a client.
// Per core-invariant 24 the client portal shows certainty, not anxiety —
// compliance / MVE / draft tables are intentionally excluded.
export const CLIENT_ACTIVITY_TABLES = [
  'traficos',
  'pedimentos',
  'partidas',
  'expediente_documentos',
  'entradas',
] as const

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export async function getClienteActivity(
  supabase: AnyClient,
  companyId: string,
  limit = 12,
): Promise<TimelineItem[]> {
  if (!companyId) return []

  const { data } = await supabase
    .from('audit_log')
    .select('id, table_name, action, record_id, changed_at, company_id')
    .eq('company_id', companyId)
    .in('table_name', CLIENT_ACTIVITY_TABLES as unknown as string[])
    .order('changed_at', { ascending: false })
    .limit(limit)

  return ((data ?? []) as AuditRow[]).map(auditRowToTimelineItem)
}
