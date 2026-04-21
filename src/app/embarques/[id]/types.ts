/**
 * Block 1B · Embarque detail — local types.
 *
 * The page is a thin data → props adapter. These row shapes are owned
 * by `page.tsx` and passed into the `TraficoDetail` shell. They mirror
 * the columns actually read by the page query; do not re-export from
 * here for consumers that don't share the exact query shape.
 */

import type { Category } from '@/lib/events-catalog'

export type FireResult = { ok: true; error: null } | { ok: false; error: string }

export interface TraficoRow {
  trafico: string
  estatus: string | null
  pedimento: string | null
  fecha_llegada: string | null
  importe_total: number | null
  regimen: string | null
  company_id: string | null
  proveedores: string | null
  descripcion_mercancia: string | null
  patente: string | null
  aduana: string | null
  tipo_operacion: string | null
  tipo_cambio: number | null
  peso_bruto: number | null
  fecha_cruce: string | null
  semaforo: string | null
  doda_status: string | null
  u_level: string | null
  peso_volumetrico: number | null
  prevalidador: string | null
  banco_operacion_numero: string | null
  sat_transaccion_numero: string | null
  assigned_to_operator_id: string | null
  updated_at: string | null
  created_at: string | null
}

export interface DocRow {
  id: string
  document_type: string | null
  document_type_confidence: number | null
  doc_type: string | null
  file_name: string | null
  created_at: string | null
}

export interface PartidaRow {
  id: number | null
  numero_parte: string | null
  descripcion: string | null
  fraccion_arancelaria: string | null
  fraccion: string | null
  cantidad: number | null
  cantidad_bultos: number | null
  peso_bruto: number | null
  valor_comercial: number | null
  umc: string | null
  pais_origen: string | null
  regimen: string | null
  tmec: boolean | null
}

export interface NoteRow {
  id: string
  author_id: string
  content: string
  mentions: string[]
  created_at: string
}

export interface EventRow {
  id: string
  trigger_id: string
  event_type: string
  workflow: string | null
  payload: Record<string, unknown> | null
  created_at: string
  // Joined from events_catalog — may be null when event_type is not seeded.
  category: Category | null
  visibility: 'public' | 'private' | null
  display_name_es: string | null
  description_es: string | null
  icon_name: string | null
  color_token: string | null
}

export interface AvailableUserLite {
  id: string
  label: string
}

export interface CompanyLite {
  id: string
  name: string
  rfc: string | null
}
