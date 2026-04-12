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
  const { data } = await supabase
    .from('globalpc_partidas')
    .select(
      'id, cve_producto, fraccion_arancelaria, fraccion, descripcion, umc, pais_origen, cantidad, valor_comercial, tmec',
    )
    .eq('cve_trafico', traficoId)
    .limit(2000)

  type Row = {
    id?: string | null
    cve_producto?: string | null
    fraccion_arancelaria?: string | null
    fraccion?: string | null
    descripcion?: string | null
    umc?: string | null
    pais_origen?: string | null
    cantidad?: number | null
    valor_comercial?: number | null
    tmec?: boolean | null
  }

  const rows = (data as Row[] | null) ?? []
  return rows.map((p) => ({
    id: p.id ?? undefined,
    cve_producto: p.cve_producto ?? undefined,
    fraccion_arancelaria: p.fraccion_arancelaria ?? undefined,
    fraccion: p.fraccion ?? undefined,
    descripcion: p.descripcion ?? undefined,
    umc: p.umc ?? undefined,
    pais_origen: p.pais_origen ?? undefined,
    cantidad: p.cantidad ?? undefined,
    valor_comercial: p.valor_comercial ?? undefined,
    certificado_origen_tmec: p.tmec ?? undefined,
  }))
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
