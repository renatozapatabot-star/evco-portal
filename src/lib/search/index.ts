import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { sanitizeIlike } from '@/lib/sanitize'
import { OPERATOR_SEARCH_ROLES } from '@/lib/search-registry'
import {
  UniversalSearchHit,
  UniversalSearchResponse,
} from './types'

type Scope = {
  isInternal: boolean
  companyId: string
  clientClave: string
}

const PER_GROUP = 5

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

type TraficoRow = { trafico: string | null; estatus: string | null; descripcion_mercancia: string | null; fecha_llegada: string | null }
type EntradaRow = { cve_entrada: string | null; descripcion_mercancia: string | null; trafico: string | null }
type FacturaRow = { referencia: string | null; pedimento: string | null; proveedor: string | null; num_factura: string | null }
type ProveedorRow = { cve_proveedor: string | null; nombre: string | null; id_fiscal: string | null }
type ProductoRow = { id: number; cve_producto: string | null; descripcion: string | null; fraccion: string | null }
type PartidaRow = { id: number; cve_trafico: string | null; descripcion: string | null; fraccion_arancelaria: string | null; numero_parte: string | null }
type DocumentoRow = { id: string; nombre: string | null; doc_type: string | null; pedimento_id: string | null }
type CompanyRow = { company_id: string | null; name: string | null; clave_cliente: string | null }
type OperatorRow = { id: string | null; name: string | null; email: string | null; role: string | null }

async function searchTraficos(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  let q = sb.from('traficos')
    .select('trafico, estatus, descripcion_mercancia, fecha_llegada')
    .or(`trafico.ilike.%${safe}%,descripcion_mercancia.ilike.%${safe}%,pedimento.ilike.%${safe}%`)
    .limit(PER_GROUP)
  if (!scope.isInternal) q = q.eq('company_id', scope.companyId)
  const { data } = await q
  return ((data ?? []) as TraficoRow[]).map(t => ({
    kind: 'traficos',
    id: t.trafico ?? '',
    title: t.trafico ?? '',
    subtitle: `${t.estatus ?? ''} · ${truncate(t.descripcion_mercancia, 50)}`,
    href: `/traficos/${encodeURIComponent(t.trafico ?? '')}`,
  }))
}

async function searchEntradas(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  let q = sb.from('entradas')
    .select('cve_entrada, descripcion_mercancia, trafico')
    .or(`cve_entrada.ilike.%${safe}%,descripcion_mercancia.ilike.%${safe}%,trafico.ilike.%${safe}%`)
    .limit(PER_GROUP)
  if (!scope.isInternal) q = q.eq('company_id', scope.companyId)
  const { data } = await q
  return ((data ?? []) as EntradaRow[]).map(e => ({
    kind: 'entradas',
    id: e.cve_entrada ?? '',
    title: e.cve_entrada ?? '',
    subtitle: truncate(e.descripcion_mercancia, 60) || (e.trafico ? `Tráfico ${e.trafico}` : ''),
    href: `/entradas/${encodeURIComponent(e.cve_entrada ?? '')}`,
  }))
}

// Pedimentos group: aduanet_facturas WHERE pedimento IS NOT NULL
async function searchPedimentos(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  if (!scope.clientClave && !scope.isInternal) return []
  let q = sb.from('aduanet_facturas')
    .select('referencia, pedimento, proveedor, num_factura')
    .not('pedimento', 'is', null)
    .or(`pedimento.ilike.%${safe}%,referencia.ilike.%${safe}%,proveedor.ilike.%${safe}%`)
    .limit(PER_GROUP)
  if (!scope.isInternal) q = q.eq('clave_cliente', scope.clientClave)
  const { data } = await q
  return ((data ?? []) as FacturaRow[]).map(f => ({
    kind: 'pedimentos',
    id: f.pedimento ?? f.referencia ?? '',
    title: f.pedimento ?? f.referencia ?? '',
    subtitle: `${truncate(f.proveedor, 35)}${f.num_factura ? ` · Factura ${f.num_factura}` : ''}`,
    href: '/pedimentos',
  }))
}

// Facturas group: aduanet_facturas WHERE num_factura IS NOT NULL
async function searchFacturas(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  if (!scope.clientClave && !scope.isInternal) return []
  let q = sb.from('aduanet_facturas')
    .select('referencia, pedimento, proveedor, num_factura')
    .not('num_factura', 'is', null)
    .or(`num_factura.ilike.%${safe}%,proveedor.ilike.%${safe}%,referencia.ilike.%${safe}%`)
    .limit(PER_GROUP)
  if (!scope.isInternal) q = q.eq('clave_cliente', scope.clientClave)
  const { data } = await q
  return ((data ?? []) as FacturaRow[]).map(f => ({
    kind: 'facturas',
    id: f.num_factura ?? f.referencia ?? '',
    title: f.num_factura ?? f.referencia ?? '',
    subtitle: `${truncate(f.proveedor, 35)}${f.pedimento ? ` · Pedimento ${f.pedimento}` : ''}`,
    href: '/pedimentos',
  }))
}

async function searchProveedores(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  if (!scope.isInternal) return []
  const { data } = await sb.from('globalpc_proveedores')
    .select('cve_proveedor, nombre, id_fiscal')
    .or(`nombre.ilike.%${safe}%,cve_proveedor.ilike.%${safe}%,id_fiscal.ilike.%${safe}%`)
    .limit(PER_GROUP)
  return ((data ?? []) as ProveedorRow[]).map(p => ({
    kind: 'proveedores',
    id: p.cve_proveedor ?? '',
    title: p.nombre ?? p.cve_proveedor ?? '',
    subtitle: p.id_fiscal ?? p.cve_proveedor ?? '',
    href: '/proveedores',
  }))
}

async function searchProductos(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  if (!scope.isInternal) return []
  const { data } = await sb.from('globalpc_productos')
    .select('id, cve_producto, descripcion, fraccion')
    .or(`descripcion.ilike.%${safe}%,fraccion.ilike.%${safe}%,cve_producto.ilike.%${safe}%`)
    .limit(PER_GROUP)
  return ((data ?? []) as ProductoRow[]).map(p => ({
    kind: 'productos',
    id: String(p.id),
    title: p.cve_producto ?? `Producto ${p.id}`,
    subtitle: `${truncate(p.descripcion, 45)}${p.fraccion ? ` · ${p.fraccion}` : ''}`,
    href: '/fracciones',
  }))
}

// Partidas: individual line items
async function searchPartidas(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  if (!scope.isInternal) return []
  const { data } = await sb.from('globalpc_partidas')
    .select('id, cve_trafico, descripcion, fraccion_arancelaria, numero_parte')
    .or(`descripcion.ilike.%${safe}%,cve_trafico.ilike.%${safe}%,numero_parte.ilike.%${safe}%`)
    .limit(PER_GROUP)
  return ((data ?? []) as PartidaRow[]).map(p => ({
    kind: 'partidas',
    id: String(p.id),
    title: p.numero_parte ?? p.cve_trafico ?? `Partida ${p.id}`,
    subtitle: `${truncate(p.descripcion, 45)}${p.fraccion_arancelaria ? ` · ${p.fraccion_arancelaria}` : ''}`,
    href: '/fracciones',
  }))
}

// Fracciones: deduped fraccion_arancelaria
async function searchFracciones(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  if (!scope.isInternal) return []
  const { data } = await sb.from('globalpc_partidas')
    .select('id, cve_trafico, descripcion, fraccion_arancelaria, numero_parte')
    .ilike('fraccion_arancelaria', `%${safe}%`)
    .limit(PER_GROUP * 3)
  const seen = new Set<string>()
  const out: UniversalSearchHit[] = []
  for (const p of (data ?? []) as PartidaRow[]) {
    const fr = p.fraccion_arancelaria
    if (!fr || seen.has(fr)) continue
    seen.add(fr)
    out.push({
      kind: 'fracciones',
      id: fr,
      title: fr,
      subtitle: truncate(p.descripcion, 60),
      href: `/fracciones?q=${encodeURIComponent(fr)}`,
    })
    if (out.length >= PER_GROUP) break
  }
  return out
}

async function searchClientes(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  if (!scope.isInternal) return []
  const { data } = await sb.from('companies')
    .select('company_id, name, clave_cliente')
    .or(`name.ilike.%${safe}%,clave_cliente.ilike.%${safe}%,company_id.ilike.%${safe}%`)
    .limit(PER_GROUP)
  return ((data ?? []) as CompanyRow[]).map(c => ({
    kind: 'clientes',
    id: c.company_id ?? c.clave_cliente ?? '',
    title: c.name ?? c.company_id ?? 'Cliente',
    subtitle: [c.clave_cliente, c.company_id].filter(Boolean).join(' · '),
    href: `/clientes/${encodeURIComponent(c.company_id ?? '')}`,
  }))
}

async function searchOperadores(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  if (!scope.isInternal) return []
  const { data, error } = await sb.from('client_users')
    .select('id, name, email, role')
    .in('role', OPERATOR_SEARCH_ROLES as unknown as string[])
    .or(`name.ilike.%${safe}%,email.ilike.%${safe}%`)
    .limit(PER_GROUP)
  // client_users may not exist in every env — graceful empty fallback
  if (error) return []
  return ((data ?? []) as OperatorRow[]).map(o => ({
    kind: 'operadores',
    id: o.id ?? o.email ?? '',
    title: o.name ?? o.email ?? 'Operador',
    subtitle: `${o.role ?? ''}${o.email ? ` · ${o.email}` : ''}`,
    href: '/operadores',
  }))
}

async function searchDocumentos(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  let q = sb.from('expediente_documentos')
    .select('id, nombre, doc_type, pedimento_id')
    .or(`nombre.ilike.%${safe}%,doc_type.ilike.%${safe}%`)
    .limit(PER_GROUP)
  if (!scope.isInternal) q = q.eq('company_id', scope.companyId)
  const { data } = await q
  return ((data ?? []) as DocumentoRow[]).map(d => ({
    kind: 'documentos',
    id: d.id,
    title: d.nombre ?? d.doc_type ?? 'Documento',
    subtitle: `${d.doc_type ?? ''}${d.pedimento_id ? ` · ${d.pedimento_id}` : ''}`,
    href: '/documentos',
  }))
}

export async function runUniversalSearch(q: string, scope: Scope): Promise<UniversalSearchResponse> {
  const started = Date.now()
  const safe = sanitizeIlike(q)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    traficos, pedimentos, entradas, facturas, partidas,
    productos, fracciones, clientes, proveedores, operadores, documentos,
  ] = await Promise.all([
    searchTraficos(sb, safe, scope),
    searchPedimentos(sb, safe, scope),
    searchEntradas(sb, safe, scope),
    searchFacturas(sb, safe, scope),
    searchPartidas(sb, safe, scope),
    searchProductos(sb, safe, scope),
    searchFracciones(sb, safe, scope),
    searchClientes(sb, safe, scope),
    searchProveedores(sb, safe, scope),
    searchOperadores(sb, safe, scope),
    searchDocumentos(sb, safe, scope),
  ])

  return {
    query: q,
    traficos,
    pedimentos,
    entradas,
    facturas,
    partidas,
    productos,
    fracciones,
    clientes,
    proveedores,
    operadores,
    documentos,
    ordenes_carga: [], // stub
    took_ms: Date.now() - started,
  }
}
