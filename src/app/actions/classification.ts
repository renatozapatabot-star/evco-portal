'use server'

/**
 * Block 5 — Server action wrappers around /api/classification/*.
 * Thin adapters so client components can invoke the feature without
 * managing fetch plumbing. All functions respect the caller's session
 * via cookies forwarded implicitly by Next's server context.
 */

import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { generateClassificationSheet } from '@/lib/classification-engine'
import {
  DEFAULT_CONFIG,
  DEFAULT_PRINT_TOGGLES,
  type ClassificationSheetConfig,
  type GeneratedSheet,
  type Producto,
} from '@/types/classification'

async function loadProductos(traficoId: string): Promise<Producto[]> {
  const supabase = createServerClient()

  // Real schema: globalpc_partidas has NO cve_trafico, fraccion,
  // fraccion_arancelaria, descripcion, umc, valor_comercial, or tmec columns
  // (M16 phantom-column sweep). The 2-hop canonical join:
  //   cve_trafico → facturas.cve_trafico → facturas.folio → partidas.folio
  //   partidas.cve_producto → productos.fraccion + descripcion + umt
  //   tmec eligibility → traficos.predicted_tmec (derived)
  const { data: facturas } = await supabase
    .from('globalpc_facturas')
    .select('folio')
    .eq('cve_trafico', traficoId)
  const folios = (facturas ?? []).map((f: { folio: number | null }) => f.folio).filter((x): x is number => x != null)
  if (folios.length === 0) return []

  type PartidaRaw = {
    id: number | null
    folio: number | null
    cve_producto: string | null
    cve_cliente: string | null
    cantidad: number | null
    precio_unitario: number | null
    pais_origen: string | null
  }
  const { data: partidaRaw } = await supabase
    .from('globalpc_partidas')
    .select('id, folio, cve_producto, cve_cliente, cantidad, precio_unitario, pais_origen')
    .in('folio', folios)
    .limit(2000)
  const partidas = (partidaRaw ?? []) as PartidaRaw[]

  // Enrich via productos (fraccion + descripcion + umt).
  const cves = Array.from(new Set(partidas.map(p => p.cve_producto).filter((c): c is string => !!c)))
  const productMap = new Map<string, { descripcion: string | null; fraccion: string | null; umt: string | null }>()
  if (cves.length > 0) {
    const { data: prods } = await supabase
      .from('globalpc_productos')
      .select('cve_producto, cve_cliente, descripcion, fraccion, umt')
      .in('cve_producto', cves)
      .limit(2000)
    for (const p of (prods ?? []) as Array<{
      cve_producto: string | null
      cve_cliente: string | null
      descripcion: string | null
      fraccion: string | null
      umt: string | null
    }>) {
      productMap.set(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`, {
        descripcion: p.descripcion,
        fraccion: p.fraccion,
        umt: p.umt,
      })
    }
  }

  return partidas.map((p) => {
    const enr = productMap.get(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`)
    const cantidad = Number(p.cantidad) || 0
    const precio = Number(p.precio_unitario) || 0
    return {
      id: p.id != null ? String(p.id) : undefined,
      cve_producto: p.cve_producto ?? undefined,
      fraccion_arancelaria: enr?.fraccion ?? undefined,
      fraccion: enr?.fraccion ?? undefined,
      descripcion: enr?.descripcion ?? undefined,
      umc: enr?.umt ?? undefined,
      pais_origen: p.pais_origen ?? undefined,
      cantidad: cantidad || undefined,
      valor_comercial: cantidad * precio || undefined,
      certificado_origen_tmec: undefined, // tmec eligibility lives on traficos.predicted_tmec
    }
  })
}

export async function previewSheet(
  traficoId: string,
  config: ClassificationSheetConfig,
): Promise<GeneratedSheet> {
  const productos = await loadProductos(traficoId)
  return generateClassificationSheet(productos, config)
}

export async function loadConfig(): Promise<ClassificationSheetConfig> {
  const session = await verifySession(
    (await cookies()).get('portal_session')?.value ?? '',
  )
  if (!session) return DEFAULT_CONFIG

  const supabase = createServerClient()
  const { data } = await supabase
    .from('classification_sheet_configs')
    .select(
      'grouping_mode, ordering_mode, specific_description, restriction_print_mode, print_toggles, email_recipients',
    )
    .eq('cliente_id', session.companyId)
    .eq('company_id', session.companyId)
    .maybeSingle()

  if (!data) return DEFAULT_CONFIG
  const d = data as Partial<ClassificationSheetConfig>
  return {
    grouping_mode: d.grouping_mode ?? DEFAULT_CONFIG.grouping_mode,
    ordering_mode: d.ordering_mode ?? DEFAULT_CONFIG.ordering_mode,
    specific_description: d.specific_description ?? DEFAULT_CONFIG.specific_description,
    restriction_print_mode: d.restriction_print_mode ?? DEFAULT_CONFIG.restriction_print_mode,
    print_toggles: { ...DEFAULT_PRINT_TOGGLES, ...(d.print_toggles ?? {}) },
    email_recipients: Array.isArray(d.email_recipients) ? d.email_recipients : [],
  }
}

export async function saveConfig(config: ClassificationSheetConfig): Promise<{ ok: boolean; error?: string }> {
  const session = await verifySession(
    (await cookies()).get('portal_session')?.value ?? '',
  )
  if (!session) return { ok: false, error: 'No autorizado' }

  const supabase = createServerClient()
  const { error } = await supabase.from('classification_sheet_configs').upsert(
    {
      cliente_id: session.companyId,
      company_id: session.companyId,
      grouping_mode: config.grouping_mode,
      ordering_mode: config.ordering_mode,
      specific_description: config.specific_description,
      restriction_print_mode: config.restriction_print_mode,
      print_toggles: config.print_toggles,
      email_recipients: config.email_recipients,
      is_default: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cliente_id,company_id' },
  )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
