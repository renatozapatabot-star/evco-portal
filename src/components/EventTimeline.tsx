'use client'
import { useEffect, useState } from 'react'
import { fmtDateTime } from '@/lib/format-utils'

interface TimelineEvent {
  id: string
  evento: string
  fecha: string
  hora: string
  usuario: string
  tipo: 'arrival' | 'document' | 'semaforo' | 'inspection' | 'crossing' | 'other'
}

const EVENT_CONFIG = {
  arrival:    { icon: '🚛', color: 'var(--accent-silver-bright, #E8EAED)',    label: 'Llegada' },
  document:   { icon: '📄', color: 'var(--amber-600, #d97706)', label: 'Documentos' },
  semaforo:   { icon: '🚦', color: 'var(--amber-600, #d97706)', label: 'Semáforo' },
  inspection: { icon: '🔍', color: 'var(--status-red, #ef4444)',  label: 'Inspección' },
  crossing:   { icon: '✅', color: 'var(--status-green, #22c55e)', label: 'Cruce' },
  other:      { icon: '📌', color: 'var(--text-muted, #9ca3af)',    label: 'Evento' },
}

function classifyEvent(evento: string): TimelineEvent['tipo'] {
  const e = evento.toLowerCase()
  if (e.includes('llegad') || e.includes('arribo') || e.includes('entrada') || e.includes('recib')) return 'arrival'
  if (e.includes('document') || e.includes('factura') || e.includes('pedimento') || e.includes('revis')) return 'document'
  if (e.includes('semáforo') || e.includes('semaforo') || e.includes('luz') || e.includes('modulac')) return 'semaforo'
  if (e.includes('inspecci') || e.includes('reconoc') || e.includes('revision') || e.includes('rojo')) return 'inspection'
  if (e.includes('cruc') || e.includes('paso') || e.includes('salida') || e.includes('libera') || e.includes('despacha')) return 'crossing'
  return 'other'
}

export function EventTimeline({ traficoId }: { traficoId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [totalHours, setTotalHours] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/data?table=globalpc_eventos&cve_trafico=${encodeURIComponent(traficoId)}&limit=100&order_by=fecha&order_dir=asc`)
      .then(r => r.json())
      .then(data => {
        const raw = data.data || data || []
        const mapped: TimelineEvent[] = raw.map((e: { id?: string; consecutivo?: number; comentarios?: string | null; evento?: string | null; descripcion?: string | null; fecha: string; hora?: string; registrado_por?: string | null; usuario?: string | null }, i: number) => ({
          id: e.id || e.consecutivo || String(i),
          evento: e.comentarios || e.evento || e.descripcion || 'Evento registrado',
          fecha: e.fecha,
          hora: e.hora || '',
          usuario: e.registrado_por || e.usuario || '',
          tipo: classifyEvent(e.comentarios || e.evento || ''),
        }))
        setEvents(mapped)

        if (mapped.length >= 2) {
          const first = new Date(mapped[0].fecha)
          const last = new Date(mapped[mapped.length - 1].fecha)
          const hours = (last.getTime() - first.getTime()) / 3600000
          if (hours > 0 && hours < 8760) {
            setTotalHours(Math.round(hours * 10) / 10)
          }
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [traficoId])

  if (loading) return (
    <div style={{ padding: '20px 0' }}>
      {[1,2,3,4].map(i => (
        <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8, borderRadius: 8 }} />
      ))}
    </div>
  )

  if (events.length === 0) return (
    <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
      Sin eventos registrados para este embarque.
    </p>
  )

  return (
    <div>
      {totalHours !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--r-md, 8px)',
          marginBottom: 16,
          border: '1px solid var(--border-light)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tiempo total:</span>
          <span style={{
            fontSize: 15, fontWeight: 700,
            color: totalHours > 48 ? 'var(--status-red, #ef4444)' : totalHours > 24 ? 'var(--amber-600, #d97706)' : 'var(--status-green, #22c55e)',
            fontFamily: 'var(--font-data)'
          }}>
            {totalHours}h
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            ({events.length} eventos)
          </span>
        </div>
      )}

      <div style={{ position: 'relative', paddingLeft: 24 }}>
        <div style={{
          position: 'absolute', left: 7, top: 8, bottom: 8,
          width: 2, background: 'var(--border-default, rgba(255,255,255,0.08))',
        }} />

        {events.map((event, i) => {
          const config = EVENT_CONFIG[event.tipo]
          const isLast = i === events.length - 1
          return (
            <div key={event.id} style={{
              position: 'relative',
              paddingBottom: isLast ? 0 : 16,
              display: 'flex',
              gap: 12,
            }}>
              <div style={{
                position: 'absolute',
                left: -24,
                top: 2,
                width: 16, height: 16,
                borderRadius: '50%',
                background: config.color,
                border: '2px solid var(--bg-card, #1a1a1a)',
                zIndex: 1,
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  color: 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>{config.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.evento}</span>
                </div>
                <div style={{
                  fontSize: 11.5, color: 'var(--text-muted)',
                  marginTop: 2,
                  display: 'flex', gap: 8,
                }}>
                  <span>{fmtDateTime(event.fecha)}</span>
                  {event.usuario && <span>· {event.usuario}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
