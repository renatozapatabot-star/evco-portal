import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import type { PortalRole } from '@/lib/session'
import { AguilaForbiddenError, canSeeAllClients, canSeeFinance } from './roles'
import { resolveMentions, type MentionResult } from './mentions'
import { getActiveCveProductos, activeCvesArray } from '@/lib/anexo24/active-parts'
import {
  runIntelligenceAgent,
  type AgentReport,
} from '@/lib/intelligence/agent'
import type { Recommendation } from '@/lib/intelligence/recommend'
import type { FullCrossingInsight } from '@/lib/intelligence/full-insight'
import { withDecisionLog } from '@/lib/intelligence/decision-log'
import { findDuplicates } from '@/lib/invoice-dedup'
import { classifyDocumentSmart } from '@/lib/docs/classify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface AguilaCtx {
  companyId: string
  role: PortalRole
  userId: string | null
  operatorId: string | null
  supabase: SupabaseClient
}

export type ToolName =
  | 'query_traficos'
  | 'query_pedimentos'
  | 'query_catalogo'
  | 'query_financiero'
  | 'query_expedientes'
  | 'route_mention'
  | 'analyze_trafico'
  | 'analyze_pedimento'
  | 'tenant_anomalies'
  | 'intelligence_scan'
  | 'draft_mensajeria'
  | 'learning_report'
  | 'check_invoice_duplicate'
  | 'classify_document'
  | 'inbox_summary'

/**
 * Anthropic tool definitions. Kept deliberately small so Haiku picks the
 * right tool without a 2k-token schema blob.
 */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'query_traficos',
    description:
      'Consulta embarques (shipments). Usuarios internos pueden filtrar por clave de cliente; clientes solo ven los propios. Devuelve conteo, desglose de estatus y el último cruce.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filtro opcional por estatus exacto (ej. "En Proceso")' },
        sinceDays: { type: 'number', description: 'Ventana de días hacia atrás. Default 14.' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
  {
    name: 'query_pedimentos',
    description:
      'Consulta pedimentos por mes. Devuelve total del mes y el último pedimento.',
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'YYYY-MM. Default: mes actual America/Chicago.' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
  {
    name: 'query_catalogo',
    description:
      'Top fracciones arancelarias del cliente y ahorros T-MEC YTD si están disponibles.',
    input_schema: {
      type: 'object',
      properties: {
        topN: { type: 'number', description: 'Cantidad de fracciones top. Default 5.' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
  {
    name: 'query_financiero',
    description:
      'Lectura financiera: facturación últimos 30 días, CxC vencida, pagos recibidos del mes. RESTRINGIDO a admin/broker/contabilidad.',
    input_schema: {
      type: 'object',
      properties: {
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos con acceso financiero).' },
      },
    },
  },
  {
    name: 'query_expedientes',
    description:
      'Estado de expedientes documentales: % de completitud y documentos pendientes.',
    input_schema: {
      type: 'object',
      properties: {
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
  {
    name: 'route_mention',
    description:
      'Resuelve @menciones en el mensaje y devuelve destinatarios. Úsalo cuando el usuario mencione a alguien con @.',
    input_schema: {
      type: 'object',
      properties: {
        rawMessage: { type: 'string', description: 'Texto completo del mensaje del usuario.' },
      },
      required: ['rawMessage'],
    },
  },
  {
    name: 'analyze_trafico',
    description:
      'Análisis completo de un tráfico (shipment): predicción verde, racha, proveedor dominante, fracción, recomendaciones accionables. Úsalo cuando el usuario pregunte "¿cómo se ve el tráfico X?" o similar.',
    input_schema: {
      type: 'object',
      properties: {
        traficoId: { type: 'string', description: 'Clave del tráfico (cve_trafico).' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
      required: ['traficoId'],
    },
  },
  {
    name: 'analyze_pedimento',
    description:
      'Análisis completo de un pedimento: resuelve el tráfico asociado y devuelve predicción + recomendaciones. Espera el pedimento en formato "DD AD PPPP SSSSSSS" o el número sin espacios.',
    input_schema: {
      type: 'object',
      properties: {
        pedimentoNumber: { type: 'string', description: 'Número de pedimento.' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
      required: ['pedimentoNumber'],
    },
  },
  {
    name: 'tenant_anomalies',
    description:
      'Lista las anomalías operativas del cliente en la ventana reciente (proveedor nuevo, salto de volumen, racha rota, etc.) con resumen en español.',
    input_schema: {
      type: 'object',
      properties: {
        windowDays: { type: 'number', description: 'Ventana de análisis en días. Default 90.' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
  {
    name: 'intelligence_scan',
    description:
      'Escaneo completo de inteligencia para el tenant: verde base, anomalías, top SKUs en riesgo y recomendaciones priorizadas. Úsalo para preguntas abiertas tipo "¿cómo está la operación?" o "dame un panorama".',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Consulta libre del usuario (opcional). Si menciona "anomalías" o "alertas" se restringe al modo anomaly_only.' },
        windowDays: { type: 'number', description: 'Ventana de análisis en días. Default 90.' },
        topFocusCount: { type: 'number', description: 'Número máximo de SKUs foco a expandir. Default 3.' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
  {
    name: 'draft_mensajeria',
    description:
      'Genera un borrador de mensaje en español (cliente / interno / conductor) — NO envía. Escenarios: heads-up preventivo de cruce, solicitud de documentos, actualización de estatus de pedimento, escalación de anomalía, despacho de conductor. Úsalo cuando el usuario pida "prepara un borrador", "redacta una alerta", o similar. Todo borrador queda persistido en agent_decisions y espera aprobación humana antes de enviarse.',
    input_schema: {
      type: 'object',
      properties: {
        traficoId: { type: 'string', description: 'Tráfico destino (enruta a preventive_alert / document_request según señales).' },
        pedimentoNumber: { type: 'string', description: 'Pedimento destino (útil para status_update tras transición de estatus).' },
        statusEs: { type: 'string', description: 'Estatus en español para una actualización de pedimento (ej. "En proceso", "Cruzado", "Liberado").' },
        anomalyKind: { type: 'string', description: 'Cuando se escala una anomalía: tipo (new_proveedor, volume_spike, etc.).' },
        anomalySubject: { type: 'string', description: 'Sujeto de la anomalía (proveedor, SKU, etc.).' },
        anomalyDetail: { type: 'string', description: 'Detalle en español de la anomalía.' },
        messageType: { type: 'string', description: 'Tipo forzado: preventive_alert | document_request | status_update | anomaly_escalation | driver_dispatch.' },
        productName: { type: 'string', description: 'Nombre amigable del producto (reemplaza el SKU crudo en copy cliente).' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
  {
    name: 'learning_report',
    description:
      'Genera un reporte de aprendizaje (semanal por defecto): precisión de predicciones, aceptación por herramienta, aprobación por plantilla de borrador, tendencia del tone-guard + sugerencias accionables. Solo lectura — propone ajustes, no los aplica. Úsalo para preguntas tipo "¿cómo ha estado el desempeño del agente?" o "dame el reporte de aprendizaje".',
    input_schema: {
      type: 'object',
      properties: {
        windowDays: { type: 'number', description: 'Ventana de análisis en días. Default 7. Rango 1..90.' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
  {
    name: 'check_invoice_duplicate',
    description:
      'Busca facturas duplicadas o casi-duplicadas en el banco del cliente. Devuelve cubos exact / near / fuzzy con la razón de la coincidencia. Úsalo cuando el usuario pregunte "¿ya subí esta factura?", "¿hay duplicados?", o antes de confirmar una carga.',
    input_schema: {
      type: 'object',
      properties: {
        invoiceNumber: { type: 'string', description: 'Folio o número de factura.' },
        supplierName: { type: 'string', description: 'Nombre del proveedor (opcional, útil para "near" match).' },
        supplierRfc: { type: 'string', description: 'RFC del proveedor (opcional, produce match autoritativo con folio).' },
        amount: { type: 'number', description: 'Monto total (opcional).' },
        currency: { type: 'string', description: 'MXN o USD (opcional).' },
        invoiceDate: { type: 'string', description: 'Fecha de la factura en ISO (opcional, para ventana ±60 días).' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
  {
    name: 'classify_document',
    description:
      'Clasifica un documento aduanal (factura, BL, pedimento, carta porte, certificado de origen, etc.) combinando heurísticas + Claude Vision. Devuelve { smartType, confidence, source }. Úsalo cuando el usuario pregunte "¿qué tipo de documento es este?" o "clasifica este archivo".',
    input_schema: {
      type: 'object',
      properties: {
        fileUrl: { type: 'string', description: 'URL pública del archivo en el bucket expedientes.' },
        invoiceBankId: { type: 'string', description: 'ID de la factura en pedimento_facturas (se resuelve el fileUrl).' },
        filename: { type: 'string', description: 'Nombre original del archivo (mejora heurísticas).' },
        mimeType: { type: 'string', description: 'MIME type del archivo (mejora heurísticas).' },
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
  {
    name: 'inbox_summary',
    description:
      'Resumen de la Bandeja de documentos: cuántas facturas pendientes de clasificar/asignar, desglose por tipo sugerido, cuántas tienen posible duplicado. Úsalo cuando el usuario pregunte "¿qué documentos faltan?", "¿cómo va la bandeja?", "¿qué hay pendiente?".',
    input_schema: {
      type: 'object',
      properties: {
        clientFilter: { type: 'string', description: 'Clave de cliente (solo para internos).' },
      },
    },
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a client filter to a company_id using the companies table.
 * Returns null if the caller is not internal (they cannot override scope)
 * or if the clave is unknown.
 */
async function resolveClientScope(
  ctx: AguilaCtx,
  clientFilter: string | undefined,
): Promise<{ companyId: string | null; allClients: boolean }> {
  // Clients and warehouse are always pinned to their own company_id.
  if (!canSeeAllClients(ctx.role)) {
    return { companyId: ctx.companyId, allClients: false }
  }

  // No filter + internal role = cross-client view.
  if (!clientFilter) {
    return { companyId: null, allClients: true }
  }

  const trimmed = clientFilter.trim()
  if (!trimmed) return { companyId: null, allClients: true }

  // Try clave first, then company_id directly.
  const { data } = await supabaseAdmin
    .from('companies')
    .select('company_id')
    .or(`clave_cliente.eq.${trimmed},company_id.eq.${trimmed}`)
    .maybeSingle()

  // Admin provided a filter that doesn't resolve. Silently dropping to an
  // unfiltered query would cross-tenant on a typo; refuse instead.
  if (!data) throw new AguilaForbiddenError(`scope:unknown_client:${trimmed}`)
  return { companyId: data.company_id, allClients: false }
}

function currentMonthChicago(): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}`
}

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

interface TraficosArgs { status?: string; sinceDays?: number; clientFilter?: string }

async function execQueryTraficos(args: TraficosArgs, ctx: AguilaCtx) {
  const scope = await resolveClientScope(ctx, args.clientFilter)
  const sinceDays = args.sinceDays ?? 14
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString()

  let q = supabaseAdmin
    .from('traficos')
    .select('trafico, estatus, fecha_cruce, fecha_llegada, importe_total')
    .gte('fecha_llegada', since)
    .order('fecha_llegada', { ascending: false })
    .limit(200)

  if (!scope.allClients && scope.companyId) q = q.eq('company_id', scope.companyId)
  if (args.status) q = q.eq('estatus', args.status)

  const { data, error } = await q
  if (error) throw new Error(`traficos:${error.message}`)

  const statusBreakdown: Record<string, number> = {}
  let lastCrossed: { trafico: string; fecha_cruce: string } | null = null
  for (const t of data ?? []) {
    const s = String(t.estatus || 'desconocido')
    statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1
    if (t.fecha_cruce && !lastCrossed) {
      lastCrossed = { trafico: String(t.trafico), fecha_cruce: String(t.fecha_cruce) }
    }
  }

  return {
    scope: scope.allClients ? 'all_clients' : scope.companyId,
    count: data?.length ?? 0,
    statusBreakdown,
    lastCrossed,
  }
}

interface PedimentosArgs { month?: string; clientFilter?: string }

async function execQueryPedimentos(args: PedimentosArgs, ctx: AguilaCtx) {
  const scope = await resolveClientScope(ctx, args.clientFilter)
  const month = args.month || currentMonthChicago()
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr), mo = Number(monthStr)
  if (!year || !mo) throw new Error('pedimentos:bad_month')
  const start = new Date(Date.UTC(year, mo - 1, 1)).toISOString()
  const end = new Date(Date.UTC(year, mo, 1)).toISOString()

  let q = supabaseAdmin
    .from('pedimentos')
    .select('pedimento_number, created_at, status, company_id')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!scope.allClients && scope.companyId) q = q.eq('company_id', scope.companyId)

  const { data, error } = await q
  if (error) throw new Error(`pedimentos:${error.message}`)

  const statusBreakdown: Record<string, number> = {}
  for (const p of data ?? []) {
    const s = String(p.status || 'desconocido')
    statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1
  }
  const last = data?.[0]
  return {
    scope: scope.allClients ? 'all_clients' : scope.companyId,
    month,
    countThisMonth: data?.length ?? 0,
    lastPedimento: last ? { pedimento_number: last.pedimento_number, created_at: last.created_at } : null,
    statusBreakdown,
  }
}

interface CatalogoArgs { topN?: number; clientFilter?: string }

async function execQueryCatalogo(args: CatalogoArgs, ctx: AguilaCtx) {
  const scope = await resolveClientScope(ctx, args.clientFilter)
  const topN = Math.min(Math.max(args.topN ?? 5, 1), 20)

  // Per-tenant catalog reads MUST also filter by the active-parts allowlist
  // (cve_productos this client has actually imported) or legacy rows tagged
  // with this company_id — pre-Block-EE residue, orphan syncs — surface to
  // the client. Contract: .claude/rules/tenant-isolation.md. Admin/broker
  // with allClients=true intentionally bypasses both filters for oversight.
  let activeList: string[] | null = null
  if (!scope.allClients && scope.companyId) {
    activeList = activeCvesArray(
      await getActiveCveProductos(supabaseAdmin, scope.companyId),
    )
    if (activeList.length === 0) {
      return {
        scope: scope.companyId,
        topFracciones: [],
        tmecSavingsYtd: null,
        note: 'Sin partes verificadas en anexo 24 · catálogo aún no disponible.',
      }
    }
  }

  let q = supabaseAdmin
    .from('globalpc_productos')
    .select('fraccion, descripcion')
    .not('fraccion', 'is', null)

  if (!scope.allClients && scope.companyId && activeList) {
    q = q.eq('company_id', scope.companyId).in('cve_producto', activeList)
  }

  const { data, error } = await q.limit(5000)
  if (error) throw new Error(`catalogo:${error.message}`)

  const counts = new Map<string, { count: number; descripcion: string }>()
  for (const p of data ?? []) {
    const f = String(p.fraccion)
    const prev = counts.get(f)
    if (prev) prev.count++
    else counts.set(f, { count: 1, descripcion: String(p.descripcion ?? '') })
  }
  const topFracciones = Array.from(counts.entries())
    .map(([fraccion, v]) => ({ fraccion, count: v.count, descripcion: v.descripcion }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)

  return {
    scope: scope.allClients ? 'all_clients' : scope.companyId,
    topFracciones,
    tmecSavingsYtd: null, // Requires tariff join not yet wired — do not fabricate
    note: 'Ahorros T-MEC YTD requiere cruce con tabla de tarifas, no disponible aún.',
  }
}

interface FinancieroArgs { clientFilter?: string }

async function execQueryFinanciero(args: FinancieroArgs, ctx: AguilaCtx) {
  if (!canSeeFinance(ctx.role)) {
    throw new AguilaForbiddenError('financiero:role_denied')
  }

  const scope = await resolveClientScope(ctx, args.clientFilter)
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString()
  const month = currentMonthChicago()
  const [yearStr, monthStr] = month.split('-')
  const start = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, 1)).toISOString()
  const end = new Date(Date.UTC(Number(yearStr), Number(monthStr), 1)).toISOString()

  // Resolve clave_cliente for econta queries (they use scvecliente / scveclientepropia)
  let claveFilter: string | null = null
  if (!scope.allClients && scope.companyId) {
    const { data } = await supabaseAdmin
      .from('companies').select('clave_cliente').eq('company_id', scope.companyId).maybeSingle()
    claveFilter = data?.clave_cliente ?? null
  }

  const facturasQ = supabaseAdmin
    .from('econta_facturas').select('rtotal, bfacturapagada, dfechahora, scveclientepropia')
    .gte('dfechahora', thirtyDaysAgo).limit(5000)
  if (claveFilter) facturasQ.eq('scveclientepropia', claveFilter)

  const pagadasQ = supabaseAdmin
    .from('econta_facturas').select('rtotal, dfechahora, scveclientepropia')
    .eq('bfacturapagada', true).gte('dfechahora', start).lt('dfechahora', end).limit(5000)
  if (claveFilter) pagadasQ.eq('scveclientepropia', claveFilter)

  const carteraQ = supabaseAdmin
    .from('econta_cartera').select('rcargo, rabono, etipocargoabono, scvecliente').limit(5000)
  if (claveFilter) carteraQ.eq('scvecliente', claveFilter)

  const [facRes, pagRes, carRes] = await Promise.allSettled([facturasQ, pagadasQ, carteraQ])

  const mrrLast30d = facRes.status === 'fulfilled'
    ? (facRes.value.data ?? []).reduce((s, r) => s + Number(r.rtotal || 0), 0)
    : 0
  const pagosRecibidosMes = pagRes.status === 'fulfilled'
    ? (pagRes.value.data ?? []).reduce((s, r) => s + Number(r.rtotal || 0), 0)
    : 0
  const cxcVencido = carRes.status === 'fulfilled'
    ? (carRes.value.data ?? [])
        .filter(r => String(r.etipocargoabono || '').toLowerCase().startsWith('c'))
        .reduce((s, r) => s + (Number(r.rcargo || 0) - Number(r.rabono || 0)), 0)
    : 0

  return {
    scope: scope.allClients ? 'all_clients' : scope.companyId,
    mrrLast30d: Math.round(mrrLast30d * 100) / 100,
    cxcVencido: Math.round(cxcVencido * 100) / 100,
    pagosRecibidosMes: Math.round(pagosRecibidosMes * 100) / 100,
    currency: 'MXN',
  }
}

interface ExpedientesArgs { clientFilter?: string }

async function execQueryExpedientes(args: ExpedientesArgs, ctx: AguilaCtx) {
  const scope = await resolveClientScope(ctx, args.clientFilter)
  // expediente_documentos real columns: doc_type, file_name, file_url,
  // metadata (jsonb), pedimento_id, uploaded_at, uploaded_by. There is no
  // doc_type_code or document_type_confidence — legacy phantoms (M15 sweep).
  let q = supabaseAdmin
    .from('expediente_documentos')
    .select('doc_type')
    .limit(2000)
  if (!scope.allClients && scope.companyId) q = q.eq('company_id', scope.companyId)

  const { data, error } = await q
  if (error) throw new Error(`expedientes:${error.message}`)

  const total = data?.length ?? 0
  const classified = (data ?? []).filter(d => d.doc_type).length
  const pending = total - classified
  const completenessPct = total === 0 ? 0 : Math.round((classified / total) * 100)

  const missingTypes = new Set<string>()
  for (const d of data ?? []) {
    if (!d.doc_type) missingTypes.add('sin_clasificar')
  }

  return {
    scope: scope.allClients ? 'all_clients' : scope.companyId,
    completenessPct,
    pendingCount: pending,
    total,
    missingDocTypes: Array.from(missingTypes),
  }
}

interface MentionArgs { rawMessage?: string }

async function execRouteMention(args: MentionArgs, ctx: AguilaCtx): Promise<MentionResult> {
  return resolveMentions(String(args.rawMessage ?? ''), ctx.role)
}

// ---------------------------------------------------------------------------
// Phase 4 · V2 Doc Intelligence tools
// ---------------------------------------------------------------------------

interface CheckDuplicateArgs {
  invoiceNumber?: string
  supplierName?: string
  supplierRfc?: string
  amount?: number
  currency?: string
  invoiceDate?: string
  clientFilter?: string
}

async function execCheckInvoiceDuplicate(args: CheckDuplicateArgs, ctx: AguilaCtx) {
  const scope = await resolveClientScope(ctx, args.clientFilter)
  // Client role pins to its own companyId; admin/broker with no filter
  // means "show me duplicates across all clients" which we refuse here
  // (dedup is inherently per-tenant — there's no sensible cross-tenant
  // question). Force a specific tenant for this tool.
  const companyId = scope.companyId ?? ctx.companyId
  if (!companyId) throw new AguilaForbiddenError('scope:dedup_requires_tenant')

  const res = await findDuplicates(supabaseAdmin, {
    companyId,
    invoiceNumber: args.invoiceNumber ?? null,
    supplierName: args.supplierName ?? null,
    supplierRfc: args.supplierRfc ?? null,
    amount: args.amount ?? null,
    currency: args.currency ?? null,
    invoiceDate: args.invoiceDate ?? null,
  })

  // Summarize for the LLM — keep the payload compact.
  return {
    scope: companyId,
    total: res.total,
    exactCount: res.exact.length,
    nearCount: res.near.length,
    fuzzyCount: res.fuzzy.length,
    topMatches: [...res.exact, ...res.near, ...res.fuzzy].slice(0, 5).map((m) => ({
      id: m.id,
      bucket: m.bucket,
      score: m.score,
      reasons: m.reasons,
      invoice_number: m.invoice_number,
      supplier_name: m.supplier_name,
      amount: m.amount,
      currency: m.currency,
      received_at: m.received_at,
    })),
  }
}

interface ClassifyDocumentArgs {
  fileUrl?: string
  invoiceBankId?: string
  filename?: string
  mimeType?: string
  clientFilter?: string
}

async function execClassifyDocument(args: ClassifyDocumentArgs, ctx: AguilaCtx) {
  const scope = await resolveClientScope(ctx, args.clientFilter)
  const companyId = scope.companyId ?? ctx.companyId
  if (!companyId) throw new AguilaForbiddenError('scope:classify_requires_tenant')

  let fileUrl = args.fileUrl ?? null
  let filename = args.filename ?? null
  let mimeType = args.mimeType ?? null

  // Resolve invoiceBankId → fileUrl when the caller passed just an id.
  if (!fileUrl && args.invoiceBankId) {
    const { data } = await supabaseAdmin
      .from('pedimento_facturas')
      .select('file_url, company_id')
      .eq('id', args.invoiceBankId)
      .maybeSingle()
    if (!data) throw new Error('classify:invoice_not_found')
    // Tenant guard — refuse to classify another tenant's invoice even
    // for internal roles that didn't scope themselves explicitly.
    if (data.company_id && data.company_id !== companyId) {
      throw new AguilaForbiddenError('scope:invoice_other_tenant')
    }
    fileUrl = data.file_url as string | null
  }

  if (!fileUrl) throw new Error('classify:missing_fileUrl')
  // Derive filename from the URL's last path segment when not supplied.
  if (!filename) {
    try {
      filename = fileUrl.split('/').pop()?.split('?')[0] ?? 'unknown'
    } catch {
      filename = 'unknown'
    }
  }
  if (!mimeType) {
    const lower = (filename ?? '').toLowerCase()
    if (lower.endsWith('.pdf')) mimeType = 'application/pdf'
    else if (lower.endsWith('.xml')) mimeType = 'application/xml'
    else if (lower.endsWith('.png')) mimeType = 'image/png'
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mimeType = 'image/jpeg'
    else mimeType = 'application/octet-stream'
  }

  const result = await classifyDocumentSmart({
    fileUrl,
    filename: filename ?? 'unknown',
    mimeType,
    companyId,
    linkToInvoiceBankId: args.invoiceBankId ?? null,
    actor: `${ctx.role}:${ctx.operatorId ?? ctx.userId ?? 'aguila'}`,
  })

  return {
    scope: companyId,
    smartType: result.smartType,
    confidence: result.confidence,
    source: result.source,
    reason: result.reason,
    hasExtraction: !!result.extraction,
    // Only surface safe, bounded fields from the extraction — no raw
    // line items (they bloat the LLM transcript).
    supplier: result.extraction?.supplier ?? null,
    invoice_number: result.extraction?.invoice_number ?? null,
    amount: result.extraction?.amount ?? null,
    currency: result.extraction?.currency ?? null,
    notConfigured: result.notConfigured,
    error: result.error,
  }
}

interface InboxSummaryArgs { clientFilter?: string }

async function execInboxSummary(args: InboxSummaryArgs, ctx: AguilaCtx) {
  const scope = await resolveClientScope(ctx, args.clientFilter)
  const companyId = scope.companyId ?? ctx.companyId
  if (!companyId) throw new AguilaForbiddenError('scope:inbox_requires_tenant')

  // Pull a representative slice of unassigned invoices + their latest
  // classification to shape the summary. 200 rows is enough to rank
  // top types; beyond that the ranking converges.
  const { data: invoices } = await supabaseAdmin
    .from('pedimento_facturas')
    .select('id, file_hash, normalized_invoice_number, supplier_rfc')
    .eq('company_id', companyId)
    .eq('status', 'unassigned')
    .limit(500)

  const rows = (invoices ?? []) as Array<{
    id: string
    file_hash: string | null
    normalized_invoice_number: string | null
    supplier_rfc: string | null
  }>

  // Duplicate flag (same grouping logic the /api/inbox uses).
  const hashCounts = new Map<string, number>()
  const rfcInvoiceCounts = new Map<string, number>()
  for (const r of rows) {
    if (r.file_hash) hashCounts.set(r.file_hash, (hashCounts.get(r.file_hash) ?? 0) + 1)
    if (r.supplier_rfc && r.normalized_invoice_number) {
      const k = `${r.supplier_rfc}|${r.normalized_invoice_number}`
      rfcInvoiceCounts.set(k, (rfcInvoiceCounts.get(k) ?? 0) + 1)
    }
  }
  const duplicatesCount = rows.filter((r) => {
    if (r.file_hash && (hashCounts.get(r.file_hash) ?? 0) > 1) return true
    if (r.supplier_rfc && r.normalized_invoice_number) {
      const k = `${r.supplier_rfc}|${r.normalized_invoice_number}`
      if ((rfcInvoiceCounts.get(k) ?? 0) > 1) return true
    }
    return false
  }).length

  // Type breakdown — latest classification per invoice_bank_id.
  const ids = rows.map((r) => r.id)
  const byType: Record<string, number> = {}
  let withoutSuggestion = rows.length
  if (ids.length > 0) {
    const { data: classes } = await supabaseAdmin
      .from('document_classifications')
      .select('invoice_bank_id, doc_type, created_at')
      .in('invoice_bank_id', ids)
      .order('created_at', { ascending: false })
      .limit(ids.length * 3)
    const seen = new Set<string>()
    for (const c of (classes ?? []) as Array<{
      invoice_bank_id: string
      doc_type: string | null
    }>) {
      if (!c.invoice_bank_id || seen.has(c.invoice_bank_id)) continue
      seen.add(c.invoice_bank_id)
      const key = c.doc_type ?? 'sin_clasificar'
      byType[key] = (byType[key] ?? 0) + 1
    }
    withoutSuggestion = rows.length - seen.size
  }

  return {
    scope: companyId,
    inboxCount: rows.length,
    byType,
    withoutSuggestion,
    duplicatesCount,
    link: '/bandeja-documentos',
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export interface ToolResult {
  tool: ToolName
  result: unknown
  forbidden?: boolean
  error?: string
}

export async function runTool(
  tool: ToolName,
  rawArgs: unknown,
  ctx: AguilaCtx,
): Promise<ToolResult> {
  const args = (rawArgs ?? {}) as Record<string, unknown>
  try {
    switch (tool) {
      case 'query_traficos':
        return { tool, result: await execQueryTraficos(args as TraficosArgs, ctx) }
      case 'query_pedimentos':
        return { tool, result: await execQueryPedimentos(args as PedimentosArgs, ctx) }
      case 'query_catalogo':
        return { tool, result: await execQueryCatalogo(args as CatalogoArgs, ctx) }
      case 'query_financiero':
        return { tool, result: await execQueryFinanciero(args as FinancieroArgs, ctx) }
      case 'query_expedientes':
        return { tool, result: await execQueryExpedientes(args as ExpedientesArgs, ctx) }
      case 'route_mention':
        return { tool, result: await execRouteMention(args as MentionArgs, ctx) }
      case 'analyze_trafico':
        return { tool, result: await execAnalyzeTrafico(args as AnalyzeTraficoArgs, ctx) }
      case 'analyze_pedimento':
        return { tool, result: await execAnalyzePedimento(args as AnalyzePedimentoArgs, ctx) }
      case 'tenant_anomalies':
        return { tool, result: await execTenantAnomalies(args as TenantAnomaliesArgs, ctx) }
      case 'intelligence_scan':
        return { tool, result: await execIntelligenceScan(args as IntelligenceScanArgs, ctx) }
      case 'draft_mensajeria':
        return { tool, result: await execDraftMensajeria(args as DraftMensajeriaArgs, ctx) }
      case 'learning_report':
        return { tool, result: await execLearningReport(args as LearningReportArgs, ctx) }
      case 'check_invoice_duplicate':
        return { tool, result: await execCheckInvoiceDuplicate(args as CheckDuplicateArgs, ctx) }
      case 'classify_document':
        return { tool, result: await execClassifyDocument(args as ClassifyDocumentArgs, ctx) }
      case 'inbox_summary':
        return { tool, result: await execInboxSummary(args as InboxSummaryArgs, ctx) }
      default:
        return { tool, result: null, error: `unknown_tool:${tool}` }
    }
  } catch (err) {
    if (err instanceof AguilaForbiddenError) {
      return {
        tool,
        result: { error: 'forbidden', message: 'No tienes permiso para esta información.' },
        forbidden: true,
      }
    }
    const msg = err instanceof Error ? err.message : String(err)
    return { tool, result: { error: 'tool_failed', message: msg }, error: msg }
  }
}

// =============================================================================
// PHASE 3 #1 — CRUZ AI Natural-Language Intelligence Interface
// =============================================================================
//
// Layer on top of the Phase 2 autonomous agent. Every tool below:
//   1. Calls `runIntelligenceAgent` under the hood (no new DB logic).
//   2. Returns a consistent `{ success, data, error }` envelope.
//   3. Shapes the agent's structured output into operator-friendly Spanish.
//   4. Is exported as a standalone function (testable + callable from
//      scripts / other modules) AND registered as an Anthropic tool
//      (callable by CRUZ AI chat routing).
//
// Safety:
//   - Read-only. No writes, no external side effects (no Telegram, no
//     Mensajería sends). Scripts that act on this output wire those
//     separately behind the approval gate.
//   - Tenant isolation enforced via `resolveClientScope`. Clients + warehouse
//     cannot override scope; internals can pass `clientFilter` to inspect a
//     specific tenant (or omit it to refuse — we never run an agent scan
//     against `null` tenant).

/** Unified response envelope for every agent-tool. */
export interface AgentToolResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

// ── Types: focus responses ─────────────────────────────────────────

export interface FocusResponseEs {
  type: 'sku_focus' | 'trafico_focus'
  headline_es: string
  summary_es: string
  cve_producto: string
  trafico_id: string | null
  probability_pct: number
  band_es: 'alta' | 'media' | 'baja'
  proveedor: string | null
  fraccion: string | null
  factors: Array<{
    label_es: string
    impact_pp: number
    tone: 'positive' | 'negative' | 'neutral'
  }>
  recommendations: Array<{
    priority_es: 'alta' | 'media' | 'baja'
    action_es: string
    rationale_es: string
  }>
  next_steps_es: string[]
}

export interface TenantScanResponseEs {
  type: 'tenant_scan'
  headline_es: string
  summary_es: string
  company_id: string
  baseline_verde_pct: number
  anomaly_count: number
  anomaly_groups_es: Array<{ label_es: string; count: number }>
  top_focus_es: Array<{
    cve_producto: string
    probability_pct: number
    band_es: 'alta' | 'media' | 'baja'
    summary_es: string
  }>
  recommendations: Array<{
    priority_es: 'alta' | 'media' | 'baja'
    action_es: string
    rationale_es: string
  }>
}

export interface AnomalyOnlyResponseEs {
  type: 'anomaly_only'
  headline_es: string
  summary_es: string
  company_id: string
  anomaly_count: number
  anomaly_groups_es: Array<{
    label_es: string
    count: number
    top_subjects: string[]
  }>
  recommendations: Array<{
    priority_es: 'alta' | 'media' | 'baja'
    action_es: string
    rationale_es: string
  }>
}

export type IntelligenceResponseEs =
  | FocusResponseEs
  | TenantScanResponseEs
  | AnomalyOnlyResponseEs

// ── Spanish formatting helpers ─────────────────────────────────────

function bandEs(band: 'high' | 'medium' | 'low'): 'alta' | 'media' | 'baja' {
  return band === 'high' ? 'alta' : band === 'medium' ? 'media' : 'baja'
}

function priorityEs(p: Recommendation['priority']): 'alta' | 'media' | 'baja' {
  return p === 'high' ? 'alta' : p === 'medium' ? 'media' : 'baja'
}

function formatProveedor(insight: FullCrossingInsight): string | null {
  const prov = insight.signals.proveedor
  if (!prov) return null
  return prov.pct_verde != null
    ? `${prov.cve_proveedor} · ${prov.pct_verde}% verde (${prov.total_crossings} cruces)`
    : prov.cve_proveedor
}

function formatFocus(
  insight: FullCrossingInsight,
  type: 'sku_focus' | 'trafico_focus',
  traficoId: string | null,
): FocusResponseEs {
  const pct = Math.round(insight.signals.prediction.probability * 100)
  const bEs = bandEs(insight.signals.prediction.band)

  return {
    type,
    headline_es:
      type === 'trafico_focus' && traficoId
        ? `Tráfico ${traficoId} · SKU dominante ${insight.cve_producto} · ${pct}% probabilidad verde · confianza ${bEs}`
        : `SKU ${insight.cve_producto} · ${pct}% probabilidad verde · confianza ${bEs}`,
    summary_es: insight.summary_es,
    cve_producto: insight.cve_producto,
    trafico_id: traficoId,
    probability_pct: pct,
    band_es: bEs,
    proveedor: formatProveedor(insight),
    fraccion: insight.signals.fraccion,
    factors: insight.explanation.bullets.map((b) => ({
      label_es: b.label,
      impact_pp: b.signed_delta,
      tone: b.tone,
    })),
    recommendations: insight.recommendations
      .filter((r) => r.kind !== 'no_action')
      .map((r) => ({
        priority_es: priorityEs(r.priority),
        action_es: r.action_es,
        rationale_es: r.rationale_es,
      })),
    next_steps_es: insight.recommendations
      .filter((r) => r.kind !== 'no_action')
      .slice(0, 3)
      .map((r, i) => `${i + 1}. ${r.action_es}`),
  }
}

function formatTenantScan(report: AgentReport): TenantScanResponseEs {
  if (report.mode_label !== 'tenant_scan') {
    throw new Error('formatTenantScan: wrong mode_label')
  }
  return {
    type: 'tenant_scan',
    headline_es: report.summary_es,
    summary_es: report.anomaly_report.summary_es,
    company_id: report.company_id,
    baseline_verde_pct: report.insights.baseline_verde_pct,
    anomaly_count: report.insights.anomalies.length,
    anomaly_groups_es: report.anomaly_report.groups.map((g) => ({
      label_es: g.label_es,
      count: g.anomalies.length,
    })),
    top_focus_es: report.focus_insights.map((f) => ({
      cve_producto: f.cve_producto,
      probability_pct: Math.round(f.signals.prediction.probability * 100),
      band_es: bandEs(f.signals.prediction.band),
      summary_es: f.summary_es,
    })),
    recommendations: report.recommendations
      .filter((r) => r.kind !== 'no_action')
      .map((r) => ({
        priority_es: priorityEs(r.priority),
        action_es: r.action_es,
        rationale_es: r.rationale_es,
      })),
  }
}

function formatAnomalyOnly(report: AgentReport): AnomalyOnlyResponseEs {
  if (report.mode_label !== 'anomaly_only') {
    throw new Error('formatAnomalyOnly: wrong mode_label')
  }
  return {
    type: 'anomaly_only',
    headline_es: report.summary_es,
    summary_es: report.anomaly_report.summary_es,
    company_id: report.company_id,
    anomaly_count: report.anomaly_report.total_count,
    anomaly_groups_es: report.anomaly_report.groups.map((g) => ({
      label_es: g.label_es,
      count: g.anomalies.length,
      top_subjects: g.anomalies.slice(0, 3).map((a) => a.subject),
    })),
    recommendations: report.recommendations
      .filter((r) => r.kind !== 'no_action')
      .map((r) => ({
        priority_es: priorityEs(r.priority),
        action_es: r.action_es,
        rationale_es: r.rationale_es,
      })),
  }
}

// ── Standalone exports ─────────────────────────────────────────────

/**
 * Natural-language analysis of a single tráfico. Delegates to the
 * autonomous intelligence agent and formats the output in Spanish.
 */
export async function analyzeTrafico(
  supabase: SupabaseClient,
  companyId: string,
  traficoId: string,
): Promise<AgentToolResponse<FocusResponseEs>> {
  const cleanId = (traficoId ?? '').trim()
  if (!companyId) {
    return { success: false, data: null, error: 'invalid_companyId' }
  }
  if (!cleanId) {
    return { success: false, data: null, error: 'invalid_traficoId' }
  }

  try {
    const report = await runIntelligenceAgent(supabase, companyId, {
      type: 'trafico',
      traficoId: cleanId,
    })

    if (report.mode_label !== 'trafico_focus' || !report.insight) {
      return {
        success: true,
        data: null,
        error: `Tráfico ${cleanId} sin señal en la ventana — aún no hay base para análisis.`,
      }
    }

    return { success: true, data: formatFocus(report.insight, 'trafico_focus', cleanId), error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, data: null, error: msg }
  }
}

/**
 * Resolve a pedimento number to its parent tráfico and run the analyzer.
 * Accepts either the SAT-spaced form "DD AD PPPP SSSSSSS" or a
 * whitespace-collapsed variant (we normalize before query).
 */
export async function analyzePedimento(
  supabase: SupabaseClient,
  companyId: string,
  pedimentoNumber: string,
): Promise<AgentToolResponse<FocusResponseEs>> {
  if (!companyId) {
    return { success: false, data: null, error: 'invalid_companyId' }
  }
  const clean = (pedimentoNumber ?? '').trim()
  if (!clean) {
    return { success: false, data: null, error: 'invalid_pedimentoNumber' }
  }

  try {
    // Try the pedimento exactly as provided first (SAT canonical form
    // preserves spaces). If no match, try the collapsed form.
    const { data, error } = await supabase
      .from('traficos')
      .select('trafico, pedimento')
      .eq('company_id', companyId)
      .or(`pedimento.eq.${clean},pedimento.eq.${clean.replace(/\s+/g, '')}`)
      .limit(1)
      .maybeSingle()

    if (error) {
      return { success: false, data: null, error: `traficos:${error.message}` }
    }
    const traficoId = (data as { trafico?: string | null } | null)?.trafico
    if (!traficoId) {
      return {
        success: true,
        data: null,
        error: `Pedimento ${clean} no encontrado para este cliente.`,
      }
    }

    return analyzeTrafico(supabase, companyId, traficoId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, data: null, error: msg }
  }
}

/**
 * Tenant-wide anomaly summary. Lighter than a full scan; returns just
 * the anomalies + derived recommendations.
 */
export async function getTenantAnomalies(
  supabase: SupabaseClient,
  companyId: string,
  opts: { windowDays?: number } = {},
): Promise<AgentToolResponse<AnomalyOnlyResponseEs>> {
  if (!companyId) {
    return { success: false, data: null, error: 'invalid_companyId' }
  }
  try {
    const report = await runIntelligenceAgent(supabase, companyId, 'anomaly_only', {
      windowDays: opts.windowDays,
    })
    return { success: true, data: formatAnomalyOnly(report), error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, data: null, error: msg }
  }
}

/**
 * General-purpose entry point. The free-form Spanish `query` selects the
 * agent mode:
 *   - mentions "anomalía", "alerta", "problema" → anomaly_only
 *   - otherwise → tenant_scan (full panorama with focus insights)
 *
 * Designed for CRUZ AI chat routing: Claude picks this tool for open
 * questions like "¿cómo está la operación?" and passes the user's raw
 * message as `query` so we can pick the right depth.
 */
export async function getFullIntelligence(
  supabase: SupabaseClient,
  companyId: string,
  query: string | undefined,
  opts: { windowDays?: number; topFocusCount?: number } = {},
): Promise<AgentToolResponse<TenantScanResponseEs | AnomalyOnlyResponseEs>> {
  if (!companyId) {
    return { success: false, data: null, error: 'invalid_companyId' }
  }

  const q = (query ?? '').toLowerCase()
  const anomalyOnly = /anomal[ií]a|alerta|problema|alerta/i.test(q)

  try {
    if (anomalyOnly) {
      const report = await runIntelligenceAgent(supabase, companyId, 'anomaly_only', {
        windowDays: opts.windowDays,
      })
      return { success: true, data: formatAnomalyOnly(report), error: null }
    }

    const report = await runIntelligenceAgent(supabase, companyId, 'tenant_scan', {
      windowDays: opts.windowDays,
      topFocusCount: opts.topFocusCount,
    })
    return { success: true, data: formatTenantScan(report), error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, data: null, error: msg }
  }
}

// ── Tool executors (CRUZ AI entry points) ──────────────────────────

interface AnalyzeTraficoArgs { traficoId?: string; clientFilter?: string }
interface AnalyzePedimentoArgs { pedimentoNumber?: string; clientFilter?: string }
interface TenantAnomaliesArgs { windowDays?: number; clientFilter?: string }
interface IntelligenceScanArgs {
  query?: string
  windowDays?: number
  topFocusCount?: number
  clientFilter?: string
}

async function resolveScopedCompanyId(
  ctx: AguilaCtx,
  clientFilter: string | undefined,
): Promise<string> {
  const scope = await resolveClientScope(ctx, clientFilter)
  if (scope.allClients || !scope.companyId) {
    // Agent scans demand a concrete tenant. An unscoped "all clients" scan
    // would leak cross-tenant signals into one report. Refuse instead.
    throw new AguilaForbiddenError('agent:tenant_required')
  }
  return scope.companyId
}

async function execAnalyzeTrafico(args: AnalyzeTraficoArgs, ctx: AguilaCtx) {
  const companyId = await resolveScopedCompanyId(ctx, args.clientFilter)
  const traficoId = String(args.traficoId ?? '')
  return withDecisionLog(
    supabaseAdmin,
    {
      companyId,
      toolName: 'analyze_trafico',
      workflow: 'cruz_ai_chat',
      triggerType: 'chat',
      triggerId: traficoId || undefined,
      toolInput: { traficoId, clientFilter: args.clientFilter ?? null },
    },
    () => analyzeTrafico(supabaseAdmin, companyId, traficoId),
  )
}

async function execAnalyzePedimento(args: AnalyzePedimentoArgs, ctx: AguilaCtx) {
  const companyId = await resolveScopedCompanyId(ctx, args.clientFilter)
  const pedimentoNumber = String(args.pedimentoNumber ?? '')
  return withDecisionLog(
    supabaseAdmin,
    {
      companyId,
      toolName: 'analyze_pedimento',
      workflow: 'cruz_ai_chat',
      triggerType: 'chat',
      triggerId: pedimentoNumber || undefined,
      toolInput: { pedimentoNumber, clientFilter: args.clientFilter ?? null },
    },
    () => analyzePedimento(supabaseAdmin, companyId, pedimentoNumber),
  )
}

async function execTenantAnomalies(args: TenantAnomaliesArgs, ctx: AguilaCtx) {
  const companyId = await resolveScopedCompanyId(ctx, args.clientFilter)
  return withDecisionLog(
    supabaseAdmin,
    {
      companyId,
      toolName: 'tenant_anomalies',
      workflow: 'cruz_ai_chat',
      triggerType: 'chat',
      toolInput: { windowDays: args.windowDays ?? null, clientFilter: args.clientFilter ?? null },
    },
    () => getTenantAnomalies(supabaseAdmin, companyId, {
      windowDays: args.windowDays,
    }),
  )
}

async function execIntelligenceScan(args: IntelligenceScanArgs, ctx: AguilaCtx) {
  const companyId = await resolveScopedCompanyId(ctx, args.clientFilter)
  return withDecisionLog(
    supabaseAdmin,
    {
      companyId,
      toolName: 'intelligence_scan',
      workflow: 'cruz_ai_chat',
      triggerType: 'chat',
      toolInput: {
        query: args.query ?? null,
        windowDays: args.windowDays ?? null,
        topFocusCount: args.topFocusCount ?? null,
        clientFilter: args.clientFilter ?? null,
      },
    },
    () => getFullIntelligence(supabaseAdmin, companyId, args.query, {
      windowDays: args.windowDays,
      topFocusCount: args.topFocusCount,
    }),
  )
}

// ── Phase 3 #4 — draft_mensajeria exec wrapper + re-export ───────

interface DraftMensajeriaArgs {
  traficoId?: string
  pedimentoNumber?: string
  statusEs?: string
  anomalyKind?: string
  anomalySubject?: string
  anomalyDetail?: string
  messageType?:
    | 'preventive_alert'
    | 'document_request'
    | 'status_update'
    | 'anomaly_escalation'
    | 'driver_dispatch'
  productName?: string
  clientFilter?: string
}

/**
 * Build a DraftRequest from the flat Anthropic-tool args shape. Priority
 * ordering (first match wins so the router can pick a lane from natural
 * language without ambiguous fallbacks):
 *
 *   1. anomalyKind present        → anomaly_escalation
 *   2. pedimentoNumber + statusEs → status_update
 *   3. traficoId present          → trafico-based composition
 *   4. nothing above              → error (insufficient context)
 */
function buildDraftRequestFromArgs(
  args: DraftMensajeriaArgs,
):
  | import('./mensajeria/draft-composer').DraftRequest
  | { error: string } {
  if (args.anomalyKind) {
    return {
      kind: 'anomaly',
      anomaly: {
        kind: args.anomalyKind,
        subject: String(args.anomalySubject ?? 'desconocido'),
        detail_es: String(args.anomalyDetail ?? 'Anomalía reportada'),
        score: 0.5,
      },
    }
  }
  if (args.pedimentoNumber && args.statusEs) {
    return {
      kind: 'status',
      pedimento_number: String(args.pedimentoNumber),
      status_es: String(args.statusEs),
      trafico_id: args.traficoId ?? null,
    }
  }
  if (args.traficoId) {
    return {
      kind: 'trafico',
      traficoId: String(args.traficoId),
      messageType: args.messageType,
      productName: args.productName,
    }
  }
  return { error: 'Contexto insuficiente para componer un borrador.' }
}

async function execDraftMensajeria(args: DraftMensajeriaArgs, ctx: AguilaCtx) {
  const companyId = await resolveScopedCompanyId(ctx, args.clientFilter)
  const request = buildDraftRequestFromArgs(args)
  if ('error' in request) {
    return { success: false, data: null, error: request.error }
  }
  // Dynamic import to keep the module-load graph shallow — draft-composer
  // imports tools (for the AgentToolResponse type); this indirection
  // avoids cycle warnings in some bundlers.
  const { draftMensajeria } = await import('./mensajeria/draft-composer')
  return draftMensajeria(supabaseAdmin, companyId, request)
}

// Re-export the standalone composer + its types so callers outside the
// aguila tool dispatcher (scripts, API routes, future briefing cron)
// import from one canonical path.
export {
  draftMensajeria,
  suggestMessageType,
} from './mensajeria/draft-composer'
export type {
  DraftRequest,
  DraftMensajeriaOptions,
  DraftMensajeriaResponse,
  SuggestSignals,
  MessageTypeSuggestion,
  AnomalyInput,
} from './mensajeria/draft-composer'
export type {
  MessageType,
  Audience,
  RenderedMessage,
  TemplateBindings,
} from './mensajeria/templates'

// ── Phase 3 #5 — learning_report exec wrapper + re-export ────────

interface LearningReportArgs {
  windowDays?: number
  clientFilter?: string
}

async function execLearningReport(args: LearningReportArgs, ctx: AguilaCtx) {
  const companyId = await resolveScopedCompanyId(ctx, args.clientFilter)
  // Dynamic import keeps the module-load graph shallow — `loop.ts`
  // imports `AgentToolResponse` from this file; indirection avoids
  // cycle warnings in some bundlers.
  const { generateWeeklyReport } = await import('./learning/loop')
  return generateWeeklyReport(supabaseAdmin, companyId, {
    windowDays: args.windowDays,
  })
}

// Re-export the learning engine so callers outside the aguila tool
// dispatcher (scripts, API routes, future weekly cron) import from
// one canonical path.
export {
  analyzeDecisions,
  generateWeeklyReport,
  computePredictionAccuracy,
  computeToolAcceptance,
  computeDraftApproval,
  computeToneGuardTrend,
  suggestAdjustments,
  composeReport,
} from './learning/loop'
export type {
  LearningMetrics,
  LearningReport,
  Suggestion,
  SuggestionKind,
  SuggestionPriority,
  PredictionBand,
  PredictionBandStat,
  PredictionAccuracyMetric,
  ToolAcceptanceMetric,
  ToolAcceptanceEntry,
  DraftApprovalMetric,
  DraftApprovalEntry,
  ToneGuardMetric,
  AnalyzeDecisionsOptions,
} from './learning/loop'
