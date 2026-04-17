'use client'

import { useState } from 'react'
import type { ClasificacionDetail } from '@/lib/launchpad-actions'

interface Props {
  detail: ClasificacionDetail
  onComplete: (actionType: string, payload?: Record<string, string>) => void
  loading: boolean
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 85 ? '#16A34A' : value >= 70 ? '#D4952A' : '#DC2626'
  const bg = value >= 85 ? 'rgba(34,197,94,0.1)' : value >= 70 ? 'rgba(192,197,206,0.08)' : 'rgba(239,68,68,0.1)'
  return (
    <span
      className="font-mono"
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 'var(--aguila-fs-body)',
        fontWeight: 600,
        color,
        background: bg,
      }}
    >
      {value}%
    </span>
  )
}

export function ClasificacionPanel({ detail, onComplete, loading }: Props) {
  const [correcting, setCorrecting] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const handleConfirm = () => {
    onComplete('confirm')
  }

  const handleCorrect = () => {
    if (!selected) return
    onComplete('correct', { corrected_to: selected })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Document info */}
      {detail.filename && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 'var(--aguila-fs-section)',
            color: '#6B6B6B',
          }}
        >
          <span style={{ fontSize: 'var(--aguila-fs-kpi-small)' }}>&#128196;</span>
          <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)' }}>
            {detail.filename}
          </span>
        </div>
      )}

      {/* PORTAL suggestion */}
      <div
        style={{
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: 16,
          border: '1px solid #E8E5E0',
        }}
      >
        <div style={{ fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, color: '#9B9B9B', marginBottom: 8, textTransform: 'uppercase' }}>
          PORTAL sugiere
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: '#1A1A1A' }}>
            {detail.suggested_classification}
          </span>
          <ConfidenceBadge value={detail.confidence} />
        </div>
        <p style={{ margin: 0, fontSize: 'var(--aguila-fs-section)', color: '#6B6B6B' }}>
          {detail.product_description}
        </p>
      </div>

      {/* Alternatives (shown when correcting) */}
      {correcting && detail.alternatives.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: '#6B6B6B' }}>
            Alternativas:
          </div>
          {detail.alternatives.map((alt) => (
            <label
              key={alt.fraccion}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${selected === alt.fraccion ? '#E8EAED' : '#E8E5E0'}`,
                background: selected === alt.fraccion ? 'rgba(192,197,206,0.08)' : 'rgba(255,255,255,0.045)',
                cursor: 'pointer',
                minHeight: 48,
              }}
            >
              <input
                type="radio"
                name="alt-fraccion"
                value={alt.fraccion}
                checked={selected === alt.fraccion}
                onChange={() => setSelected(alt.fraccion)}
                style={{ accentColor: '#E8EAED' }}
              />
              <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600 }}>
                {alt.fraccion}
              </span>
              <span style={{ fontSize: 'var(--aguila-fs-body)', color: '#6B6B6B', flex: 1 }}>
                {alt.description}
              </span>
              <ConfidenceBadge value={alt.confidence} />
            </label>
          ))}
        </div>
      )}

      {correcting && detail.alternatives.length === 0 && (
        <p style={{ fontSize: 'var(--aguila-fs-section)', color: '#9B9B9B', fontStyle: 'italic' }}>
          Sin alternativas disponibles. Ingrese la fracción correcta manualmente en la página de clasificación.
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {!correcting ? (
          <>
            <button
              onClick={handleConfirm}
              disabled={loading}
              style={{
                flex: 1,
                minHeight: 60,
                borderRadius: 12,
                background: '#E8EAED',
                color: 'rgba(255,255,255,0.045)',
                border: 'none',
                fontSize: 'var(--aguila-fs-body-lg)',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              &#10003; Confirmar
            </button>
            <button
              onClick={() => setCorrecting(true)}
              disabled={loading}
              style={{
                flex: 1,
                minHeight: 60,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.045)',
                color: '#1A1A1A',
                border: '1px solid #E8E5E0',
                fontSize: 'var(--aguila-fs-body-lg)',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              &#10007; Corregir
            </button>
          </>
        ) : (
          <button
            onClick={handleCorrect}
            disabled={loading || !selected}
            style={{
              flex: 1,
              minHeight: 60,
              borderRadius: 12,
              background: selected ? '#E8EAED' : '#E8E5E0',
              color: selected ? '#FFFFFF' : '#9B9B9B',
              border: 'none',
              fontSize: 'var(--aguila-fs-body-lg)',
              fontWeight: 600,
              cursor: loading || !selected ? 'default' : 'pointer',
            }}
          >
            Guardar corrección
          </button>
        )}
      </div>
    </div>
  )
}
