'use client'

import { useState } from 'react'
import { Bell, Mail, MessageCircle } from 'lucide-react'

const EVENT_TYPES = [
  { key: 'embarque_cruzado', label: 'Embarque cruzado' },
  { key: 'clasificacion_pendiente', label: 'Clasificación pendiente' },
  { key: 'pedimento_aprobado', label: 'Pedimento aprobado' },
  { key: 'anomalia_detectada', label: 'Anomalía detectada' },
  { key: 'documentos_recibidos', label: 'Documentos recibidos' },
  { key: 'reporte_semanal', label: 'Reporte semanal' },
]

const CHANNELS = [
  { key: 'portal', label: 'PORTAL', icon: Bell },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'telegram', label: 'Telegram', icon: MessageCircle },
]

export default function NotificacionesPage() {
  const [prefs, setPrefs] = useState<Record<string, Record<string, boolean>>>(() => {
    const defaults: Record<string, Record<string, boolean>> = {}
    EVENT_TYPES.forEach(e => {
      defaults[e.key] = { portal: true, email: e.key === 'reporte_semanal', telegram: e.key === 'anomalia_detectada' }
    })
    return defaults
  })

  const toggle = (event: string, channel: string) => {
    setPrefs(p => ({
      ...p,
      [event]: { ...p[event], [channel]: !p[event]?.[channel] },
    }))
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: 'var(--portal-fg-1)', marginBottom: 4 }}>Notificaciones</h1>
      <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)', marginBottom: 24 }}>Elige cómo y cuándo recibir alertas de PORTAL.</p>

      <div className="cc-card" style={{ padding: 24, borderRadius: 20 }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 80px)', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 'var(--aguila-fs-compact)', fontWeight: 700, color: 'var(--portal-fg-5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Evento</div>
          {CHANNELS.map(ch => (
            <div key={ch.key} style={{ textAlign: 'center', fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, color: 'var(--portal-fg-5)', textTransform: 'uppercase' }}>
              <ch.icon size={14} style={{ margin: '0 auto 2px', display: 'block', opacity: 0.6 }} />
              {ch.label}
            </div>
          ))}
        </div>

        {/* Event rows */}
        {EVENT_TYPES.map(event => (
          <div key={event.key} style={{
            display: 'grid', gridTemplateColumns: '1fr repeat(3, 80px)', gap: 8,
            padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-fg-1)' }}>{event.label}</span>
            {CHANNELS.map(ch => (
              <div key={ch.key} style={{ textAlign: 'center' }}>
                <button
                  onClick={() => toggle(event.key, ch.key)}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: prefs[event.key]?.[ch.key] ? 'rgba(192,197,206,0.15)' : 'rgba(255,255,255,0.04)',
                    color: prefs[event.key]?.[ch.key] ? 'var(--portal-fg-3)' : 'var(--portal-fg-5)',
                    fontSize: 'var(--aguila-fs-body-lg)', transition: 'all 150ms',
                  }}
                >
                  {prefs[event.key]?.[ch.key] ? '✓' : '·'}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <button style={{
        marginTop: 16, padding: '12px 24px', borderRadius: 12,
        background: 'var(--portal-fg-1)', color: 'var(--portal-ink-0)', fontWeight: 700, fontSize: 'var(--aguila-fs-section)',
        border: 'none', cursor: 'pointer', minHeight: 48,
      }}>
        Guardar preferencias
      </button>
    </div>
  )
}
