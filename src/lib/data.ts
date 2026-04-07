// src/lib/data.ts
import { createClient } from '@supabase/supabase-js'
import { getCompanyId, getClientClave } from './client-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PAGE_SIZE = 50

/** Hide tráficos with fecha_llegada before this date from the portal */
export const PORTAL_DATE_FROM = '2024-01-01'

export type Trafico = {
  id: number
  trafico: string
  descripcion_mercancia: string | null
  proveedores: string | null
  fecha_llegada: string | null
  facturas: string | null
  importe_total: number | null
  peso_bruto: number | null
  transportista_extranjero: string | null
  transportista_mexicano: string | null
  estatus: string | null
  embarque: number | null
  oficina: string | null
  company_id: string | null
  client_id: string | null
  pedimento: string | null
  tenant_id: string | null
  created_at: string
  updated_at: string
}

export type Entrada = {
  id: number
  cve_entrada: string
  cve_embarque: number | null
  cve_cliente: string | null
  cve_proveedor: string | null
  descripcion_mercancia: string | null
  fecha_llegada_mercancia: string | null
  fecha_ingreso: string | null
  num_pedido: string | null
  cantidad_bultos: number | null
  peso_bruto: number | null
  peso_neto: number | null
  tipo_operacion: string | null
  tipo_carga: string | null
  transportista_americano: string | null
  transportista_mexicano: string | null
  recibido_por: string | null
  tiene_faltantes: boolean | null
  mercancia_danada: boolean | null
  recibio_facturas: boolean | null
  recibio_packing_list: boolean | null
  prioridad: string | null
  trafico: string | null
  flete_pagado: number | null
  company_id: string | null
  tenant_id: string | null
}

export type Factura = {
  id: number
  referencia: string | null
  pedimento: string | null
  patente: string | null
  aduana: string | null
  clave_cliente: string | null
  nombre_cliente: string | null
  rfc: string | null
  fecha_pago: string | null
  operacion: string | null
  peso: number | null
  tipo_cambio: number | null
  valor_total: number | null
  valor_usd: number | null
  dta: number | null
  igi: number | null
  iva: number | null
  ieps: number | null
  num_factura: string | null
  cove: string | null
  fecha_factura: string | null
  incoterm: string | null
  moneda: string | null
  proveedor: string | null
  tenant_id: string | null
  created_at: string
}

export async function fetchDashboardKPIs() {
  const companyId = await getCompanyId()
  const clave = await getClientClave()
  const [trafRes, factRes, entRes] = await Promise.all([
    supabase.from('traficos').select('estatus, peso_bruto').eq('company_id', companyId).gte('fecha_llegada', PORTAL_DATE_FROM),
    supabase.from('aduanet_facturas').select('valor_usd, dta, igi, iva, pedimento').eq('clave_cliente', clave),
    supabase.from('entradas').select('tiene_faltantes, peso_bruto').eq('company_id', companyId).gte('fecha_llegada_mercancia', PORTAL_DATE_FROM).limit(1000),
  ])
  const traf = trafRes.data || []
  const fact = factRes.data || []
  const ent = entRes.data || []
  type TrafRow = { estatus: string | null; peso_bruto: number | null }
  type FactRow = { valor_usd: number | null; dta: number | null; igi: number | null; iva: number | null; pedimento: string | null }
  type EntRow = { tiene_faltantes: boolean | null; peso_bruto: number | null }

  return {
    total_traficos: traf.length,
    en_proceso: traf.filter((t: TrafRow) => t.estatus === 'En Proceso').length,
    cruzados: traf.filter((t: TrafRow) => t.estatus === 'Cruzado').length,
    pedimento_pagado: traf.filter((t: TrafRow) => t.estatus === 'Pedimento Pagado').length,
    total_entradas: ent.length,
    total_peso_kg: traf.reduce((s: number, t: TrafRow) => s + (t.peso_bruto || 0), 0),
    tiene_faltantes: ent.filter((e: EntRow) => e.tiene_faltantes).length,
    total_valor_usd: fact.reduce((s: number, f: FactRow) => s + (f.valor_usd || 0), 0),
    total_igi: fact.reduce((s: number, f: FactRow) => s + (f.igi || 0), 0),
    total_iva: fact.reduce((s: number, f: FactRow) => s + (f.iva || 0), 0),
    total_dta: fact.reduce((s: number, f: FactRow) => s + (f.dta || 0), 0),
    pedimentos_count: new Set(fact.map((f: FactRow) => f.pedimento).filter(Boolean)).size,
    tmec_count: fact.filter((f: FactRow) => (f.igi || 0) === 0).length,
  }
}

export async function fetchTraficos(page = 0, estatus?: string, search?: string) {
  const companyId = await getCompanyId()
  let q = supabase.from('traficos').select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .order('fecha_llegada', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  if (estatus && estatus !== 'Todos') q = q.eq('estatus', estatus)
  if (search) q = q.or(`trafico.ilike.%${search}%,pedimento.ilike.%${search}%,descripcion_mercancia.ilike.%${search}%`)
  const { data, count, error } = await q
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

export async function fetchEntradas(page = 0, search?: string) {
  const companyId = await getCompanyId()
  let q = supabase.from('entradas').select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .gte('fecha_llegada_mercancia', PORTAL_DATE_FROM)
    .order('fecha_llegada_mercancia', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  if (search) q = q.or(`descripcion_mercancia.ilike.%${search}%,cve_entrada.ilike.%${search}%,trafico.ilike.%${search}%`)
  const { data, count, error } = await q
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

export async function fetchFacturas(page = 0, search?: string) {
  const clave = await getClientClave()
  let q = supabase.from('aduanet_facturas').select('*', { count: 'exact' })
    .eq('clave_cliente', clave)
    .order('fecha_pago', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  if (search) q = q.or(`pedimento.ilike.%${search}%,proveedor.ilike.%${search}%,referencia.ilike.%${search}%,num_factura.ilike.%${search}%`)
  const { data, count, error } = await q
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

export async function fetchTopProveedores(limit = 6) {
  const clave = await getClientClave()
  const { data } = await supabase.from('aduanet_facturas')
    .select('referencia, proveedor, valor_usd').eq('clave_cliente', clave).not('proveedor', 'is', null)
  const rows = data || []
  type ProvRow = { referencia: string | null; proveedor: string | null; valor_usd: number | null }
  // Dedup by referencia — duplicates inflate totals ~15x
  const seen = new Set<string>()
  const deduped = rows.filter((r: ProvRow) => {
    if (!r.referencia || seen.has(r.referencia)) return false
    seen.add(r.referencia)
    return true
  })
  const byProv: Record<string, number> = {}
  deduped.forEach((r: ProvRow) => { if (r.proveedor) byProv[r.proveedor] = (byProv[r.proveedor] || 0) + (r.valor_usd || 0) })
  return Object.entries(byProv)
    .map(([name, valor]) => ({ name, valor: Math.round(valor as number) }))
    .sort((a, b) => b.valor - a.valor).slice(0, limit)
}

export async function fetchFinancialTotals() {
  const clave = await getClientClave()
  const { data } = await supabase.from('aduanet_facturas')
    .select('referencia, valor_usd, dta, igi, iva').eq('clave_cliente', clave)
  const all = data || []
  type FinRow = { referencia: string | null; valor_usd: number | null; dta: number | null; igi: number | null; iva: number | null }
  // Dedup by referencia — duplicates inflate totals ~15x
  const seen = new Set<string>()
  const r = all.filter((f: FinRow) => {
    if (!f.referencia || seen.has(f.referencia)) return false
    seen.add(f.referencia)
    return true
  })
  return {
    valor: r.reduce((s: number, f: FinRow) => s + (f.valor_usd || 0), 0),
    dta:   r.reduce((s: number, f: FinRow) => s + (f.dta || 0), 0),
    igi:   r.reduce((s: number, f: FinRow) => s + (f.igi || 0), 0),
    iva:   r.reduce((s: number, f: FinRow) => s + (f.iva || 0), 0),
  }
}
