'use client'

import { useState } from 'react'
import { playSound } from '@/lib/sounds'
import { haptic } from '@/hooks/use-haptic'
import type { SurfaceProposal } from '@/lib/proposals/getProposal'

interface Props {
  proposal: SurfaceProposal | null
  subjectLabel: string
  onApprove?: () => Promise<{ ok: boolean } | void>
  onReject?: (reason: string, note?: string) => Promise<void>
  approveLabel?: string
}

/**
 * Hero-sized proposal section for detail pages.
 * Renders at the TOP of the page, above all data.
 * Full reasoning, confidence bar, alternatives, one-tap approve.
 */
export function AduanaProposalSection({ proposal, subjectLabel, onApprove, onReject, approveLabel }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'approved' | 'rejected'>('idle')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  if (!proposal) {
    return (
      <div style={{
        background: '#1A1A1A', borderRadius: 14, padding: '16px 20px',
        border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6E7681', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#6E7681' }}>
          ADUANA está analizando {subjectLabel}...
        </span>
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div style={{
        background: 'rgba(22,163,74,0.06)', borderRadius: 14, padding: '20px 24px',
        border: '1px solid rgba(22,163,74,0.2)', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, color: '#16A34A' }}>✓</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#16A34A' }}>Aprobado — CRUZ avanza</span>
        </div>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div style={{
        background: 'rgba(220,38,38,0.06)', borderRadius: 14, padding: '20px 24px',
        border: '1px solid rgba(220,38,38,0.2)', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#DC2626' }}>Rechazado — CRUZ aprende de esto</span>
        </div>
      </div>
    )
  }

  const confidenceColor = proposal.confidence >= 0.90 ? '#16A34A'
    : proposal.confidence >= 0.75 ? '#C9A84C'
    : '#D97706'
  const confidencePct = Math.round(proposal.confidence * 100)

  const handleApprove = async () => {
    setStatus('loading')
    try {
      await onApprove?.()
      playSound('achievement')
      haptic.celebrate()
      setStatus('approved')
    } catch {
      setStatus('idle')
    }
  }

  const handleReject = async (reason: string) => {
    setStatus('loading')
    try {
      await onReject?.(reason, rejectNote || undefined)
      setStatus('rejected')
      setShowRejectModal(false)
    } catch {
      setStatus('idle')
    }
  }

  return (
    <>
      <div style={{
        background: '#222222', borderRadius: 14, padding: '24px',
        border: `1px solid ${proposal.confidence >= 0.85 ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderTop: `3px solid ${confidenceColor}`,
        marginBottom: 16,
      }}>
        {/* Header */}
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: '#C9A84C', marginBottom: 12,
        }}>
          CRUZ propone
        </div>

        {/* Proposal headline */}
        <div style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.4, marginBottom: 12 }}>
          {proposal.proposal_label_es}
        </div>

        {/* Confidence bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${confidencePct}%`, height: '100%', borderRadius: 3,
              background: confidenceColor, transition: 'width 500ms ease',
            }} />
          </div>
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: confidenceColor, flexShrink: 0 }}>
            {confidencePct}%
          </span>
          <span style={{ fontSize: 11, color: '#6E7681', flexShrink: 0 }}>
            {proposal.confidence_source === 'rule' ? 'basado en reglas' : proposal.confidence_source === 'llm' ? 'basado en IA' : 'híbrido'}
          </span>
        </div>

        {/* Reasoning bullets */}
        {proposal.reasoning_bullets && proposal.reasoning_bullets.length > 0 && (
          <div style={{ marginBottom: 16, paddingLeft: 12, borderLeft: '2px solid rgba(201,168,76,0.2)' }}>
            {proposal.reasoning_bullets.map((b: { text: string }, i: number) => (
              <div key={i} style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.6, marginBottom: 4 }}>
                {b.text}
              </div>
            ))}
          </div>
        )}

        {/* Alternatives */}
        {proposal.alternatives && proposal.alternatives.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6E7681', marginBottom: 6 }}>
              Alternativas consideradas
            </div>
            {proposal.alternatives.map((alt: { action: string; label_es: string; confidence: number }, i: number) => (
              <div key={i} style={{ fontSize: 12, color: '#6E7681', marginBottom: 2 }}>
                · {alt.label_es} ({Math.round(alt.confidence * 100)}%)
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleApprove}
            disabled={status === 'loading'}
            style={{
              flex: 1, minWidth: 140, padding: '14px 24px', borderRadius: 10,
              background: '#C9A84C', color: '#111', fontSize: 15, fontWeight: 700,
              border: 'none', cursor: status === 'loading' ? 'wait' : 'pointer',
              minHeight: 60, opacity: status === 'loading' ? 0.6 : 1,
            }}
          >
            {status === 'loading' ? 'Procesando...' : (approveLabel || 'Aprobar') + ' →'}
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            style={{
              padding: '14px 20px', borderRadius: 10,
              background: 'transparent', color: '#8B949E', fontSize: 13, fontWeight: 600,
              border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', minHeight: 60,
            }}
          >
            Rechazar
          </button>
        </div>
      </div>

      {/* Rejection modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={() => setShowRejectModal(false)}>
          <div style={{
            background: '#1A1A1A', borderRadius: 16, padding: 24,
            maxWidth: 400, width: '100%', border: '1px solid rgba(255,255,255,0.08)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#E6EDF3', marginBottom: 16 }}>
              ¿Por qué no?
            </div>
            {[
              { key: 'wrong_facts', label: 'Los datos están mal' },
              { key: 'wrong_reasoning', label: 'El razonamiento está mal' },
              { key: 'case_different', label: 'Este caso es diferente' },
            ].map(opt => (
              <button key={opt.key} onClick={() => handleReject(opt.key)} style={{
                display: 'block', width: '100%', padding: '12px 16px', marginBottom: 8,
                borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', color: '#E6EDF3',
                fontSize: 14, textAlign: 'left', cursor: 'pointer', minHeight: 48,
              }}>
                {opt.label}
              </button>
            ))}
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Nota adicional (opcional)"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, marginTop: 8,
                background: '#222', border: '1px solid rgba(255,255,255,0.08)',
                color: '#E6EDF3', fontSize: 13, resize: 'vertical', minHeight: 60,
                boxSizing: 'border-box',
              }}
            />
            <button onClick={() => setShowRejectModal(false)} style={{
              display: 'block', width: '100%', padding: '10px', marginTop: 8,
              background: 'none', border: 'none', color: '#6E7681', fontSize: 13,
              cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
