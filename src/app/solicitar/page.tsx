'use client'

import { Ship } from 'lucide-react'
import { ShipmentRequest } from '@/components/client/ShipmentRequest'

export default function SolicitarPage() {
  return (
    <div className="page-shell" style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'rgba(0,229,255,0.08)',
          border: '1px solid rgba(0,229,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ship size={20} color="#00E5FF" strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E6EDF3', margin: 0 }}>
            Solicitar Embarque
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
            Inicia una nueva operación de importación
          </p>
        </div>
      </div>
      <ShipmentRequest />
    </div>
  )
}
