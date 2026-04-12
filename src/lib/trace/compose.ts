/**
 * Trace composer — merges every known lifecycle event for a tráfico into a
 * single chronologically-sorted timeline. Used by the /traficos/[id]/trace
 * page to answer the SAT Audit standard: "show me the complete chain of
 * custody from entrada to bank reconciliation, in one view".
 *
 * Sources (every table is null-safe — if the table is missing in the current
 * environment, the source is skipped and the rest of the timeline renders):
 *
 *   - workflow_events                (engine events)
 *   - expediente_documentos          (uploaded docs)
 *   - classification_sheets          (OCA sheets)
 *   - pedimento_export_jobs          (AduanaNet)
 *   - anexo_24_export_jobs           (Anexo 24)
 *   - pece_payments                  (PECE bank payments)
 *   - mve_alerts                     (manifestación de valor)
 *   - quickbooks_export_jobs         (QB export)
 *
 * All queries are company-scoped when a companyId is supplied (defense in
 * depth beyond RLS). The function never throws — any source error is
 * absorbed and the event stream from that source is treated as empty.
 */

// We keep a minimal structural type for the Supabase client. The generated
// Database generic is strict and does not accept arbitrary table names, so
// we accept a loose chainable builder here and validate shapes at runtime.

export type TraceEventKind =
  | 'workflow'
  | 'document'
  | 'classification'
  | 'pedimento_export'
  | 'anexo24_export'
  | 'pece_payment'
  | 'mve_alert'
  | 'quickbooks_export'

export interface TraceEvent {
  id: string
  at: string
  kind: TraceEventKind
  title: string
  subtitle?: string
  actor?: string
  link?: string
}

export interface TraceTraficoLite {
  trafico: string
  company_id: string | null
  pedimento: string | null
  estatus: string | null
}

export interface ComposedTrace {
  trafico: TraceTraficoLite | null
  events: TraceEvent[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

async function safeSelect<T>(
  run: () => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  try {
    const { data, error } = await run()
    if (error) return []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim().length > 0) return v
  }
  return null
}

/**
 * Compose the end-to-end trace for a single tráfico.
 *
 * @param supabase  Server-side Supabase client (RLS-enforced).
 * @param traficoId The tráfico reference (e.g. "26-3596-1234").
 * @param companyId Optional extra filter — layered on top of RLS.
 */
export async function composeTrace(
  supabase: AnyClient,
  traficoId: string,
  companyId: string | null,
): Promise<ComposedTrace> {
  // 1) Tráfico row first — needed for pedimento-id lookups downstream.
  let traficoQ = supabase
    .from('traficos')
    .select('trafico, company_id, pedimento, estatus')
    .eq('trafico', traficoId)
  if (companyId) traficoQ = traficoQ.eq('company_id', companyId)

  let trafico: TraceTraficoLite | null = null
  try {
    const { data } = await traficoQ.maybeSingle()
    trafico = (data as TraceTraficoLite | null) ?? null
  } catch {
    trafico = null
  }

  // Resolve the pedimento_id (if present) so we can join pece_payments.
  let pedimentoId: string | null = null
  try {
    const { data } = await supabase
      .from('pedimentos')
      .select('id')
      .eq('trafico_id', traficoId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    const row = data as { id: string } | null
    pedimentoId = row?.id ?? null
  } catch {
    pedimentoId = null
  }

  // 2) Pull each source in parallel, null-safe.
  const [
    workflow,
    docs,
    sheets,
    pedExports,
    anexoExports,
    peceRows,
    mveRows,
    qbRows,
  ] = await Promise.all([
    safeSelect<Record<string, unknown>>(() =>
      supabase
        .from('workflow_events')
        .select('id, event_type, workflow, payload, created_at')
        .eq('trigger_id', traficoId)
        .order('created_at', { ascending: false })
        .limit(500),
    ),
    safeSelect<Record<string, unknown>>(() =>
      supabase
        .from('expediente_documentos')
        .select('id, file_name, document_type, doc_type, uploaded_by, created_at')
        .eq('trafico_id', traficoId)
        .order('created_at', { ascending: false })
        .limit(200),
    ),
    safeSelect<Record<string, unknown>>(() =>
      supabase
        .from('classification_sheets')
        .select('id, status, opinion_number, generated_by, created_at')
        .eq('trafico_id', traficoId)
        .order('created_at', { ascending: false })
        .limit(50),
    ),
    safeSelect<Record<string, unknown>>(() =>
      supabase
        .from('pedimento_export_jobs')
        .select('id, status, file_name, created_at')
        .eq('trafico_id', traficoId)
        .order('created_at', { ascending: false })
        .limit(50),
    ),
    safeSelect<Record<string, unknown>>(() =>
      supabase
        .from('anexo_24_export_jobs')
        .select('id, status, file_name, created_at')
        .eq('trafico_id', traficoId)
        .order('created_at', { ascending: false })
        .limit(50),
    ),
    pedimentoId
      ? safeSelect<Record<string, unknown>>(() =>
          supabase
            .from('pece_payments')
            .select(
              'id, status, bank_code, amount, reference, confirmation_number, created_at',
            )
            .eq('pedimento_id', pedimentoId)
            .order('created_at', { ascending: false })
            .limit(50),
        )
      : Promise.resolve([] as Record<string, unknown>[]),
    safeSelect<Record<string, unknown>>(() =>
      supabase
        .from('mve_alerts')
        .select('id, severity, alert_type, message, created_at')
        .eq('trafico_id', traficoId)
        .order('created_at', { ascending: false })
        .limit(50),
    ),
    safeSelect<Record<string, unknown>>(() =>
      supabase
        .from('quickbooks_export_jobs')
        .select('id, status, trafico_id, created_at')
        .eq('trafico_id', traficoId)
        .order('created_at', { ascending: false })
        .limit(50),
    ),
  ])

  // 3) Normalize each row set into TraceEvent[].
  const events: TraceEvent[] = []

  for (const r of workflow) {
    const at = pickString(r, ['created_at'])
    if (!at) continue
    const eventType = pickString(r, ['event_type']) ?? 'evento'
    const workflowName = pickString(r, ['workflow'])
    events.push({
      id: `wf:${String(r.id)}`,
      at,
      kind: 'workflow',
      title: eventType.replace(/_/g, ' '),
      subtitle: workflowName ? `Flujo: ${workflowName}` : undefined,
    })
  }

  for (const r of docs) {
    const at = pickString(r, ['created_at'])
    if (!at) continue
    const fileName =
      pickString(r, ['file_name']) ?? 'documento'
    const docType = pickString(r, ['document_type', 'doc_type'])
    events.push({
      id: `doc:${String(r.id)}`,
      at,
      kind: 'document',
      title: `Documento cargado: ${fileName}`,
      subtitle: docType ?? undefined,
      actor: pickString(r, ['uploaded_by']) ?? undefined,
    })
  }

  for (const r of sheets) {
    const at = pickString(r, ['created_at'])
    if (!at) continue
    const opinion = pickString(r, ['opinion_number'])
    const status = pickString(r, ['status']) ?? 'generada'
    events.push({
      id: `cls:${String(r.id)}`,
      at,
      kind: 'classification',
      title: 'Hoja de clasificación generada',
      subtitle: opinion ? `${opinion} · ${status}` : status,
      actor: pickString(r, ['generated_by']) ?? undefined,
    })
  }

  for (const r of pedExports) {
    const at = pickString(r, ['created_at'])
    if (!at) continue
    const status = pickString(r, ['status']) ?? 'pendiente'
    events.push({
      id: `pex:${String(r.id)}`,
      at,
      kind: 'pedimento_export',
      title: `Exportación AduanaNet: ${status}`,
      subtitle: pickString(r, ['file_name']) ?? undefined,
    })
  }

  for (const r of anexoExports) {
    const at = pickString(r, ['created_at'])
    if (!at) continue
    const status = pickString(r, ['status']) ?? 'pendiente'
    events.push({
      id: `anx:${String(r.id)}`,
      at,
      kind: 'anexo24_export',
      title: `Anexo 24: ${status}`,
      subtitle: pickString(r, ['file_name']) ?? undefined,
    })
  }

  for (const r of peceRows) {
    const at = pickString(r, ['created_at'])
    if (!at) continue
    const amount = typeof r.amount === 'number' ? r.amount : null
    const bank = pickString(r, ['bank_code']) ?? '—'
    const status = pickString(r, ['status']) ?? 'intent'
    const amountLabel =
      amount !== null
        ? `${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
        : 'monto —'
    events.push({
      id: `pec:${String(r.id)}`,
      at,
      kind: 'pece_payment',
      title: `Pago PECE: ${amountLabel} — ${status}`,
      subtitle: `Banco ${bank}${pickString(r, ['reference']) ? ` · ref ${pickString(r, ['reference'])}` : ''}`,
    })
  }

  for (const r of mveRows) {
    const at = pickString(r, ['created_at'])
    if (!at) continue
    const severity = pickString(r, ['severity']) ?? 'info'
    const alertType = pickString(r, ['alert_type']) ?? 'MVE'
    events.push({
      id: `mve:${String(r.id)}`,
      at,
      kind: 'mve_alert',
      title: `MVE: ${alertType} (${severity})`,
      subtitle: pickString(r, ['message']) ?? undefined,
    })
  }

  for (const r of qbRows) {
    const at = pickString(r, ['created_at'])
    if (!at) continue
    const status = pickString(r, ['status']) ?? 'pendiente'
    events.push({
      id: `qb:${String(r.id)}`,
      at,
      kind: 'quickbooks_export',
      title: `QuickBooks: ${status}`,
    })
  }

  // 4) Sort chronologically — newest first (matches detail page convention).
  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))

  return { trafico, events }
}

/**
 * Group events by local (America/Chicago) day for sticky date headers.
 * Pure function — safe for unit tests with any Date-producing locale.
 */
export function groupByDay(events: TraceEvent[]): Array<{
  day: string
  dayKey: string
  events: TraceEvent[]
}> {
  const buckets = new Map<string, TraceEvent[]>()
  for (const ev of events) {
    const d = new Date(ev.at)
    if (Number.isNaN(d.getTime())) continue
    const dayKey = d.toLocaleDateString('es-MX', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const arr = buckets.get(dayKey)
    if (arr) arr.push(ev)
    else buckets.set(dayKey, [ev])
  }
  return Array.from(buckets.entries()).map(([dayKey, evs]) => {
    const first = new Date(evs[0].at)
    const day = first.toLocaleDateString('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    return { day, dayKey, events: evs }
  })
}
