'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Tags, FolderOpen, Truck, AlertTriangle, Check, SkipForward, ArrowUpRight } from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import { ACCENT_CYAN, BG_CARD, BORDER, GOLD, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, RED, GREEN } from '@/lib/design-system'
import {
  resolveClassification,
  approveSolicitation,
  assignCarrier,
  retryEvent,
  escalateEvent,
} from '@/app/operador/cola/actions'
import type { WorkflowEvent } from '@/app/operador/cola/ExceptionCard'

interface FlowCardProps {
  event: WorkflowEvent | null
  operatorName: string
  onResolved: () => void
}

function getUrgencyColor(createdAt: string): string {
  const ageH = (Date.now() - new Date(createdAt).getTime()) / 3600000
  if (ageH > 6) return RED
  if (ageH > 2) return '#FBBF24'
  return GREEN
}

function getTypeIcon(eventType: string): React.ReactNode {
  if (eventType.startsWith('classify')) return <Tags size={18} />
  if (eventType.startsWith('docs')) return <FolderOpen size={18} />
  if (eventType.startsWith('crossing')) return <Truck size={18} />
  return <AlertTriangle size={18} />
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
  if (status === 'failed' || status === 'dead_letter') return error_message || 'Error en procesamiento automatico'
  if (event_type.startsWith('classify')) {
    const desc = ((payload as Record<string, unknown>)?.description || (payload as Record<string, unknown>)?.product_name || '') as string
    return desc ? `Clasificacion de baja confianza — ${desc.substring(0, 80)}` : 'Clasificacion de baja confianza — requiere revision manual'
  }
  if (event_type === 'docs.completeness_check') return 'Expediente incompleto — faltan documentos'
  if (event_type === 'docs.solicitation_needed') return 'Solicitud de documentos lista para envio'
  if (event_type === 'docs.solicitation_failed') return 'Error al enviar solicitud de documentos'
  if (event_type === 'crossing.dispatch_needs_assignment') return 'Transportista no asignado'
  return error_message || 'Requiere atencion del operador'
}

export function FlowCard({ event, operatorName, onResolved }: FlowCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fraccion, setFraccion] = useState('')
  const [carrierName, setCarrierName] = useState('')

  async function handleAction(action: () => Promise<{ success: boolean; error?: string }>) {
    setLoading(true)
    setError(null)
    const result = await action()
    setLoading(false)
    if (result.success) {
      setFraccion('')
      setCarrierName('')
      onResolved()
    } else {
      setError(result.error || 'Error desconocido')
    }
  }

  async function handleSkip() {
    // Skip just refreshes the queue — the event stays pending
    onResolved()
  }

  async function handleEscalate() {
    if (!event) return
    await handleAction(() => escalateEvent(event.id, 'Escalado por operador desde pantalla principal'))
  }

  return (
    <div style={{
      background: BG_CARD,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid rgba(192,197,206,0.2)`,
      borderRadius: 20,
      padding: 24,
      boxShadow: '0 0 30px rgba(192,197,206,0.12), 0 10px 30px rgba(0,0,0,0.4)',
      flex: 1,
      position: 'relative' as const,
    }}>
      {/* Urgency strip */}
      {event && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 20,
          bottom: 20,
          width: 4,
          borderRadius: 4,
          background: getUrgencyColor(event.created_at),
        }} />
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: ACCENT_CYAN,
        }}>
          Siguiente Tarea
        </span>
      </div>

      {/* Empty state */}
      {!event && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(192,197,206,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Check size={28} color={ACCENT_CYAN} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>
            {operatorName}, cola despejada
          </div>
          <div style={{ fontSize: 12, color: TEXT_MUTED }}>
            Sin excepciones pendientes — buen trabajo
          </div>
        </div>
      )}

      {/* Event content */}
      {event && (
        <>
          {/* Type + company */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ color: ACCENT_CYAN }}>{getTypeIcon(event.event_type)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
              {getTypeLabel(event.event_type)}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,0.06)',
              padding: '3px 8px',
              borderRadius: 6,
              color: TEXT_SECONDARY,
            }}>
              {event.company_id}
            </span>
          </div>

          {/* Trafico link */}
          {event.trigger_id && (
            <div style={{ marginBottom: 8 }}>
              <Link
                href={`/traficos/${event.trigger_id}`}
                style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: ACCENT_CYAN, textDecoration: 'none' }}
              >
                {event.trigger_id}
              </Link>
            </div>
          )}

          {/* Description */}
          <div style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 16, lineHeight: 1.5 }}>
            {getDescription(event)}
          </div>

          {/* Error message for failed items */}
          {(event.status === 'failed' || event.status === 'dead_letter') && event.error_message && (
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 16,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: RED,
              maxHeight: 80,
              overflow: 'auto',
            }}>
              {event.error_message}
            </div>
          )}

          {/* Inline resolution form */}
          <InlineResolver
            event={event}
            fraccion={fraccion}
            setFraccion={setFraccion}
            carrierName={carrierName}
            setCarrierName={setCarrierName}
            loading={loading}
            onAction={handleAction}
          />

          {/* Error feedback */}
          {error && (
            <div style={{ fontSize: 12, color: RED, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
              {error}
            </div>
          )}

          {/* Timestamp */}
          <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
            {fmtDateTime(event.created_at)}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleSkip}
              disabled={loading}
              style={{
                padding: '14px 20px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                background: 'rgba(255,255,255,0.06)',
                color: TEXT_PRIMARY,
                border: `1px solid ${BORDER}`,
                cursor: 'pointer',
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <SkipForward size={16} /> Saltar
            </button>
            <button
              onClick={handleEscalate}
              disabled={loading}
              style={{
                padding: '14px 20px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                background: 'rgba(255,255,255,0.06)',
                color: TEXT_PRIMARY,
                border: `1px solid ${BORDER}`,
                cursor: 'pointer',
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: loading ? 0.5 : 1,
              }}
            >
              <ArrowUpRight size={16} /> Escalar a Admin
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Inline resolution form based on event type
function InlineResolver({
  event,
  fraccion,
  setFraccion,
  carrierName,
  setCarrierName,
  loading,
  onAction,
}: {
  event: WorkflowEvent
  fraccion: string
  setFraccion: (v: string) => void
  carrierName: string
  setCarrierName: (v: string) => void
  loading: boolean
  onAction: (action: () => Promise<{ success: boolean; error?: string }>) => void
}) {
  const isFailed = event.status === 'failed' || event.status === 'dead_letter'
  const payload = (event.payload || {}) as Record<string, unknown>

  // Failed/dead letter: retry
  if (isFailed) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => onAction(() => retryEvent(event.id))}
          disabled={loading}
          style={{
            padding: '14px 28px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            background: `linear-gradient(135deg, ${ACCENT_CYAN}, #64748B)`,
            color: '#0D0D0C',
            border: 'none',
            cursor: 'pointer',
            minHeight: 60,
            width: '100%',
            opacity: loading ? 0.5 : 1,
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  // Classification
  if (event.event_type.startsWith('classify')) {
    const aiSuggestion = (payload.suggested_fraccion || payload.fraccion || '') as string
    const aiConfidence = (payload.confidence || 0) as number
    return (
      <div style={{ marginBottom: 16 }}>
        {aiSuggestion && (
          <div style={{
            background: 'rgba(192,197,206,0.06)',
            border: '1px solid rgba(192,197,206,0.15)',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 2 }}>Sugerencia AI</div>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: ACCENT_CYAN }}>{aiSuggestion}</div>
            </div>
            {aiConfidence > 0 && (
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: TEXT_MUTED }}>{Math.round(aiConfidence * 100)}%</span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={fraccion}
            onChange={(e) => setFraccion(e.target.value)}
            placeholder="XXXX.XX.XX"
            pattern="^\d{4}\.\d{2}\.\d{2}$"
            style={{
              flex: 1,
              padding: '12px 14px',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              color: TEXT_PRIMARY,
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              minHeight: 48,
            }}
          />
          <button
            onClick={() => onAction(() => resolveClassification(event.id, fraccion || aiSuggestion, (payload.description || '') as string))}
            disabled={loading || (!fraccion && !aiSuggestion)}
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: `linear-gradient(135deg, ${ACCENT_CYAN}, #64748B)`,
              color: '#0D0D0C',
              border: 'none',
              cursor: (!fraccion && !aiSuggestion) ? 'not-allowed' : 'pointer',
              minHeight: 48,
              opacity: loading ? 0.5 : 1,
            }}
          >
            Clasificar
          </button>
        </div>
      </div>
    )
  }

  // Solicitation needed
  if (event.event_type === 'docs.solicitation_needed') {
    return (
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => onAction(() => approveSolicitation(event.id))}
          disabled={loading}
          style={{
            padding: '14px 28px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            background: `linear-gradient(135deg, ${ACCENT_CYAN}, #64748B)`,
            color: '#0D0D0C',
            border: 'none',
            cursor: 'pointer',
            minHeight: 60,
            width: '100%',
            opacity: loading ? 0.5 : 1,
          }}
        >
          Aprobar Solicitud
        </button>
      </div>
    )
  }

  // Carrier assignment
  if (event.event_type === 'crossing.dispatch_needs_assignment') {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            placeholder="Nombre del transportista"
            style={{
              flex: 1,
              padding: '12px 14px',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              color: TEXT_PRIMARY,
              fontSize: 13,
              minHeight: 48,
            }}
          />
          <button
            onClick={() => onAction(() => assignCarrier(event.id, carrierName))}
            disabled={loading || !carrierName.trim()}
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: `linear-gradient(135deg, ${ACCENT_CYAN}, #64748B)`,
              color: '#0D0D0C',
              border: 'none',
              cursor: carrierName.trim() ? 'pointer' : 'not-allowed',
              minHeight: 48,
              opacity: loading ? 0.5 : 1,
            }}
          >
            Asignar
          </button>
        </div>
      </div>
    )
  }

  // Fallback: generic resolve
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => onAction(() => retryEvent(event.id))}
        disabled={loading}
        style={{
          padding: '14px 28px',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          background: `linear-gradient(135deg, ${ACCENT_CYAN}, #64748B)`,
          color: '#0D0D0C',
          border: 'none',
          cursor: 'pointer',
          minHeight: 60,
          width: '100%',
          opacity: loading ? 0.5 : 1,
        }}
      >
        Resolver
      </button>
    </div>
  )
}
