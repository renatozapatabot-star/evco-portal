import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { getRequiredDocs, type DocType } from '@/lib/doc-requirements'
import type { Category } from '@/lib/events-catalog'
import { TraficoDetail } from './TraficoDetail'
import type {
  AvailableUserLite,
  DocRow,
  EventRow,
  NoteRow,
  PartidaRow,
  TraficoRow,
} from './types'

/**
 * Tráfico detail — Block 1B server component.
 *
 * Parallel-fetches the 7 row sets the new detail page needs
 * (trafico, events, expediente, partidas, notes, users, company),
 * then passes props into the <TraficoDetail> client shell.
 *
 * Legacy escape hatch: `?legacy=1` redirects to
 * `/traficos/[id]/legacy` — bookmarkable fallback while operators
 * adopt the new surface.
 */
export default async function TraficoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ legacy?: string }>
}) {
  const [{ id: rawId }, sp] = await Promise.all([params, searchParams])
  const traficoId = decodeURIComponent(rawId)

  if (sp?.legacy === '1') redirect(`/traficos/${encodeURIComponent(traficoId)}/legacy`)

  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const supabase = createServerClient()

  let traficoQ = supabase
    .from('traficos')
    .select(
      'trafico, estatus, pedimento, fecha_llegada, importe_total, regimen, company_id, proveedores, descripcion_mercancia, patente, aduana, tipo_operacion, tipo_cambio, peso_bruto, fecha_cruce, semaforo, doda_status, u_level, peso_volumetrico, prevalidador, banco_operacion_numero, sat_transaccion_numero, assigned_to_operator_id, updated_at, created_at',
    )
    .eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)

  const [traficoRes, eventsRes, docsRes, partidasRes, notesRes] = await Promise.all([
    traficoQ.maybeSingle(),
    supabase
      .from('workflow_events')
      .select('id, trigger_id, event_type, workflow, payload, created_at')
      .eq('trigger_id', traficoId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('expediente_documentos')
      .select('id, document_type, document_type_confidence, doc_type, file_name, created_at')
      .eq('trafico_id', traficoId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('globalpc_partidas')
      .select(
        'id, numero_parte, descripcion, fraccion_arancelaria, fraccion, cantidad, cantidad_bultos, peso_bruto, valor_comercial, umc, pais_origen, regimen, tmec',
      )
      .eq('cve_trafico', traficoId)
      .limit(500),
    supabase
      .from('trafico_notes')
      .select('id, author_id, content, mentions, created_at')
      .eq('trafico_id', traficoId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const trafico = traficoRes.data as TraficoRow | null
  if (!trafico) notFound()

  const rawEvents =
    (eventsRes.data as Array<{
      id: string
      trigger_id: string
      event_type: string
      workflow: string | null
      payload: Record<string, unknown> | null
      created_at: string
    }> | null) ?? []

  // Hydrate events with events_catalog metadata (icon/category/copy).
  // One round-trip, keyed by the distinct event_types in the page's events.
  const eventTypeKeys = Array.from(new Set(rawEvents.map((r) => r.event_type)))
  const catalog: Record<
    string,
    {
      category: Category
      visibility: 'public' | 'private'
      display_name_es: string
      description_es: string | null
      icon_name: string | null
      color_token: string | null
    }
  > = {}
  if (eventTypeKeys.length > 0) {
    const { data: catalogRows } = await supabase
      .from('events_catalog')
      .select('event_type, category, visibility, display_name_es, description_es, icon_name, color_token')
      .in('event_type', eventTypeKeys)
    if (Array.isArray(catalogRows)) {
      for (const row of catalogRows as Array<{
        event_type: string
        category: Category
        visibility: 'public' | 'private'
        display_name_es: string
        description_es: string | null
        icon_name: string | null
        color_token: string | null
      }>) {
        catalog[row.event_type] = {
          category: row.category,
          visibility: row.visibility,
          display_name_es: row.display_name_es,
          description_es: row.description_es,
          icon_name: row.icon_name,
          color_token: row.color_token,
        }
      }
    }
  }

  const events: EventRow[] = rawEvents.map((r) => {
    const meta = catalog[r.event_type]
    return {
      ...r,
      category: meta?.category ?? null,
      visibility: meta?.visibility ?? null,
      display_name_es: meta?.display_name_es ?? null,
      description_es: meta?.description_es ?? null,
      icon_name: meta?.icon_name ?? null,
      color_token: meta?.color_token ?? null,
    }
  })

  const docs = ((docsRes.data as DocRow[] | null) ?? [])
  const partidas = ((partidasRes.data as PartidaRow[] | null) ?? [])
  const notes = ((notesRes.data as NoteRow[] | null) ?? [])

  // Best-effort operator roster. The app has `client_users` only; we map
  // role IN (operator, admin, broker) into {companyId}:{role} composites
  // so mentions resolve against what already exists.
  let availableUsers: AvailableUserLite[] = []
  try {
    const { data: roster } = await supabase
      .from('client_users')
      .select('company_id, role, display_name')
      .in('role', ['operator', 'admin', 'broker'])
      .limit(200)
    if (Array.isArray(roster)) {
      availableUsers = (
        roster as Array<{ company_id: string | null; role: string | null; display_name: string | null }>
      )
        .filter((u) => u.company_id && u.role)
        .map((u) => ({
          id: `${u.company_id}:${u.role}`,
          label: u.display_name ? `${u.display_name} (${u.role})` : `${u.company_id}:${u.role}`,
        }))
    }
  } catch {
    // client_users may not exist in every env — graceful empty fallback.
    availableUsers = []
  }

  // Company name — one-shot lookup.
  let clientName = trafico.company_id ?? '—'
  let clientRfc: string | null = null
  if (trafico.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('company_id, name, rfc')
      .eq('company_id', trafico.company_id)
      .maybeSingle()
    const c = company as { name: string | null; rfc: string | null } | null
    if (c?.name) clientName = c.name
    clientRfc = c?.rfc ?? null
  }

  // Missing-docs computation — drives hero tile color + solicitud modal.
  const requiredDocs = getRequiredDocs(trafico.regimen)
  const uploadedDocTypes = new Set(
    docs.map((d) => (d.document_type ?? d.doc_type ?? '') as string).filter(Boolean),
  )
  const missingDocs: DocType[] = requiredDocs.filter((d) => !uploadedDocTypes.has(d))
  const uploadedRequiredCount = requiredDocs.length - missingDocs.length

  const currentUserId = `${session.companyId}:${session.role}`

  return (
    <TraficoDetail
      traficoId={traficoId}
      trafico={trafico}
      events={events}
      docs={docs}
      partidas={partidas}
      notes={notes}
      availableUsers={availableUsers}
      clientName={clientName}
      clientRfc={clientRfc}
      isInternal={isInternal}
      currentUserId={currentUserId}
      missingDocs={missingDocs}
      requiredDocsCount={requiredDocs.length}
      uploadedRequiredCount={uploadedRequiredCount}
    />
  )
}
