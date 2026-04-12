import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { sanitizeIlike } from '@/lib/sanitize'
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
type PartidaRow = { id: number; cve_trafico: string | null; descripcion: string | null; fraccion_arancelaria: string | null }
type DocumentoRow = { id: string; nombre: string | null; doc_type: string | null; pedimento_id: string | null }

async function searchTraficos(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  let q = sb.from('traficos')
    .select('trafico, estatus, descripcion_mercancia, fecha_llegada')
    .or(`trafico.ilike.%${safe}%,descripcion_mercancia.ilike.%${safe}%,pedimento.ilike.%${safe}%`)
    .limit(PER_GROUP)
  if (!scope.isInternal) q = q.eq('company_id', scope.companyId)
  const { data } = await q
  return ((data ?? []) as TraficoRow[]).map(t => ({
    kind: 'trafico',
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
    kind: 'entrada',
    id: e.cve_entrada ?? '',
    title: e.cve_entrada ?? '',
    subtitle: truncate(e.descripcion_mercancia, 60) || (e.trafico ? `Tráfico ${e.trafico}` : ''),
    href: `/entradas/${encodeURIComponent(e.cve_entrada ?? '')}`,
  }))
}

async function searchPedimentos(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  if (!scope.clientClave && !scope.isInternal) return []
  let q = sb.from('aduanet_facturas')
    .select('referencia, pedimento, proveedor, num_factura')
    .or(`pedimento.ilike.%${safe}%,proveedor.ilike.%${safe}%,referencia.ilike.%${safe}%,num_factura.ilike.%${safe}%`)
    .limit(PER_GROUP)
  if (!scope.isInternal) q = q.eq('clave_cliente', scope.clientClave)
  const { data } = await q
  return ((data ?? []) as FacturaRow[]).map(f => ({
    kind: 'pedimento',
    id: f.referencia ?? f.pedimento ?? '',
    title: f.pedimento ?? f.referencia ?? '',
    subtitle: `${truncate(f.proveedor, 35)}${f.num_factura ? ` · Factura ${f.num_factura}` : ''}`,
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
    kind: 'proveedor',
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
    kind: 'producto',
    id: String(p.id),
    title: p.cve_producto ?? `Producto ${p.id}`,
    subtitle: `${truncate(p.descripcion, 45)}${p.fraccion ? ` · ${p.fraccion}` : ''}`,
    href: '/fracciones',
  }))
}

async function searchFracciones(sb: SupabaseClient, safe: string, scope: Scope): Promise<UniversalSearchHit[]> {
  if (!scope.isInternal) return []
  const { data } = await sb.from('globalpc_partidas')
    .select('id, cve_trafico, descripcion, fraccion_arancelaria')
    .or(`fraccion_arancelaria.ilike.%${safe}%,descripcion.ilike.%${safe}%`)
    .limit(PER_GROUP)
  return ((data ?? []) as PartidaRow[]).map(p => ({
    kind: 'fraccion',
    id: String(p.id),
    title: p.fraccion_arancelaria ?? `Partida ${p.id}`,
    subtitle: `${truncate(p.descripcion, 45)}${p.cve_trafico ? ` · Tráfico ${p.cve_trafico}` : ''}`,
    href: '/fracciones',
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
    kind: 'documento',
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

  const [traficos, entradas, pedimentos, proveedores, productos, fracciones, documentos] = await Promise.all([
    searchTraficos(sb, safe, scope),
    searchEntradas(sb, safe, scope),
    searchPedimentos(sb, safe, scope),
    searchProveedores(sb, safe, scope),
    searchProductos(sb, safe, scope),
    searchFracciones(sb, safe, scope),
    searchDocumentos(sb, safe, scope),
  ])

  return {
    query: q,
    traficos,
    entradas,
    pedimentos,
    proveedores,
    productos,
    fracciones,
    documentos,
    took_ms: Date.now() - started,
  }
}
