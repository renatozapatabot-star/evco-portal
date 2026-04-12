'use client'

import { useState } from 'react'
import {
  resolveClassification,
  approveSolicitation,
  assignCarrier,
  retryEvent,
  escalateEvent,
} from './actions'
import type { WorkflowEvent } from './ExceptionCard'

interface ExceptionModalProps {
  event: WorkflowEvent | null
  onClose: () => void
  onResolved: (eventId: string) => void
}

type ModalView = 'default' | 'escalate'

export function ExceptionModal({ event, onClose, onResolved }: ExceptionModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fraccion, setFraccion] = useState('')
  const [carrierName, setCarrierName] = useState('')
  const [escalateNote, setEscalateNote] = useState('')
  const [view, setView] = useState<ModalView>('default')

  if (!event) return null

  async function handleAction(action: () => Promise<{ success: boolean; error?: string }>) {
    setLoading(true)
    setError(null)
    const result = await action()
    setLoading(false)
    if (result.success) {
      onResolved(event!.id)
    } else {
      setError(result.error || 'Error desconocido')
    }
  }

  const payload = (event.payload || {}) as Record<string, unknown>
  const eventType = event.event_type
  const isFailed = event.status === 'failed' || event.status === 'dead_letter'

  // ── Failed / Dead Letter ──
  if (isFailed) {
    if (view === 'escalate') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#EF4444', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {event.error_message || 'Sin mensaje de error'}
            </p>
          </div>

          <label style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 600 }}>
            Nota para el broker
          </label>
          <textarea
            value={escalateNote}
            onChange={(e) => setEscalateNote(e.target.value)}
            placeholder="Describe el problema y contexto..."
            rows={3}
            style={{
              width: '100%',
              padding: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: '#E6EDF3',
              fontSize: 14,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setView('default')}
              disabled={loading}
              style={{
                flex: 1,
                minHeight: 60,
                padding: '14px 20px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                color: '#E6EDF3',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Volver
            </button>
            <button
              onClick={() => handleAction(() => escalateEvent(event.id, escalateNote))}
              disabled={loading || !escalateNote.trim()}
              style={{
                flex: 1,
                minHeight: 60,
                padding: '14px 20px',
                background: loading ? '#64748b' : '#eab308',
                border: 'none',
                borderRadius: 12,
                color: '#0D0D0C',
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                opacity: !escalateNote.trim() ? 0.5 : 1,
              }}
            >
              {loading ? 'Enviando...' : 'Escalar'}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#EF4444', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {event.error_message || 'Sin mensaje de error'}
          </p>
        </div>

        {event.attempt_count !== null && event.attempt_count > 0 && (
          <p style={{ fontSize: 12, color: '#64748b', margin: 0, fontFamily: 'var(--font-mono)' }}>
            Intentos: {event.attempt_count}
          </p>
        )}

        {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setView('escalate')}
            disabled={loading}
            style={{
              flex: 1,
              minHeight: 60,
              padding: '14px 20px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: '#E6EDF3',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Escalar al Broker
          </button>
          <button
            onClick={() => handleAction(() => retryEvent(event.id))}
            disabled={loading}
            style={{
              flex: 1,
              minHeight: 60,
              padding: '14px 20px',
              background: loading ? '#64748b' : '#eab308',
              border: 'none',
              borderRadius: 12,
              color: '#0D0D0C',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Reintentando...' : 'Reintentar'}
          </button>
        </div>
      </div>
    )
  }

  // ── Classification ──
  if (eventType.startsWith('classify')) {
    const description = (payload.description || payload.product_name || '') as string
    const suggestedFraccion = (payload.suggested_fraccion || '') as string
    const confidence = payload.confidence as number | undefined

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {description && (
          <div>
            <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Producto
            </label>
            <p style={{ fontSize: 14, color: '#E6EDF3', margin: '4px 0 0', lineHeight: 1.5 }}>
              {description}
            </p>
          </div>
        )}

        {suggestedFraccion && (
          <div
            style={{
              background: 'rgba(0,229,255,0.06)',
              border: '1px solid rgba(0,229,255,0.15)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Sugerencia IA
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', color: '#00E5FF', fontWeight: 700 }}>
                {suggestedFraccion}
              </span>
              {confidence !== undefined && (
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                  {Math.round(confidence * 100)}%
                </span>
              )}
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="fraccion-input"
            style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 600, display: 'block', marginBottom: 6 }}
          >
            Fraccion arancelaria
          </label>
          <input
            id="fraccion-input"
            type="text"
            value={fraccion}
            onChange={(e) => setFraccion(e.target.value)}
            placeholder="XXXX.XX.XX"
            pattern="\d{4}\.\d{2}\.\d{2}"
            style={{
              width: '100%',
              padding: 14,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: '#E6EDF3',
              fontSize: 16,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
        </div>

        {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}

        <button
          onClick={() => handleAction(() => resolveClassification(event.id, fraccion, description))}
          disabled={loading || !fraccion.match(/^\d{4}\.\d{2}\.\d{2}$/)}
          style={{
            minHeight: 60,
            padding: '14px 20px',
            background: loading ? '#64748b' : '#eab308',
            border: 'none',
            borderRadius: 12,
            color: '#0D0D0C',
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            opacity: !fraccion.match(/^\d{4}\.\d{2}\.\d{2}$/) ? 0.5 : 1,
          }}
        >
          {loading ? 'Clasificando...' : 'Clasificar'}
        </button>
      </div>
    )
  }

  // ── Solicitation Approval ──
  if (eventType === 'docs.solicitation_needed') {
    const subject = (payload.subject || '') as string
    const body = (payload.body || payload.email_body || '') as string

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {subject && (
          <div>
            <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Asunto
            </label>
            <p style={{ fontSize: 14, color: '#E6EDF3', margin: '4px 0 0', fontWeight: 600 }}>
              {subject}
            </p>
          </div>
        )}

        {body && (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 16,
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {body}
            </p>
          </div>
        )}

        {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              minHeight: 60,
              padding: '14px 20px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: '#E6EDF3',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => handleAction(() => approveSolicitation(event.id))}
            disabled={loading}
            style={{
              flex: 1,
              minHeight: 60,
              padding: '14px 20px',
              background: loading ? '#64748b' : '#eab308',
              border: 'none',
              borderRadius: 12,
              color: '#0D0D0C',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Enviando...' : 'Aprobar y Enviar'}
          </button>
        </div>
      </div>
    )
  }

  // ── Carrier Assignment ──
  if (eventType === 'crossing.dispatch_needs_assignment') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label
            htmlFor="carrier-input"
            style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 600, display: 'block', marginBottom: 6 }}
          >
            Nombre del transportista
          </label>
          <input
            id="carrier-input"
            type="text"
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            placeholder="Ej: Castores, FedEx, Transportes del Norte"
            style={{
              width: '100%',
              padding: 14,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: '#E6EDF3',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}

        <button
          onClick={() => handleAction(() => assignCarrier(event.id, carrierName))}
          disabled={loading || !carrierName.trim()}
          style={{
            minHeight: 60,
            padding: '14px 20px',
            background: loading ? '#64748b' : '#eab308',
            border: 'none',
            borderRadius: 12,
            color: '#0D0D0C',
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            opacity: !carrierName.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Asignando...' : 'Asignar Transportista'}
        </button>
      </div>
    )
  }

  // ── Fallback: docs.completeness_check and other unhandled types ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Tipo de evento
        </label>
        <p style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: '#E6EDF3', margin: '4px 0 0' }}>
          {event.event_type}
        </p>
      </div>

      {payload && Object.keys(payload).length > 0 && (
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 16,
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#94a3b8', margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}

      {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}

      <button
        onClick={() => handleAction(() => retryEvent(event.id))}
        disabled={loading}
        style={{
          minHeight: 60,
          padding: '14px 20px',
          background: loading ? '#64748b' : '#eab308',
          border: 'none',
          borderRadius: 12,
          color: '#0D0D0C',
          fontSize: 14,
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? 'Procesando...' : 'Resolver'}
      </button>
    </div>
  )
}
