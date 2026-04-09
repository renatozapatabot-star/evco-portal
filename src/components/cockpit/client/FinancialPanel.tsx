'use client'

import { fmtMXNCompact, fmtDelta } from '../shared/formatters'
import type { ClientData } from '../shared/fetchCockpitData'

interface Props {
  financial: ClientData['financial']
}

export function FinancialPanel({ financial }: Props) {
  const facturadoDelta = fmtDelta(financial.facturadoThisMonth, financial.facturadoLastMonth)
  const arancelesDelta = fmtDelta(financial.arancelesThisMonth, financial.arancelesLastMonth)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 12,
    }}>
      {/* Facturado */}
      <div style={{
        background: '#222222', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        borderTop: '3px solid rgba(201,168,76,0.4)',
        padding: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681', marginBottom: 8,
        }}>
          Financiero — este mes
        </div>
        <div className="font-mono" style={{
          fontSize: 28, fontWeight: 800, color: '#E6EDF3', lineHeight: 1,
        }}>
          {fmtMXNCompact(financial.facturadoThisMonth) || '$0 MXN'}
        </div>
        <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4 }}>
          facturado
        </div>
        <div className="font-mono" style={{
          fontSize: 13,
          color: facturadoDelta.startsWith('▲') ? '#16A34A' : facturadoDelta.startsWith('▼') ? '#DC2626' : '#8B949E',
          marginTop: 4,
        }}>
          {facturadoDelta} vs mes anterior
        </div>
      </div>

      {/* Aranceles */}
      <div style={{
        background: '#222222', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        borderTop: '3px solid rgba(201,168,76,0.4)',
        padding: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681', marginBottom: 8,
        }}>
          Aranceles — este mes
        </div>
        <div className="font-mono" style={{
          fontSize: 28, fontWeight: 800, color: '#E6EDF3', lineHeight: 1,
        }}>
          {fmtMXNCompact(financial.arancelesThisMonth) || '$0 MXN'}
        </div>
        <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4 }}>
          aranceles pagados
        </div>
        <div className="font-mono" style={{
          fontSize: 13,
          color: arancelesDelta.startsWith('▲') ? '#DC2626' : arancelesDelta.startsWith('▼') ? '#16A34A' : '#8B949E',
          marginTop: 4,
        }}>
          {arancelesDelta} vs mes anterior
        </div>
      </div>
    </div>
  )
}
