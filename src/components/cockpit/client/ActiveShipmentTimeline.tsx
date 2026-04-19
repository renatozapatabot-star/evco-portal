import Link from 'next/link'
import { GlassCard } from '@/components/aguila/GlassCard'
import { translateEstatus } from '@/lib/estatus-translator'

/**
 * ActiveShipmentTimeline — client cockpit "next shipment at a glance."
 *
 * Renders the most-imminent tráfico (first row of getClienteActiveTraficos,
 * which already orders by fecha_llegada desc). Shows the 5 canonical broker
 * stages with the current stage derived from estatus + pedimento presence.
 *
 * Client-surface rule (invariant #24): no compliance urgency language.
 * This component frames progress positively — "current step in gold,
 * done in teal, pending in muted gray." No countdowns.
 */

export interface ActiveShipment {
  trafico: string
  estatus: string | null
  fechaLlegada: string | null
  pedimento: string | null
}

const STEPS = [
  { key: 'documentos',    label: 'Documentos' },
  { key: 'clasificacion', label: 'Clasificación' },
  { key: 'pedimento',     label: 'Pedimento' },
  { key: 'cruce',         label: 'Cruce' },
  { key: 'entregado',     label: 'Entregado' },
] as const

/**
 * Returns 1-based index of the current step (1..5).
 * Steps with index < current are "complete"; index === current is "active";
 * index > current is "pending."
 */
function deriveCurrentStep(estatus: string | null, pedimento: string | null): number {
  if (!estatus) return 1
  switch (estatus) {
    case 'En Proceso':      return pedimento ? 3 : 1
    case 'Documentacion':
    case 'Documentación':   return 1
    case 'En Aduana':       return 2
    case 'Pedimento Pagado': return 4 // pedimento done, cruce in flight
    case 'Cruzado':         return 5 // cruce done, awaiting delivery
    case 'E1':
    case 'Entregado':       return 6 // all 5 steps complete
    default:                return 1
  }
}

const TONES = {
  done:    { dot: 'var(--portal-ice-3)', text: 'var(--portal-ice-3)', line: 'rgba(13,148,136,0.5)' }, // teal
  active:  { dot: '#C9A84C', text: '#C9A84C', line: 'rgba(201,168,76,0.45)' }, // gold
  pending: { dot: 'rgba(148,163,184,0.4)', text: 'rgba(148,163,184,0.6)', line: 'rgba(148,163,184,0.2)' },
} as const

function etaLabel(fechaLlegada: string | null): string | null {
  if (!fechaLlegada) return null
  const d = new Date(fechaLlegada)
  if (isNaN(d.getTime())) return null
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function ActiveShipmentTimeline({ shipment }: { shipment: ActiveShipment | null }) {
  if (!shipment) {
    return (
      <GlassCard tier="secondary" ariaLabel="Sin embarques activos">
        <div style={{ padding: 8, color: 'rgba(148,163,184,0.8)', fontSize: 'var(--aguila-fs-body)' }}>
          Tu operación está en calma · Todo en orden.
        </div>
      </GlassCard>
    )
  }

  const current = deriveCurrentStep(shipment.estatus, shipment.pedimento)
  const estatusDisplay = translateEstatus(shipment.estatus)
  const eta = etaLabel(shipment.fechaLlegada)

  return (
    <GlassCard tier="secondary" ariaLabel={`Timeline del embarque ${shipment.trafico}`}>
      {/* Header — trafico ref + estatus chip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 'var(--aguila-fs-label)', letterSpacing: 'var(--aguila-ls-label)', textTransform: 'uppercase', color: 'rgba(148,163,184,0.7)' }}>
            Tu próximo embarque
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-kpi-compact)', fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 700, color: 'var(--portal-fg-1)', marginTop: 4 }}>
            {shipment.trafico}
          </div>
        </div>
        <span style={{
          padding: '4px 10px', borderRadius: 20,
          fontSize: 'var(--aguila-fs-label)', fontWeight: 600,
          background: 'rgba(13,148,136,0.12)', color: 'var(--portal-ice-3)',
        }}>
          {estatusDisplay.label}
        </span>
      </div>

      {/* Timeline rail — horizontal ≥ 700px, vertical < 700px */}
      <ol
        aria-label="Etapas del embarque"
        style={{
          display: 'flex',
          gap: 0,
          margin: 0,
          padding: 0,
          listStyle: 'none',
          flexWrap: 'wrap',
        }}
      >
        {STEPS.map((step, idx) => {
          const i = idx + 1
          const tone = i < current ? TONES.done : i === current ? TONES.active : TONES.pending
          const isLast = idx === STEPS.length - 1
          return (
            <li
              key={step.key}
              style={{
                flex: '1 1 120px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                position: 'relative',
                minWidth: 90,
              }}
            >
              {/* connector line to next step */}
              {!isLast && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 9,
                    left: 'calc(50% + 14px)',
                    right: 'calc(-50% + 14px)',
                    height: 2,
                    background: tone.line,
                  }}
                />
              )}
              {/* dot */}
              <span
                aria-hidden
                style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: tone.dot,
                  boxShadow: i === current ? '0 0 12px rgba(201,168,76,0.35)' : 'none',
                  flexShrink: 0,
                  display: 'inline-block',
                  zIndex: 1,
                }}
              />
              <span style={{
                fontSize: 'var(--aguila-fs-label)',
                letterSpacing: 'var(--aguila-ls-label)',
                textTransform: 'uppercase',
                color: tone.text,
                fontWeight: 600,
                textAlign: 'center',
              }}>
                {step.label}
              </span>
              {i < current && (
                <span aria-hidden style={{ fontSize: 14, color: 'var(--portal-ice-3)', marginTop: -4 }}>✓</span>
              )}
            </li>
          )
        })}
      </ol>

      {/* ETA line */}
      {eta && (
        <div style={{
          marginTop: 16, paddingTop: 12,
          borderTop: '1px solid rgba(148,163,184,0.15)',
          fontSize: 'var(--aguila-fs-body)',
          color: 'rgba(230,237,243,0.85)',
        }}>
          Llegada prevista: <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 600, color: 'var(--portal-fg-1)' }}>{eta}</span>
        </div>
      )}

      {/* Drill-down */}
      <div style={{ marginTop: 12 }}>
        <Link
          href="/traficos"
          style={{
            color: 'var(--portal-fg-3)',
            fontSize: 'var(--aguila-fs-body)',
            textDecoration: 'none',
            borderBottom: '1px dashed rgba(192,197,206,0.4)',
          }}
        >
          Ver todos mis embarques →
        </Link>
      </div>
    </GlassCard>
  )
}
