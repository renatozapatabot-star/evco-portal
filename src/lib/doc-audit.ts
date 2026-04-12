/**
 * Block 4 · Supplier Doc Solicitation Polish — Custom-doc audit detector.
 *
 * When operators pick "Otro (especificar)" in SolicitarDocsModal, the custom
 * name is persisted to expediente_documentos.custom_doc_name. If the same
 * custom name recurs ≥ 3 times across tráficos, we surface it as an
 * operational_decisions row with decision_type='audit_suggestion' — the
 * signal to promote it into the catalog.
 *
 * This function is installed but NOT cron-wired in Block 4. Follow-up block
 * will schedule it weekly and build the admin UI to review suggestions.
 *
 * Service-role. Never import from a client component.
 */

import { createServerClient } from '@/lib/supabase-server'
import { logDecision } from '@/lib/decision-logger'

export interface CustomDocSuggestion {
  custom_doc_name: string
  occurrences: number
  sample_traficos: string[]
}

export interface RunCustomDocAuditResult {
  suggestions: CustomDocSuggestion[]
  logged: number
  error: { code: string; message: string } | null
}

/**
 * Scan expediente_documentos for custom_doc_name values that recur ≥ threshold
 * times, then emit one operational_decisions row per hit. Returns the
 * suggestions array so admin dashboards can render directly without a second
 * round-trip.
 */
export async function runCustomDocAudit(
  threshold = 3,
): Promise<RunCustomDocAuditResult> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('expediente_documentos')
    .select('custom_doc_name, trafico_id')
    .not('custom_doc_name', 'is', null)
    .eq('doc_type_code', 'otro')
    .limit(5000)

  if (error) {
    return {
      suggestions: [],
      logged: 0,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    }
  }

  const rows = (data ?? []) as Array<{
    custom_doc_name: string | null
    trafico_id: string | null
  }>

  const grouped = new Map<string, { count: number; traficos: Set<string> }>()
  for (const row of rows) {
    const name = (row.custom_doc_name ?? '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    const bucket = grouped.get(key) ?? { count: 0, traficos: new Set<string>() }
    bucket.count += 1
    if (row.trafico_id) bucket.traficos.add(row.trafico_id)
    grouped.set(key, bucket)
  }

  const suggestions: CustomDocSuggestion[] = []
  for (const [key, bucket] of grouped) {
    if (bucket.count < threshold) continue
    suggestions.push({
      custom_doc_name: key,
      occurrences: bucket.count,
      sample_traficos: Array.from(bucket.traficos).slice(0, 5),
    })
  }
  suggestions.sort((a, b) => b.occurrences - a.occurrences)

  let logged = 0
  for (const s of suggestions) {
    const res = await logDecision({
      decision_type: 'audit_suggestion',
      decision: 'Considerar agregar al catálogo',
      reasoning: `"${s.custom_doc_name}" aparece ${s.occurrences} veces como doc "Otro" — candidato para catálogo.`,
      dataPoints: {
        custom_doc_name: s.custom_doc_name,
        occurrences: s.occurrences,
        sample_traficos: s.sample_traficos,
        source: 'doc-audit.runCustomDocAudit',
      },
    })
    if (res.ok) logged += 1
  }

  return { suggestions, logged, error: null }
}
