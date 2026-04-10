'use client'

import { useEffect, useState } from 'react'
import { IfThenCard } from '../shared/IfThenCard'
import { fmtDate } from '@/lib/format-utils'

export function ExchangeRateCard() {
  const [tc, setTc] = useState<{ tc: number; fecha: string; source: string } | null>(null)

  useEffect(() => {
    fetch('/api/tipo-cambio')
      .then(r => r.json())
      .then(setTc)
      .catch(() => {})
  }, [])

  return (
    <IfThenCard
      id="operator-exchange-rate"
      state="quiet"
      title="Tipo de cambio"
      quietContent={
        tc ? (
          <div>
            <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: '#eab308', lineHeight: 1 }}>
              ${tc.tc.toFixed(4)}
            </div>
            <div style={{ fontSize: 11, color: '#8B949E', marginTop: 4 }}>
              MXN/USD · {tc.fecha ? fmtDate(tc.fecha) : '—'} · {tc.source}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#6E7681' }}>Cargando...</div>
        )
      }
    />
  )
}
