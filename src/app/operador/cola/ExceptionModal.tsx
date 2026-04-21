'use client'

import { useState } from 'react'
import { AguilaTextarea } from '@/components/aguila'
import {
  resolveClassification,
  approveSolicitation,
  assignCarrier,
  retryEvent,
  escalateEvent,
  resolveCompleteness,
  retrySolicitation,
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
  const [completenessNotes, setCompletenessNotes] = useState('')
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
              background: 'var(--portal-status-red-bg)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <p style={{ fontSize: 'var(--aguila-fs-compact)', fontFamily: 'var(--font-mono)', color: 'var(--portal-status-red-fg)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {event.error_message || 'Sin mensaje de error'}
            </p>
          </div>

          <AguilaTextarea
            label="Nota para el broker"
            value={escalateNote}
            onChange={(e) => setEscalateNote(e.target.value)}
            placeholder="Describe el problema y contexto..."
            rows={3}
          />

          {error && <p style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', margin: 0 }}>{error}</p>}

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
                color: 'var(--portal-fg-1)',
                fontSize: 'var(--aguila-fs-section)',
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
                background: loading ? 'var(--portal-fg-5)' : 'var(--portal-fg-1)',
                border: 'none',
                borderRadius: 12,
                color: 'var(--portal-ink-0)',
                fontSize: 'var(--aguila-fs-section)',
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
            background: 'var(--portal-status-red-bg)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <p style={{ fontSize: 'var(--aguila-fs-compact)', fontFamily: 'var(--font-mono)', color: 'var(--portal-status-red-fg)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {event.error_message || 'Sin mensaje de error'}
          </p>
        </div>

        {event.attempt_count !== null && event.attempt_count > 0 && (
          <p style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-5)', margin: 0, fontFamily: 'var(--font-mono)' }}>
            Intentos: {event.attempt_count}
          </p>
        )}

        {error && <p style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', margin: 0 }}>{error}</p>}

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
              color: 'var(--portal-fg-1)',
              fontSize: 'var(--aguila-fs-section)',
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
              background: loading ? 'var(--portal-fg-5)' : 'var(--portal-fg-1)',
              border: 'none',
              borderRadius: 12,
              color: 'var(--portal-ink-0)',
              fontSize: 'var(--aguila-fs-section)',
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
            <label style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Producto
            </label>
            <p style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-fg-1)', margin: '4px 0 0', lineHeight: 1.5 }}>
              {description}
            </p>
          </div>
        )}

        {suggestedFraccion && (
          <div
            style={{
              background: 'rgba(192,197,206,0.06)',
              border: '1px solid rgba(192,197,206,0.15)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Sugerencia IA
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 'var(--aguila-fs-body-lg)', fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-3)', fontWeight: 700 }}>
                {suggestedFraccion}
              </span>
              {confidence !== undefined && (
                <span style={{ fontSize: 'var(--aguila-fs-compact)', fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-5)' }}>
                  {Math.round(confidence * 100)}%
                </span>
              )}
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="fraccion-input"
            style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)', fontWeight: 600, display: 'block', marginBottom: 6 }}
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
              color: 'var(--portal-fg-1)',
              fontSize: 'var(--aguila-fs-body-lg)',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
        </div>

        {error && <p style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', margin: 0 }}>{error}</p>}

        <button
          onClick={() => handleAction(() => resolveClassification(event.id, fraccion, description))}
          disabled={loading || !fraccion.match(/^\d{4}\.\d{2}\.\d{2}$/)}
          style={{
            minHeight: 60,
            padding: '14px 20px',
            background: loading ? 'var(--portal-fg-5)' : 'var(--portal-fg-1)',
            border: 'none',
            borderRadius: 12,
            color: 'var(--portal-ink-0)',
            fontSize: 'var(--aguila-fs-section)',
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
    const subject = (payload.subject || (payload.email as Record<string, unknown>)?.subject || '') as string
    const body = (payload.body || payload.email_body || (payload.email as Record<string, unknown>)?.html || '') as string
    const solicitedDocs = (payload.solicited_docs || payload.missing_document_types || []) as string[]
    const supplierEmail = (payload.supplier_email || (payload.email as Record<string, unknown>)?.to || '') as string

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {supplierEmail && (
          <div>
            <label style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Destinatario
            </label>
            <p style={{ fontSize: 'var(--aguila-fs-section)', fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-1)', margin: '4px 0 0' }}>
              {supplierEmail}
            </p>
          </div>
        )}

        {subject && (
          <div>
            <label style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Asunto
            </label>
            <p style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-fg-1)', margin: '4px 0 0', fontWeight: 600 }}>
              {subject}
            </p>
          </div>
        )}

        {body ? (
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
            <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {body}
            </p>
          </div>
        ) : solicitedDocs.length > 0 ? (
          <div>
            <label style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>
              Documentos solicitados
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {solicitedDocs.map((doc, i) => (
                <span key={i} style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)', padding: '6px 0' }}>
                  • {doc}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {error && <p style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', margin: 0 }}>{error}</p>}

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
              color: 'var(--portal-fg-1)',
              fontSize: 'var(--aguila-fs-section)',
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
              background: loading ? 'var(--portal-fg-5)' : 'var(--portal-fg-1)',
              border: 'none',
              borderRadius: 12,
              color: 'var(--portal-ink-0)',
              fontSize: 'var(--aguila-fs-section)',
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
            style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)', fontWeight: 600, display: 'block', marginBottom: 6 }}
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
              color: 'var(--portal-fg-1)',
              fontSize: 'var(--aguila-fs-section)',
              outline: 'none',
            }}
          />
        </div>

        {error && <p style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', margin: 0 }}>{error}</p>}

        <button
          onClick={() => handleAction(() => assignCarrier(event.id, carrierName))}
          disabled={loading || !carrierName.trim()}
          style={{
            minHeight: 60,
            padding: '14px 20px',
            background: loading ? 'var(--portal-fg-5)' : 'var(--portal-fg-1)',
            border: 'none',
            borderRadius: 12,
            color: 'var(--portal-ink-0)',
            fontSize: 'var(--aguila-fs-section)',
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

  // ── Document Completeness Check ──
  if (eventType === 'docs.completeness_check') {
    const missingDocs = (payload.missing_docs || payload.missing_critical || payload.missing_required || []) as string[]
    const completeness = payload.completeness_pct as number | undefined

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {missingDocs.length > 0 && (
          <div>
            <label style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>
              Documentos faltantes
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {missingDocs.map((doc, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(251,191,36,0.06)',
                  border: '1px solid rgba(251,191,36,0.15)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)' }}>{doc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {completeness !== undefined && (
          <p style={{ fontSize: 'var(--aguila-fs-compact)', fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-5)', margin: 0 }}>
            Completitud: {completeness}%
          </p>
        )}

        <AguilaTextarea
          label="Notas (opcional)"
          value={completenessNotes}
          onChange={(e) => setCompletenessNotes(e.target.value)}
          placeholder="Observaciones sobre los documentos..."
          rows={2}
        />

        {error && <p style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => handleAction(() => resolveCompleteness(event.id, 'not_required', completenessNotes))}
            disabled={loading}
            style={{
              flex: 1, minHeight: 60, padding: '14px 20px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, color: 'var(--portal-fg-1)', fontSize: 'var(--aguila-fs-section)',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            {loading ? 'Procesando...' : 'No requeridos'}
          </button>
          <button
            onClick={() => handleAction(() => resolveCompleteness(event.id, 'confirmed', completenessNotes))}
            disabled={loading}
            style={{
              flex: 1, minHeight: 60, padding: '14px 20px',
              background: loading ? 'var(--portal-fg-5)' : 'var(--portal-fg-1)',
              border: 'none', borderRadius: 12,
              color: 'var(--portal-ink-0)', fontSize: 'var(--aguila-fs-section)', fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Confirmando...' : 'Documentos recibidos'}
          </button>
        </div>
      </div>
    )
  }

  // ── Solicitation Failed ──
  if (eventType === 'docs.solicitation_failed') {
    const failError = (payload.error || event.error_message || 'Error desconocido') as string

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background: 'var(--portal-status-red-bg)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, padding: 16,
        }}>
          <p style={{ fontSize: 'var(--aguila-fs-compact)', fontFamily: 'var(--font-mono)', color: 'var(--portal-status-red-fg)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {failError}
          </p>
        </div>

        {event.attempt_count !== null && event.attempt_count > 0 && (
          <p style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-5)', margin: 0, fontFamily: 'var(--font-mono)' }}>
            Intentos: {event.attempt_count}
          </p>
        )}

        {error && <p style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => handleAction(() => retrySolicitation(event.id, 'mark_manual'))}
            disabled={loading}
            style={{
              flex: 1, minHeight: 60, padding: '14px 20px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, color: 'var(--portal-fg-1)', fontSize: 'var(--aguila-fs-section)',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Resolver manualmente
          </button>
          <button
            onClick={() => handleAction(() => retrySolicitation(event.id, 'retry'))}
            disabled={loading}
            style={{
              flex: 1, minHeight: 60, padding: '14px 20px',
              background: loading ? 'var(--portal-fg-5)' : 'var(--portal-fg-1)',
              border: 'none', borderRadius: 12,
              color: 'var(--portal-ink-0)', fontSize: 'var(--aguila-fs-section)', fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Reintentando...' : 'Reintentar envío'}
          </button>
        </div>
      </div>
    )
  }

  // ── Fallback: other unhandled types ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Tipo de evento
        </label>
        <p style={{ fontSize: 'var(--aguila-fs-section)', fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-1)', margin: '4px 0 0' }}>
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
          <pre style={{ fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-4)', margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}

      {error && <p style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', margin: 0 }}>{error}</p>}

      <button
        onClick={() => handleAction(() => retryEvent(event.id))}
        disabled={loading}
        style={{
          minHeight: 60,
          padding: '14px 20px',
          background: loading ? 'var(--portal-fg-5)' : 'var(--portal-fg-1)',
          border: 'none',
          borderRadius: 12,
          color: 'var(--portal-ink-0)',
          fontSize: 'var(--aguila-fs-section)',
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? 'Procesando...' : 'Resolver'}
      </button>
    </div>
  )
}
