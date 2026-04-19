'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExceptionCard, getUrgencyOrder } from './ExceptionCard'
import { ExceptionModal } from './ExceptionModal'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { WorkflowEvent } from './ExceptionCard'

type FilterKey = 'todas' | 'clasificacion' | 'documentos' | 'dispatch' | 'errores'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'clasificacion', label: 'Clasificacion' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'dispatch', label: 'Despacho' },
  { key: 'errores', label: 'Errores' },
]

function matchesFilter(event: WorkflowEvent, filter: FilterKey): boolean {
  if (filter === 'todas') return true
  if (filter === 'clasificacion') return event.event_type.startsWith('classify')
  if (filter === 'documentos') return event.event_type.startsWith('docs')
  if (filter === 'dispatch') return event.event_type.startsWith('crossing')
  if (filter === 'errores') return event.status === 'failed' || event.status === 'dead_letter'
  return true
}

function sortByUrgency(a: WorkflowEvent, b: WorkflowEvent): number {
  const urgA = getUrgencyOrder(a.created_at)
  const urgB = getUrgencyOrder(b.created_at)
  if (urgA !== urgB) return urgA - urgB // red (0) first
  // Same urgency tier: oldest first
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}

interface QueueClientProps {
  initialEvents: WorkflowEvent[]
}

export function QueueClient({ initialEvents }: QueueClientProps) {
  const [events, setEvents] = useState<WorkflowEvent[]>(initialEvents)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('todas')
  const [selectedEvent, setSelectedEvent] = useState<WorkflowEvent | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Realtime subscription
  useEffect(() => {
    const sb = createBrowserSupabaseClient()
    const channel = sb.channel('exception-queue')

    channel
      .on(
        'postgres_changes' as 'system',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_events',
        },
        () => {
          // Debounce refresh to avoid rapid re-fetches
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            refreshEvents()
          }, 1000)
        },
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      sb.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshEvents = useCallback(async () => {
    const sb = createBrowserSupabaseClient()
    const { data } = await sb
      .from('workflow_events')
      .select('id, workflow, event_type, trigger_id, company_id, payload, status, created_at, error_message, attempt_count')
      .in('status', ['pending', 'failed', 'dead_letter'])
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) {
      setEvents(data as WorkflowEvent[])
    }
  }, [])

  const handleResolved = useCallback((eventId: string) => {
    setSelectedEvent(null)
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
    setSuccessId(eventId)
    setTimeout(() => setSuccessId(null), 2000)
  }, [])

  const filtered = events.filter((e) => matchesFilter(e, activeFilter)).sort(sortByUrgency)

  const modalTitle = selectedEvent
    ? selectedEvent.status === 'failed' || selectedEvent.status === 'dead_letter'
      ? 'Resolver Error'
      : selectedEvent.event_type.startsWith('classify')
        ? 'Clasificacion Manual'
        : selectedEvent.event_type === 'docs.solicitation_needed'
          ? 'Solicitud de Documentos'
          : selectedEvent.event_type === 'crossing.dispatch_needs_assignment'
            ? 'Asignar Transportista'
            : 'Resolver Excepcion'
    : ''

  return (
    <>
      {/* Success toast */}
      {successId && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid var(--portal-status-green-ring)',
            borderRadius: 12,
            padding: '12px 24px',
            color: 'var(--portal-status-green-fg)',
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 600,
            zIndex: 1000,
            backdropFilter: 'blur(12px)',
          }}
        >
          Resuelto correctamente
        </div>
      )}

      {/* Filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {FILTERS.map(({ key, label }) => {
          const isActive = activeFilter === key
          const count = key === 'todas'
            ? events.length
            : events.filter((e) => matchesFilter(e, key)).length

          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                minHeight: 44,
                background: isActive ? 'rgba(192,197,206,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? 'rgba(192,197,206,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 20,
                color: isActive ? 'var(--portal-fg-3)' : 'var(--portal-fg-4)',
                fontSize: 'var(--aguila-fs-body)',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 150ms ease',
              }}
            >
              {label}
              {count > 0 && (
                <span
                  style={{
                    fontSize: 'var(--aguila-fs-meta)',
                    fontFamily: 'var(--font-mono)',
                    background: isActive ? 'rgba(192,197,206,0.2)' : 'rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    padding: '1px 6px',
                    minWidth: 20,
                    textAlign: 'center',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Event list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Sin excepciones pendientes"
          description={
            activeFilter === 'todas'
              ? 'Todos los eventos del workflow fueron procesados automaticamente.'
              : 'No hay excepciones en esta categoria.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((event) => (
            <ExceptionCard
              key={event.id}
              event={event}
              onAction={(e) => setSelectedEvent(e)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <BottomSheet
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={modalTitle}
      >
        <ExceptionModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onResolved={handleResolved}
        />
      </BottomSheet>
    </>
  )
}
