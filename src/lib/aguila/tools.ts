import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import type { PortalRole } from '@/lib/session'
import { AguilaForbiddenError, canSeeAllClients, canSeeFinance } from './roles'
import { resolveMentions, type MentionResult } from './mentions'
import { getActiveCveProductos, activeCvesArray } from '@/lib/anexo24/active-parts'

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
