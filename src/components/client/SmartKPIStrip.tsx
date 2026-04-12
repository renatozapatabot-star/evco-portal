'use client'

import { AlertTriangle, Check } from 'lucide-react'
import CountingNumber from '@/components/ui/CountingNumber'

interface Props {
  activeShipments: number
  activeShipmentsYesterday: number
  entradasThisMonth: number
  entradasLastWeek: number
  cruzadosYTD: number
  cruzadosLastMonth: number
  pedimentosEnProceso: number
}

// ── Calm zero: value=0 with no meaningful delta → show check instead of big "0" ──
function isCalmZero(value: number, delta: number, anomaly?: boolean): boolean {
  return value === 0 && delta === 0 && !anomaly
}

// ── Delta badge with urgency-aware coloring ──
function DeltaBadge({ delta, label, anomaly, isUrgency }: {
  delta: number; label: string; anomaly?: boolean; isUrgency?: boolean
}) {
  if (anomaly) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 11, color: '#FBBF24', fontWeight: 600,
      }}>
        <AlertTriangle size={10} /> anormal
      </span>
    )
  }
  if (delta === 0) {
    return (
      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
        → sin cambio
      </span>
    )
  }

  const isPositive = delta > 0
  let color: string

  if (isUrgency) {
    // Urgency metrics: more = bad (red), less = good (green)
    color = isPositive ? '#EF4444' : '#22C55E'
  } else {
    // Volume metrics: small change = noise (gray), big positive = green, big negative = gray
    if (Math.abs(delta) < 5) {
      color = '#64748b'
    } else {
      color = isPositive ? '#22C55E' : '#64748b'
    }
  }

  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      color,
    }}>
      {isPositive ? '+' : ''}{delta} {label}
    </span>
  )
}

interface KPIConfigFull {
  label: string
  shortLabel: string
  value: number
  delta: number
  deltaLabel: string
  color?: string
  anomaly?: boolean
  isUrgency?: boolean
  calmLabel?: string // Text to show when value is a calm zero
}

export function SmartKPIStrip(props: Props) {
  // Hide entire strip when nothing is pending — no pointless checkmarks
  if (props.activeShipments === 0 && props.entradasThisMonth === 0 && props.cruzadosYTD === 0 && props.pedimentosEnProceso === 0) {
    return null
  }

  const kpis: KPIConfigFull[] = [
    {
      label: 'En proceso',
      shortLabel: 'En proceso',
      value: props.activeShipments,
      delta: props.activeShipments - props.activeShipmentsYesterday,
      deltaLabel: 'hoy',
      color: '#00E5FF',
      isUrgency: true,
      calmLabel: 'Despejado',
    },
    {
      label: 'Entradas este mes',
      shortLabel: 'Entradas',
      value: props.entradasThisMonth,
      delta: props.entradasThisMonth - props.entradasLastWeek,
      deltaLabel: 'vs semana pasada',
      isUrgency: false,
    },
    {
      label: `Cruzados ${new Date().getFullYear()}`,
      shortLabel: 'Cruzados',
      value: props.cruzadosYTD,
      delta: props.cruzadosYTD - props.cruzadosLastMonth,
      deltaLabel: 'vs mes pasado',
      color: '#22C55E',
      isUrgency: false,
    },
    {
      label: 'Pedimentos en trámite',
      shortLabel: 'Pedimentos',
      value: props.pedimentosEnProceso,
      delta: 0,
      deltaLabel: '',
      anomaly: props.pedimentosEnProceso === 0 && props.activeShipments > 0 && ![0, 6].includes(new Date().getDay()),
      isUrgency: true,
      calmLabel: 'Al corriente',
    },
  ]

  return (
    <div className="smart-kpi-strip" style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      padding: '20px 24px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      marginBottom: 16,
    }}>
      <div className="smart-kpi-inner">
        {kpis.map((kpi) => {
          const calm = isCalmZero(kpi.value, kpi.delta, kpi.anomaly) && kpi.calmLabel

          return (
            <div key={kpi.label} className="smart-kpi-item" style={{ textAlign: 'center', overflow: 'hidden' }}>
              {calm ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                    <Check size={24} color="#00E5FF" strokeWidth={2.5} />
                  </div>
                  <div className="kpi-label-full" style={{
                    fontSize: 10, fontWeight: 700, color: '#8b9ab5',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginTop: 4, marginBottom: 4,
                  }}>
                    {kpi.label}
                  </div>
                  <div className="kpi-label-short" style={{
                    fontSize: 10, fontWeight: 700, color: '#8b9ab5',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginTop: 4, marginBottom: 2,
                    display: 'none',
                  }}>
                    {kpi.shortLabel}
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                    {kpi.calmLabel}
                  </span>
                </>
              ) : (
                <>
                  <CountingNumber
                    value={kpi.value}
                    sessionKey={`client-kpi-${kpi.label}`}
                    className="kpi-number"
                    style={{
                      fontWeight: 800,
                      color: kpi.color || '#E6EDF3',
                      lineHeight: 1.1,
                      display: 'block',
                    }}
                  />
                  <div className="kpi-label-full" style={{
                    fontSize: 10, fontWeight: 700, color: '#8b9ab5',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginTop: 6, marginBottom: 4,
                  }}>
                    {kpi.label}
                  </div>
                  <div className="kpi-label-short" style={{
                    fontSize: 10, fontWeight: 700, color: '#8b9ab5',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginTop: 4, marginBottom: 2,
                    display: 'none',
                  }}>
                    {kpi.shortLabel}
                  </div>
                  <DeltaBadge delta={kpi.delta} label={kpi.deltaLabel} anomaly={kpi.anomaly} isUrgency={kpi.isUrgency} />
                </>
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        .smart-kpi-inner {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .kpi-number {
          font-size: 32px;
        }
        @media (max-width: 1024px) {
          .smart-kpi-inner {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .smart-kpi-strip {
            padding: 12px !important;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .smart-kpi-strip::-webkit-scrollbar {
            display: none;
          }
          .smart-kpi-inner {
            display: flex !important;
            gap: 12px !important;
          }
          .smart-kpi-item {
            scroll-snap-align: center;
            flex-shrink: 0;
            width: 72vw;
            max-width: 260px;
          }
          .kpi-number {
            font-size: 24px !important;
          }
          .kpi-label-full {
            display: none !important;
          }
          .kpi-label-short {
            display: block !important;
          }
        }
      `}</style>
    </div>
  )
}
