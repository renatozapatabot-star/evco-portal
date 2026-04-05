'use client'

import { useEffect, useRef } from 'react'
import { fmtUSDCompact } from '@/lib/format-utils'

/**
 * Daily Brief — the reason to open CRUZ every day.
 * Shows once per day on first visit, auto-dismisses after 10s.
 * Content varies by time of day (morning vs evening).
 */

interface DailyBriefProps {
  companyName: string
  crossedYesterday: number
  valueYesterday: number
  newTraficos24h: number
  enProceso: number
  tmecSavings: number
  streakDays: number
  valorYTD: number
  hour: number
  dayOfWeek: number
  onDismiss: () => void
}

export function DailyBrief({
  companyName, crossedYesterday, valueYesterday, newTraficos24h,
  enProceso, tmecSavings, streakDays, valorYTD, hour, dayOfWeek, onDismiss,
}: DailyBriefProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-dismiss after 10s
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 10000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [onDismiss])

  const isEvening = hour >= 18
  const isMonday = dayOfWeek === 1 && hour < 10
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E8E5E0',
      borderLeft: '3px solid #C4963C',
      borderRadius: 12,
      padding: 20,
      maxWidth: 480,
      margin: '0 auto',
      animation: 'fadeInUp 200ms ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
          🦀 {greeting}, {companyName}
        </div>
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9B9B9B', fontSize: 18, padding: 4, lineHeight: 1,
        }} aria-label="Cerrar resumen">×</button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!isEvening ? (
          <>
            {/* Morning/afternoon: yesterday + today */}
            {(crossedYesterday > 0 || valueYesterday > 0) && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Ayer
                </div>
                <div style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.5 }}>
                  {crossedYesterday > 0
                    ? `${crossedYesterday} tráfico${crossedYesterday !== 1 ? 's' : ''} cruzaron (${fmtUSDCompact(valueYesterday)} valor)`
                    : 'Sin cruces'}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Hoy
              </div>
              <div style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.5 }}>
                {enProceso > 0
                  ? `${enProceso} en proceso · ${newTraficos24h > 0 ? `${newTraficos24h} nuevos` : '0 pendientes'}`
                  : 'Sin operaciones activas'}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Evening: day summary */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Resumen del día
              </div>
              <div style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.5 }}>
                {crossedYesterday > 0
                  ? `${crossedYesterday} cruzados, ${newTraficos24h} nuevos, ${fmtUSDCompact(valueYesterday)} importado`
                  : `${newTraficos24h > 0 ? `${newTraficos24h} nuevos` : 'Sin movimiento hoy'}`}
              </div>
              <div style={{ fontSize: 13, color: '#6B6B6B', fontStyle: 'italic', marginTop: 6 }}>
                Todo en orden. Que descanse. 🦀
              </div>
            </div>
          </>
        )}

        {/* T-MEC savings */}
        {tmecSavings >= 1000 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(196,150,60,0.04)',
          }}>
            <span style={{ fontSize: 14 }}>💰</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#8B6914' }}>
              Ahorro T-MEC: {fmtUSDCompact(tmecSavings)}
            </span>
          </div>
        )}

        {/* Streak */}
        {streakDays >= 5 && (
          <div style={{ fontSize: 13, color: '#1A1A1A' }}>
            🔥 Racha: {streakDays} días sin incidencias
          </div>
        )}

        {/* Monday: week context */}
        {isMonday && valorYTD > 0 && (
          <div style={{ fontSize: 12, color: '#6B6B6B', fontStyle: 'italic' }}>
            Inicio de semana · {fmtUSDCompact(valorYTD)} importado en el año
          </div>
        )}
      </div>

      {/* Footer */}
      {!isEvening && (
        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button onClick={onDismiss} style={{
            fontSize: 12, fontWeight: 700, color: '#C4963C',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>
            Ver detalle →
          </button>
        </div>
      )}
    </div>
  )
}
