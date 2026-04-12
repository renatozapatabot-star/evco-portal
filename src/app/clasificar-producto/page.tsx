'use client'

import { Tags } from 'lucide-react'
import { SelfClassify } from '@/components/client/SelfClassify'

export default function ClasificarProductoPage() {
  return (
    <div className="page-shell" style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'rgba(0,229,255,0.08)',
          border: '1px solid rgba(0,229,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Tags size={20} color="#00E5FF" strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E6EDF3', margin: 0 }}>
            Clasificar Producto
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
            Solicita la fracción arancelaria de un producto nuevo
          </p>
        </div>
      </div>
      <SelfClassify />
    </div>
  )
}
