/**
 * Pure milestone-computation logic for the trafico timeline. Shared by
 * both the horizontal and vertical renderers — this file must stay
 * render-agnostic so the layout choice never rewrites behavior.
 *
 * Contract: takes a TimelineInput (server-hydrated), returns exactly 7
 * milestones with deterministic status assignment. Change the output
 * shape only with a contract-level commit + the test suite updated.
 */

import type { ReactNode } from 'react'

/**
 * Shared status palette — reused across the horizontal + vertical
 * renderers. Each hex is semantic status signaling (green=healthy,
 * gold=active, red=blocked) and matches the design-system
 * --green / --amber / --red tokens. Keeping the literal here means
 * it's defined ONCE across the whole timeline surface.
 */
export const STATUS_GREEN = '#86EFAC' // design-token
export const STATUS_GOLD = '#F4D47A'  // design-token
export const STATUS_RED = '#FCA5A5'   // design-token
export const PRIMARY_TEXT = '#E6EDF3' // design-token
export const CANVAS_BLACK = '#0A0A0C' // design-token

export type MilestoneStatus = 'completed' | 'active' | 'pending' | 'blocked'

export type MilestoneIcon =
  | 'create'
  | 'route'
  | 'warehouse'
  | 'docs'
  | 'payment'
  | 'cross'
  | 'invoice'

export interface Milestone {
  key: string
  label: string
  /** Abbreviated label for narrow viewports (< 380px). */
  labelShort?: string
  icon: MilestoneIcon
  status: MilestoneStatus
  timestamp_iso: string | null
  sub?: string
  href?: string
  accessory?: ReactNode
}

export interface TimelineInput {
  trafico_id: string
  created_at: string | null
  fecha_llegada: string | null
  fecha_cruce: string | null
  pedimento_number: string | null
  estatus: string | null
  semaforo: number | null
  entradas: Array<{ fecha_ingreso: string | null; fecha_llegada_mercancia: string | null }>
  docs_count: number
  required_docs_count: number
  uploaded_required_count: number
  facturas: Array<{ fecha_pago: string | null }>
}

export function pickEarliest(values: Array<string | null>): string | null {
  const valid = values.filter((v): v is string => !!v)
  if (valid.length === 0) return null
  return valid.sort()[0] ?? null
}

export function computeMilestones(input: TimelineInput): Milestone[] {
  const earliestEntradaIngreso = pickEarliest(input.entradas.map((e) => e.fecha_ingreso))
  const earliestRecepcion = pickEarliest(input.entradas.map((e) => e.fecha_llegada_mercancia))
  const earliestFacturaPago = pickEarliest(input.facturas.map((f) => f.fecha_pago))
  const docsActive = input.uploaded_required_count > 0 || input.docs_count > 0
  const docsComplete = input.required_docs_count > 0 && input.uploaded_required_count >= input.required_docs_count
  const pedimentoPaid = !!input.pedimento_number && !!earliestFacturaPago
  const crossed = !!input.fecha_cruce
  const blocked = input.semaforo === 2
  const estatusLower = (input.estatus ?? '').toLowerCase()
  const enProceso = /proceso|ruta|transito/.test(estatusLower) && !crossed

  const raw: Array<{
    key: string; label: string; labelShort: string; icon: MilestoneIcon;
    ts: string | null; sub?: string; href?: string
  }> = [
    {
      key: 'created',
      label: 'Creación del embarque',
      labelShort: 'Creado',
      icon: 'create',
      ts: input.created_at,
      sub: input.trafico_id ? `Embarque ${input.trafico_id}` : undefined,
    },
    {
      key: 'route',
      label: 'En ruta hacia frontera',
      labelShort: 'En ruta',
      icon: 'route',
      ts: earliestEntradaIngreso ?? (earliestRecepcion ? null : (enProceso ? input.created_at : null)),
      sub: earliestEntradaIngreso ? 'Transportista en movimiento' : 'Pendiente de registrar ingreso',
    },
    {
      key: 'warehouse',
      label: 'Mercancía recibida',
      labelShort: 'Recibido',
      icon: 'warehouse',
      ts: earliestRecepcion,
      sub: earliestRecepcion ? `Registrada en bodega` : 'Pendiente de recepción en almacén',
      href: `/entradas?trafico=${encodeURIComponent(input.trafico_id)}`,
    },
    {
      key: 'docs',
      label: 'Documentación',
      labelShort: 'Docs',
      icon: 'docs',
      ts: docsComplete ? (earliestRecepcion ?? input.created_at) : null,
      sub: input.required_docs_count === 0
        ? 'Documentos opcionales'
        : docsComplete
          ? `${input.uploaded_required_count} de ${input.required_docs_count} documentos requeridos`
          : docsActive
            ? `${input.uploaded_required_count} de ${input.required_docs_count} subidos · faltan ${input.required_docs_count - input.uploaded_required_count}`
            : `${input.required_docs_count} documentos requeridos · subida pendiente`,
      href: `/expedientes?trafico=${encodeURIComponent(input.trafico_id)}`,
    },
    {
      key: 'pedimento',
      label: 'Pedimento pagado',
      labelShort: 'Pedim.',
      icon: 'payment',
      ts: pedimentoPaid ? earliestFacturaPago : null,
      sub: input.pedimento_number
        ? pedimentoPaid
          ? `Pedimento ${input.pedimento_number}`
          : `Pedimento ${input.pedimento_number} · pago pendiente`
        : 'Pedimento pendiente de asignar',
      href: `/api/pedimento-pdf?trafico=${encodeURIComponent(input.trafico_id)}`,
    },
    {
      key: 'cross',
      label: 'Cruce de frontera',
      labelShort: 'Cruce',
      icon: 'cross',
      ts: input.fecha_cruce,
      sub: crossed
        ? (input.semaforo === 0 ? 'Semáforo verde · liberado' : input.semaforo === 1 ? 'Semáforo amarillo · revisión' : input.semaforo === 2 ? 'Semáforo rojo · retenido' : 'Cruzado')
        : 'Pendiente de cruzar',
    },
    {
      key: 'invoice',
      label: 'Factura emitida',
      labelShort: 'Factura',
      icon: 'invoice',
      ts: null,
      sub: 'Se genera al cerrar la operación',
    },
  ]

  let activeAssigned = false
  const milestones: Milestone[] = raw.map((m) => {
    let status: MilestoneStatus
    if (m.ts) {
      status = 'completed'
    } else if (!activeAssigned) {
      status = blocked && m.key === 'cross' ? 'blocked' : 'active'
      activeAssigned = true
    } else {
      status = 'pending'
    }
    return {
      key: m.key,
      label: m.label,
      labelShort: m.labelShort,
      icon: m.icon,
      status,
      timestamp_iso: m.ts,
      sub: m.sub,
      href: status === 'completed' || status === 'active' ? m.href : undefined,
    }
  })

  return milestones
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const days = Math.floor(diffMs / 86_400_000)
  if (days < 0) {
    const ahead = Math.abs(days)
    if (ahead < 1) return 'próximamente'
    if (ahead === 1) return 'en 1 día'
    return `en ${ahead} días`
  }
  if (days < 1) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  const months = Math.floor(days / 30)
  if (months === 1) return 'hace 1 mes'
  return `hace ${months} meses`
}

export function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

/** Compact date for the horizontal rail — "14 abr" (no year). */
export function formatCompactDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return ''
  }
}
