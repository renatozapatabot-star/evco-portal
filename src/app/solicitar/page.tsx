'use client'

import { Ship } from 'lucide-react'
import { ShipmentRequest } from '@/components/client/ShipmentRequest'

export default function SolicitarPage() {
  return (
    <div className="page-shell" style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'rgba(192,197,206,0.08)',
          border: '1px solid rgba(192,197,206,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ship size={20} color="var(--portal-fg-3)" strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--portal-fg-1)', margin: 0 }}>
            Solicitar Embarque
          </h1>
          <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)', margin: '2px 0 0' }}>
            Inicia una nueva operación de importación
          </p>
        </div>
      </div>
      <ShipmentRequest />
    </div>
  )
}
