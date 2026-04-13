'use client'

import { useEffect, useState } from 'react'

const TIMELINE_STAGES = [
  { key: 'arrived', label: 'Llegada a Bodega', icon: '📦', eventKeys: ['LLEGADA', 'ARRIBO', 'BODEGA', 'RECIB'] },
  { key: 'docs_received', label: 'Documentos Recibidos', icon: '📄', eventKeys: ['DOCUMENTO', 'FACTURA', 'DOC'] },
  { key: 'classified', label: 'Clasificación', icon: '🏷️', eventKeys: ['CLASIFIC', 'FRACCION'] },
  { key: 'cove_filed', label: 'COVE Presentado', icon: '✅', eventKeys: ['COVE'] },
  { key: 'mve_filed', label: 'MVE Presentado', icon: '📋', eventKeys: ['MVE', 'MANIFEST'] },
  { key: 'pedimento_drafted', label: 'Pedimento Elaborado', icon: '📝', eventKeys: ['ELABOR', 'PEDIMENTO'] },
  { key: 'pedimento_transmitted', label: 'Pedimento Transmitido', icon: '📡', eventKeys: ['TRANSMIS', 'TRANSMIT'] },
  { key: 'payment_made', label: 'Pago de Contribuciones', icon: '💰', eventKeys: ['PAGO', 'CONTRIBU'] },
  { key: 'semaforo', label: 'Semáforo', icon: '🚦', eventKeys: ['SEMAFORO', 'SEMAFOR'] },
  { key: 'crossing', label: 'Cruce', icon: '🌉', eventKeys: ['CRUCE', 'CRUZ', 'DESPACHO'] },
  { key: 'delivered', label: 'Entregado', icon: '🏭', eventKeys: ['ENTREG', 'DESTINO'] },
]

interface TraficoEvent { tipo?: string; descripcion?: string; fecha?: string; evento?: string; [key: string]: unknown }
interface TraficoTimelineProps {
  trafico: { fecha_llegada?: string; pedimento?: string; fecha_pago?: string; fecha_cruce?: string; estatus?: string; [key: string]: unknown }
  eventos: TraficoEvent[]
}

export function TraficoTimeline({ trafico, eventos }: TraficoTimelineProps) {
  // Map eventos to stages
  const stageStatus: Record<string, { status: 'completed' | 'in_progress' | 'pending' | 'blocked'; date?: string }> = {}

  // Initialize all as pending
  TIMELINE_STAGES.forEach(s => { stageStatus[s.key] = { status: 'pending' } })

  // Map from trafico data
  if (trafico.fecha_llegada) {
    stageStatus.arrived = { status: 'completed', date: trafico.fecha_llegada }
  }
  if (trafico.pedimento) {
    stageStatus.pedimento_drafted = { status: 'completed' }
  }
  if (trafico.fecha_pago) {
    stageStatus.payment_made = { status: 'completed', date: trafico.fecha_pago }
  }
  if (trafico.mve_folio) {
    stageStatus.mve_filed = { status: 'completed' }
  }
  const isCruzado = (trafico.estatus || '').toLowerCase().includes('cruz')
  if (isCruzado && trafico.fecha_cruce) {
    stageStatus.crossing = { status: 'completed', date: trafico.fecha_cruce }
  }

  // Map from GlobalPC eventos
  for (const ev of (eventos || [])) {
    const eventoUpper = (ev.evento || '').toUpperCase()
    for (const stage of TIMELINE_STAGES) {
      if (stage.eventKeys.some(k => eventoUpper.includes(k))) {
        if (stageStatus[stage.key].status !== 'completed') {
          stageStatus[stage.key] = { status: 'completed', date: ev.fecha || stageStatus[stage.key].date }
        }
      }
    }
  }

  // Determine current stage (first non-completed)
  let foundCurrent = false
  for (const stage of TIMELINE_STAGES) {
    if (stageStatus[stage.key].status !== 'completed' && !foundCurrent) {
      stageStatus[stage.key].status = isCruzado ? 'completed' : 'in_progress'
      foundCurrent = true
    }
  }

  // If cruzado, mark all before crossing as completed
  if (isCruzado) {
    let reachedCross = false
    for (const stage of TIMELINE_STAGES) {
      if (stage.key === 'crossing') { reachedCross = true; stageStatus[stage.key].status = 'completed'; continue }
      if (!reachedCross) stageStatus[stage.key].status = 'completed'
    }
  }

  // MVE warning — after deadline, not filed
  if (!trafico.mve_folio && !isCruzado && new Date() >= new Date('2026-03-31')) {
    stageStatus.mve_filed = { status: 'blocked' }
  }

  const fmtDateTime = (s: string | null | undefined) => {
    if (!s) return ''
    try {
      return new Date(s).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  return (
    <div style={{
      padding: '16px 20px', marginBottom: 16, borderRadius: 12,
      background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--n-400)', marginBottom: 12 }}>
        Progreso del Embarque
      </div>
      {TIMELINE_STAGES.map((stage, idx) => {
        const info = stageStatus[stage.key]
        const isLast = idx === TIMELINE_STAGES.length - 1
        const isCompleted = info.status === 'completed'
        const isCurrent = info.status === 'in_progress'
        const isBlocked = info.status === 'blocked'

        return (
          <div key={stage.key} style={{ display: 'flex', gap: 12, position: 'relative' }}>
            {/* Vertical line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, flexShrink: 0,
                background: isCompleted ? 'var(--success)' : isCurrent ? 'var(--gold-600)' : isBlocked ? 'var(--danger)' : 'var(--n-100)',
                color: isCompleted || isCurrent || isBlocked ? 'rgba(9,9,11,0.75)' : 'var(--n-400)',
                border: isCurrent ? '2px solid var(--gold-400)' : 'none',
                boxShadow: isCurrent ? '0 0 0 3px rgba(212,175,55,0.2)' : 'none',
              }}>
                {isCompleted ? '✓' : isCurrent ? '●' : isBlocked ? '!' : '○'}
              </div>
              {!isLast && (
                <div style={{
                  width: 2, flex: 1, minHeight: 20,
                  background: isCompleted ? 'var(--success)' : 'var(--n-100)',
                }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 8, minHeight: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 14 }}>{stage.icon}</span>
                <span style={{
                  fontSize: 13, fontWeight: isCompleted || isCurrent ? 600 : 400,
                  color: isCompleted ? 'var(--text-primary)' : isCurrent ? 'var(--gold-600)' : isBlocked ? 'var(--danger)' : 'var(--n-400)',
                }}>
                  {stage.label}
                </span>
                {isBlocked && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '1px 6px', borderRadius: 4 }}>PENDIENTE</span>}
              </div>
              {info.date && (
                <div style={{ fontSize: 11, color: 'var(--n-400)', marginTop: 2, marginLeft: 20 }}>
                  {fmtDateTime(info.date)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
