'use client'

interface Props {
  estatus: string
}

const STEPS = [
  { key: 'bodega', label: 'Bodega', sublabel: 'Laredo, TX' },
  { key: 'proceso', label: 'En proceso', sublabel: 'Documentando' },
  { key: 'pagado', label: 'Ped. pagado', sublabel: 'Listo' },
  { key: 'puente', label: 'Puente', sublabel: 'World Trade' },
  { key: 'cruzado', label: 'Cruzado', sublabel: 'México' },
]

function getActiveStep(estatus: string): number {
  const s = (estatus || '').toLowerCase()
  if (s.includes('cruz')) return 4
  if (s.includes('pagado')) return 2
  if (s.includes('aduana') || s.includes('semáforo') || s.includes('semaforo')) return 3
  if (s.includes('proceso') || s.includes('documentacion')) return 1
  return 0
}

/**
 * Visual shipment location strip.
 * Shows 5 steps: Bodega → En proceso → Ped. pagado → Puente → Cruzado
 * Current step highlighted in gold. Completed steps in green.
 * NOT a map — a decision indicator showing operational state.
 */
export function ShipmentLocationStrip({ estatus }: Props) {
  const activeStep = getActiveStep(estatus)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '8px 0',
    }}>
      {STEPS.map((step, i) => {
        const isComplete = i < activeStep
        const isCurrent = i === activeStep
        const color = isComplete ? '#16A34A' : isCurrent ? '#C9A84C' : '#6E7681'
        const bgColor = isComplete ? 'rgba(22,163,74,0.1)' : isCurrent ? 'rgba(201,168,76,0.1)' : 'transparent'

        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            {/* Step node */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '6px 4px', borderRadius: 6, background: bgColor,
              flex: 1, minWidth: 0,
            }}>
              {/* Dot or checkmark */}
              <div style={{
                width: isCurrent ? 12 : 8, height: isCurrent ? 12 : 8,
                borderRadius: '50%', background: color,
                marginBottom: 4,
                boxShadow: isCurrent ? `0 0 8px ${color}40` : 'none',
              }} />
              <div style={{
                fontSize: 10, fontWeight: isCurrent ? 700 : 500,
                color, textAlign: 'center',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                width: '100%',
              }}>
                {isComplete ? '✓' : ''} {step.label}
              </div>
              <div style={{
                fontSize: 8, color: isCurrent ? color : '#4B5563',
                textAlign: 'center',
              }}>
                {step.sublabel}
              </div>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div style={{
                height: 2, width: 12, flexShrink: 0,
                background: i < activeStep ? '#16A34A' : 'rgba(255,255,255,0.08)',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
