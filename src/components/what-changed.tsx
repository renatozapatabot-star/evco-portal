'use client'
import { useState, useEffect } from 'react'
import { ArrowRight, TrendingUp, Package, FileCheck, AlertTriangle, X } from 'lucide-react'
import { updateLastVisit } from '@/lib/last-visit'
import { formatAbsoluteDate } from '@/lib/format-utils'

interface Props { newCrossings: number; newEntradas: number; statusChanges: number; newIncidencias: number; sinceTime: Date }

export function WhatChanged({ newCrossings, newEntradas, statusChanges, newIncidencias, sinceTime }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(updateLastVisit, 10000)
    return () => clearTimeout(timer)
  }, [])

  const changes = [
    newCrossings > 0 && { icon: TrendingUp, iconColor: 'var(--success)', main: `${newCrossings} tráfico${newCrossings > 1 ? 's' : ''} cruzaron`, detail: 'Despachados por aduana 240' },
    newEntradas > 0 && { icon: Package, iconColor: 'var(--info)', main: `${newEntradas} entrada${newEntradas > 1 ? 's' : ''} nueva${newEntradas > 1 ? 's' : ''}`, detail: 'Registradas en bodega' },
    statusChanges > 0 && { icon: FileCheck, iconColor: 'var(--gold-500)', main: `${statusChanges} cambio${statusChanges > 1 ? 's' : ''} de estado`, detail: 'Tráficos actualizados' },
    newIncidencias > 0 && { icon: AlertTriangle, iconColor: 'var(--danger)', main: `${newIncidencias} incidencia${newIncidencias > 1 ? 's' : ''} nueva${newIncidencias > 1 ? 's' : ''}`, detail: 'Requiere revisión' },
  ].filter(Boolean) as any[]

  if (changes.length === 0 || !visible) return null

  return (
    <div className="what-changed">
      <div className="wc-header">
        <span className="wc-title">Cambios desde {formatAbsoluteDate(sinceTime)}</span>
        <button className="wc-close" onClick={() => { setVisible(false); updateLastVisit() }} aria-label="Cerrar"><X size={14} /></button>
      </div>
      <div className="wc-items">
        {changes.map((c: { icon: typeof TrendingUp; iconColor: string; main: string; detail: string }, i: number) => (
          <div key={i} className="wc-item">
            <c.icon size={14} style={{ color: c.iconColor, flexShrink: 0 }} />
            <div className="wc-item-text">
              <span className="wc-item-main">{c.main}</span>
              <span className="wc-item-detail">{c.detail}</span>
            </div>
            <ArrowRight size={12} style={{ color: 'var(--n-300)', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
