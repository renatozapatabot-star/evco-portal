'use client'

import { AlertTriangle } from 'lucide-react'
import CountingNumber from '@/components/ui/CountingNumber'

interface KPIConfig {
  label: string
  value: number
  delta: number
  deltaLabel: string
  color?: string
  anomaly?: boolean
}

interface Props {
  activeShipments: number
  activeShipmentsYesterday: number
  entradasThisMonth: number
  entradasLastWeek: number
  cruzadosYTD: number
  cruzadosLastMonth: number
  pedimentosEnProceso: number
}

function DeltaBadge({ delta, label, anomaly }: { delta: number; label: string; anomaly?: boolean }) {
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
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      color: isPositive ? '#22C55E' : '#EF4444',
    }}>
      {isPositive ? '+' : ''}{delta} {label}
    </span>
  )
}

export function SmartKPIStrip(props: Props) {
  const kpis: KPIConfig[] = [
    {
      label: 'Tráficos activos',
      value: props.activeShipments,
      delta: props.activeShipments - props.activeShipmentsYesterday,
      deltaLabel: 'hoy',
      color: '#00E5FF',
    },
    {
      label: 'Entradas este mes',
      value: props.entradasThisMonth,
      delta: props.entradasThisMonth - props.entradasLastWeek,
      deltaLabel: 'vs semana pasada',
    },
    {
      label: `Cruzados ${new Date().getFullYear()}`,
      value: props.cruzadosYTD,
      delta: props.cruzadosYTD - props.cruzadosLastMonth,
      deltaLabel: 'vs mes pasado',
      color: '#22C55E',
    },
    {
      label: 'Pedimentos en trámite',
      value: props.pedimentosEnProceso,
      delta: 0,
      deltaLabel: '',
      anomaly: props.pedimentosEnProceso === 0 && props.activeShipments > 0,
    },
  ]

  return (
    <div className="smart-kpi-strip" style={{
      display: 'grid',
      gap: 12,
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      padding: '20px 24px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      marginBottom: 16,
    }}>
      {kpis.map((kpi) => (
        <div key={kpi.label} style={{ textAlign: 'center' }}>
          <CountingNumber
            value={kpi.value}
            sessionKey={`client-kpi-${kpi.label}`}
            style={{
              fontSize: 32, fontWeight: 800,
              color: kpi.color || '#E6EDF3',
              lineHeight: 1.1,
              display: 'block',
            }}
          />
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#8b9ab5',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginTop: 6, marginBottom: 4,
          }}>
            {kpi.label}
          </div>
          <DeltaBadge delta={kpi.delta} label={kpi.deltaLabel} anomaly={kpi.anomaly} />
        </div>
      ))}

      <style>{`
        .smart-kpi-strip {
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 1024px) {
          .smart-kpi-strip {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .smart-kpi-strip {
            grid-template-columns: repeat(2, 1fr) !important;
            padding: 14px 16px !important;
          }
        }
      `}</style>
    </div>
  )
}
