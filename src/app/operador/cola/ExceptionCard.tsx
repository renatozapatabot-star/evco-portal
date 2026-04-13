'use client'

import { Tags, FolderOpen, Truck, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { fmtDateTime } from '@/lib/format-utils'
import { SeverityRibbon, type SeverityTone } from '@/components/aguila'

interface WorkflowEvent {
  id: string
  workflow: string
  event_type: string
  trigger_id: string | null
  company_id: string
  payload: Record<string, unknown> | null
  status: 'pending' | 'failed' | 'dead_letter'
  created_at: string
  error_message: string | null
  attempt_count: number | null
}

interface ExceptionCardProps {
  event: WorkflowEvent
  onAction: (event: WorkflowEvent) => void
}

function getUrgencyTone(createdAt: string): SeverityTone {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  if (ageHours > 6) return 'critical'
  if (ageHours > 2) return 'warning'
  return 'healthy'
}

function getUrgencyOrder(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  if (ageHours > 6) return 0
  if (ageHours > 2) return 1
  return 2
}

function getTypeIcon(eventType: string): React.ReactNode {
  if (eventType.startsWith('classify')) return <Tags size={16} />
  if (eventType.startsWith('docs')) return <FolderOpen size={16} />
  if (eventType.startsWith('crossing')) return <Truck size={16} />
  return <AlertTriangle size={16} />
}

function getTypeLabel(eventType: string): string {
  if (eventType.startsWith('classify')) return 'Clasificacion'
  if (eventType.startsWith('docs.completeness')) return 'Documentos'
  if (eventType.startsWith('docs.solicitation_needed')) return 'Solicitud'
  if (eventType.startsWith('docs.solicitation_failed')) return 'Error Solicitud'
  if (eventType.startsWith('crossing')) return 'Despacho'
  return 'Error'
}

function getDescription(event: WorkflowEvent): string {
  const { event_type, payload, error_message, status } = event

  if (status === 'failed' || status === 'dead_letter') {
    return error_message || 'Error en procesamiento automatico'
  }

  if (event_type.startsWith('classify')) {
    const desc = (payload?.description || payload?.product_name || '') as string
    return desc
      ? `Clasificacion de baja confianza — ${desc.substring(0, 80)}`
      : 'Clasificacion de baja confianza — requiere revision manual'
  }

  if (event_type === 'docs.completeness_check') {
    return 'Expediente incompleto — faltan documentos'
  }

  if (event_type === 'docs.solicitation_needed') {
    return 'Solicitud de documentos lista para envio'
  }

  if (event_type === 'docs.solicitation_failed') {
    return 'Error al enviar solicitud de documentos'
  }

  if (event_type === 'crossing.dispatch_needs_assignment') {
    return 'Transportista no asignado'
  }

  return error_message || 'Requiere atencion del operador'
}

function getCTAText(event: WorkflowEvent): string {
  if (event.status === 'failed' || event.status === 'dead_letter') return 'Resolver'
  if (event.event_type.startsWith('classify')) return 'Clasificar'
  if (event.event_type === 'docs.solicitation_needed') return 'Revisar'
  if (event.event_type.startsWith('docs')) return 'Resolver'
  if (event.event_type.startsWith('crossing')) return 'Asignar'
  return 'Resolver'
}

export { getUrgencyOrder }
export type { WorkflowEvent }

export function ExceptionCard({ event, onAction }: ExceptionCardProps) {
  const tone = getUrgencyTone(event.created_at)

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '20px 20px 20px 23px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <SeverityRibbon tone={tone} />

      {/* Content */}
      <div style={{ flex: 1 }}>
        {/* Top row: company badge + type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: '#94a3b8',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '2px 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {event.company_id}
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: '#94a3b8',
            }}
          >
            {getTypeIcon(event.event_type)}
            {getTypeLabel(event.event_type)}
          </span>
        </div>

        {/* Trafico reference */}
        {event.trigger_id && (
          <div style={{ marginBottom: 4 }}>
            <Link
              href={`/embarques/${event.trigger_id}`}
              style={{
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                color: '#C0C5CE',
                textDecoration: 'none',
              }}
            >
              {event.trigger_id}
            </Link>
          </div>
        )}

        {/* Description */}
        <p
          style={{
            fontSize: 13,
            color: '#E6EDF3',
            margin: '0 0 8px',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {getDescription(event)}
        </p>

        {/* Error message for failed events */}
        {event.status === 'failed' && event.error_message && (
          <p
            style={{
              fontSize: 11,
              color: '#EF4444',
              margin: '0 0 8px',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {event.error_message}
          </p>
        )}

        {/* Timestamp */}
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: '#64748b',
          }}
        >
          {fmtDateTime(event.created_at)}
        </span>
      </div>

      {/* CTA button */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => onAction(event)}
          style={{
            minWidth: 100,
            minHeight: 60,
            padding: '12px 16px',
            background: '#E8EAED',
            color: '#0D0D0C',
            border: 'none',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#ca8a04' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#E8EAED' }}
        >
          {getCTAText(event)}
        </button>
      </div>
    </div>
  )
}
