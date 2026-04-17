'use client'

import Link from 'next/link'
import {
  FileText, Truck, Package, CreditCard, Flag, FileCheck, ClipboardList, Circle,
  CheckCircle2, Clock, AlertTriangle,
} from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Trafico timeline — the cinematic vertical status rail for an embarque
 * detail. Designed for the current state where documentary uploads are
 * sparse: the timeline IS the detail, not a sub-section.
 *
 * Each milestone is one of four statuses:
 *   · completed — real fecha, silver/green dot, solid rail above
 *   · active    — current stage, gold pulsing dot, gold rail below
 *   · pending   — future, muted dot, dashed rail
 *   · blocked   — red dot (e.g. semaforo rojo)
 *
 * Milestones are computed from the data the page already fetched:
 *   · Creación — trafico.created_at
 *   · En ruta — when entradas.fecha_ingreso exists
 *   · Recibido en bodega — entradas.fecha_llegada_mercancia
 *   · Documentación — when expediente docs count > 0
 *   · Pedimento pagado — trafico.pedimento + fecha_pago (from factura)
 *   · Cruzado — trafico.fecha_cruce
 *   · Factura emitida — deferred to future (no column today)
 *
 * Cross-linking: each milestone links to the specific entity that
 * realized it (entrada detail, pedimento PDF, embarque list filtered
 * by that trafico, etc).
 */

export type MilestoneStatus = 'completed' | 'active' | 'pending' | 'blocked'

export interface Milestone {
  key: string
  label: string
  icon: 'create' | 'route' | 'warehouse' | 'docs' | 'payment' | 'cross' | 'invoice'
  status: MilestoneStatus
  /** Absolute ISO timestamp for completed/active; may be null for pending. */
  timestamp_iso: string | null
  /** Secondary line — date, entity id, actor. */
  sub?: string
  /** Optional link to the realizing entity (pedimento PDF, entrada, etc). */
  href?: string
  /** Optional small chip rendered inline. */
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

export function computeMilestones(input: TimelineInput): Milestone[] {
  const earliestEntradaIngreso = pickEarliest(input.entradas.map((e) => e.fecha_ingreso))
  const earliestRecepcion = pickEarliest(input.entradas.map((e) => e.fecha_llegada_mercancia))
  const earliestFacturaPago = pickEarliest(input.facturas.map((f) => f.fecha_pago))
  const docsActive = input.uploaded_required_count > 0 || input.docs_count > 0
  const docsComplete = input.required_docs_count > 0 && input.uploaded_required_count >= input.required_docs_count
  const pedimentoPaid = !!input.pedimento_number && !!earliestFacturaPago
  const crossed = !!input.fecha_cruce
  const blocked = input.semaforo === 2 // rojo
  const estatusLower = (input.estatus ?? '').toLowerCase()
  const enProceso = /proceso|ruta|transito/.test(estatusLower) && !crossed

  // Find the "active" stage — the first non-completed one. Any earlier
  // milestone with data is completed; the first without data is active.
  const raw: Array<{ key: string; label: string; icon: Milestone['icon']; ts: string | null; sub?: string; href?: string }> = [
    {
      key: 'created',
      label: 'Creación del embarque',
      icon: 'create',
      ts: input.created_at,
      sub: input.trafico_id ? `Embarque ${input.trafico_id}` : undefined,
    },
    {
      key: 'route',
      label: 'En ruta hacia frontera',
      icon: 'route',
      ts: earliestEntradaIngreso ?? (earliestRecepcion ? null : (enProceso ? input.created_at : null)),
      sub: earliestEntradaIngreso ? 'Transportista en movimiento' : 'Pendiente de registrar ingreso',
    },
    {
      key: 'warehouse',
      label: 'Mercancía recibida',
      icon: 'warehouse',
      ts: earliestRecepcion,
      sub: earliestRecepcion ? `Registrada en bodega` : 'Pendiente de recepción en almacén',
      href: `/entradas?trafico=${encodeURIComponent(input.trafico_id)}`,
    },
    {
      key: 'docs',
      label: 'Documentación',
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
      icon: 'cross',
      ts: input.fecha_cruce,
      sub: crossed
        ? (input.semaforo === 0 ? 'Semáforo verde · liberado' : input.semaforo === 1 ? 'Semáforo amarillo · revisión' : input.semaforo === 2 ? 'Semáforo rojo · retenido' : 'Cruzado')
        : 'Pendiente de cruzar',
    },
    {
      key: 'invoice',
      label: 'Factura emitida',
      icon: 'invoice',
      ts: null,
      sub: 'Se genera al cerrar la operación',
    },
  ]

  // Resolve statuses: first without ts becomes active, earlier completed,
  // later pending. Blocked overrides active when semáforo rojo.
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
      icon: m.icon,
      status,
      timestamp_iso: m.ts,
      sub: m.sub,
      href: status === 'completed' || status === 'active' ? m.href : undefined,
    }
  })

  return milestones
}

function pickEarliest(values: Array<string | null>): string | null {
  const valid = values.filter((v): v is string => !!v)
  if (valid.length === 0) return null
  return valid.sort()[0] ?? null
}

function formatRelative(iso: string): string {
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

function formatAbsolute(iso: string): string {
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

function IconFor({ icon }: { icon: Milestone['icon'] }) {
  const common = { size: 18, strokeWidth: 1.8 } as const
  switch (icon) {
    case 'create':    return <FileText {...common} />
    case 'route':     return <Truck {...common} />
    case 'warehouse': return <Package {...common} />
    case 'docs':      return <ClipboardList {...common} />
    case 'payment':   return <CreditCard {...common} />
    case 'cross':     return <Flag {...common} />
    case 'invoice':   return <FileCheck {...common} />
    default:          return <Circle {...common} />
  }
}

function StatusIcon({ status }: { status: MilestoneStatus }) {
  if (status === 'completed') return <CheckCircle2 size={14} strokeWidth={2} color="#86EFAC" />
  if (status === 'active') return <Clock size={14} strokeWidth={2} color="#F4D47A" className="aguila-pulse" />
  if (status === 'blocked') return <AlertTriangle size={14} strokeWidth={2} color="#FCA5A5" />
  return <Circle size={14} strokeWidth={1.8} color="rgba(148,163,184,0.5)" />
}

export function TraficoTimeline({ input }: { input: TimelineInput }) {
  const milestones = computeMilestones(input)

  return (
    <section
      aria-label="Línea de tiempo del embarque"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        padding: '20px 0',
      }}
    >
      {milestones.map((m, i) => {
        const isLast = i === milestones.length - 1
        const isFirst = i === 0
        const prev = milestones[i - 1]
        // Rail color between this node and the previous one reflects
        // whether progress has reached this point. Completed→completed
        // = silver solid. Completed→active = gold solid. Everything
        // after active = dashed silver-muted.
        const railAbove =
          isFirst
            ? 'transparent'
            : prev?.status === 'completed' && (m.status === 'completed' || m.status === 'active' || m.status === 'blocked')
              ? 'linear-gradient(180deg, rgba(192,197,206,0.35) 0%, rgba(192,197,206,0.35) 100%)'
              : 'rgba(192,197,206,0.12)'
        const railBelow =
          isLast
            ? 'transparent'
            : m.status === 'completed'
              ? 'linear-gradient(180deg, rgba(192,197,206,0.35) 0%, rgba(192,197,206,0.35) 100%)'
              : m.status === 'active'
                ? 'linear-gradient(180deg, rgba(201,167,74,0.55) 0%, rgba(192,197,206,0.12) 100%)'
                : 'rgba(192,197,206,0.12)'

        return (
          <div key={m.key} style={{ position: 'relative', display: 'flex', gap: 18, alignItems: 'stretch', minHeight: 92 }}>
            {/* Rail column */}
            <div style={{ width: 42, flexShrink: 0, position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: 0, bottom: '50%', width: 2, background: railAbove }} aria-hidden />
              <div style={{ position: 'absolute', top: '50%', bottom: 0, width: 2, background: railBelow }} aria-hidden />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 42, height: 42,
                  borderRadius: 999,
                  background: m.status === 'completed'
                    ? 'rgba(34,197,94,0.12)'
                    : m.status === 'active'
                      ? 'rgba(201,167,74,0.16)'
                      : m.status === 'blocked'
                        ? 'rgba(239,68,68,0.14)'
                        : 'rgba(192,197,206,0.06)',
                  border: `1px solid ${
                    m.status === 'completed'
                      ? 'rgba(34,197,94,0.32)'
                      : m.status === 'active'
                        ? 'rgba(201,167,74,0.5)'
                        : m.status === 'blocked'
                          ? 'rgba(239,68,68,0.38)'
                          : 'rgba(192,197,206,0.16)'
                  }`,
                  color: m.status === 'completed'
                    ? '#86EFAC'
                    : m.status === 'active'
                      ? '#F4D47A'
                      : m.status === 'blocked'
                        ? '#FCA5A5'
                        : 'rgba(192,197,206,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: m.status === 'active'
                    ? '0 0 24px rgba(201,167,74,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
                    : m.status === 'completed'
                      ? '0 0 14px rgba(34,197,94,0.16), inset 0 1px 0 rgba(255,255,255,0.06)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  zIndex: 1,
                }}
                aria-hidden
              >
                <IconFor icon={m.icon} />
              </div>
            </div>

            {/* Card column */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                padding: '12px 0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <TimelineCard milestone={m} />
            </div>
          </div>
        )
      })}
    </section>
  )
}

function TimelineCard({ milestone }: { milestone: Milestone }) {
  const body = (
    <div
      style={{
        padding: '14px 18px',
        borderRadius: 14,
        background: milestone.status === 'active'
          ? 'rgba(201,167,74,0.06)'
          : milestone.status === 'blocked'
            ? 'rgba(239,68,68,0.06)'
            : 'rgba(0,0,0,0.28)',
        border: `1px solid ${
          milestone.status === 'active'
            ? 'rgba(201,167,74,0.3)'
            : milestone.status === 'blocked'
              ? 'rgba(239,68,68,0.3)'
              : milestone.status === 'completed'
                ? 'rgba(34,197,94,0.18)'
                : 'rgba(192,197,206,0.1)'
        }`,
        transition: 'border-color var(--dur-fast, 150ms) ease, background var(--dur-fast, 150ms) ease, transform var(--dur-fast, 150ms) ease',
        boxShadow: milestone.status === 'active'
          ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 20px rgba(0,0,0,0.4)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 'var(--aguila-fs-section, 15px)',
            fontWeight: 600,
            color: milestone.status === 'pending' ? 'rgba(205,214,224,0.72)' : '#E6EDF3',
          }}
        >
          {milestone.label}
        </span>
        <StatusIcon status={milestone.status} />
        {milestone.timestamp_iso && (
          <span
            title={formatAbsolute(milestone.timestamp_iso)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--aguila-fs-meta, 11px)',
              color: 'rgba(148,163,184,0.8)',
              marginLeft: 'auto',
            }}
          >
            {formatRelative(milestone.timestamp_iso)} · {formatAbsolute(milestone.timestamp_iso)}
          </span>
        )}
      </div>
      {milestone.sub && (
        <div
          style={{
            fontSize: 'var(--aguila-fs-body, 13px)',
            color: milestone.status === 'pending' ? 'rgba(148,163,184,0.68)' : 'rgba(205,214,224,0.85)',
            lineHeight: 1.5,
          }}
        >
          {milestone.sub}
        </div>
      )}
      {milestone.status === 'active' && (
        <div
          style={{
            marginTop: 8,
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: '#F4D47A',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          Etapa actual
        </div>
      )}
    </div>
  )

  if (!milestone.href) return body
  return (
    <Link
      href={milestone.href}
      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
      aria-label={`Abrir ${milestone.label}`}
    >
      {body}
    </Link>
  )
}
