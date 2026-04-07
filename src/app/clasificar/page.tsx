'use client'

import { useState, useEffect, useCallback } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClassificationDecision {
  id: string
  decision: string
  confidence: number
  payload: {
    product_description?: string
    suggested_fraccion?: string
    supplier?: string
    value_usd?: number
    precedent_count?: number
    tmec_eligible?: boolean
    igi_rate?: number
    alternatives?: { fraccion: string; description: string; confidence: number }[]
  }
  created_at: string
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchDecisions(): Promise<ClassificationDecision[]> {
  const res = await fetch('/api/clasificar')
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}

async function postVote(decisionId: string, action: 'confirm' | 'correct', correctedTo?: string) {
  const res = await fetch('/api/clasificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision_id: decisionId, action, corrected_to: correctedTo }),
  })
  return res.ok
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 85 ? '#16A34A' : pct >= 70 ? '#D4952A' : '#DC2626'
  const bg = pct >= 85 ? '#F0FDF4' : pct >= 70 ? '#FFFBEB' : '#FEF2F2'
  return (
    <span
      className="font-mono"
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        color,
        background: bg,
      }}
    >
      {pct}%
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ClasificarPage() {
  const [decisions, setDecisions] = useState<ClassificationDecision[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [showCorrection, setShowCorrection] = useState(false)
  const [selectedAlt, setSelectedAlt] = useState<string | null>(null)
  const [stats, setStats] = useState({ confirmed: 0, corrected: 0 })

  useEffect(() => {
    fetchDecisions().then(d => {
      setDecisions(d)
      setLoading(false)
    })
  }, [])

  const current = decisions[currentIndex] || null
  const remaining = decisions.length - currentIndex
  const total = decisions.length

  const handleVote = useCallback(async (action: 'confirm' | 'correct', correctedTo?: string) => {
    if (!current || voting) return
    setVoting(true)

    await postVote(current.id, action, correctedTo)

    setStats(prev => ({
      confirmed: prev.confirmed + (action === 'confirm' ? 1 : 0),
      corrected: prev.corrected + (action === 'correct' ? 1 : 0),
    }))

    setShowCorrection(false)
    setSelectedAlt(null)
    setCurrentIndex(prev => prev + 1)
    setVoting(false)
  }, [current, voting])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (showCorrection) return // Don't shortcut while correcting
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        handleVote('confirm')
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setShowCorrection(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleVote, showCorrection])

  if (loading) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px' }}>
        <div className="card" style={{ height: 400, opacity: 0.5 }} />
      </div>
    )
  }

  if (total === 0) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px' }}>
        <EmptyState
          icon="&#9989;"
          title="Clasificaciones al día"
          description="No hay clasificaciones pendientes de revisión. CRUZ aprende con cada voto."
        />
      </div>
    )
  }

  // All done
  if (!current) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#127881;</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#1A1A1A' }}>
          ¡Listo!
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 16, color: '#6B6B6B' }}>
          {stats.confirmed + stats.corrected} clasificaciones revisadas
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
          <div>
            <span className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: '#16A34A' }}>
              {stats.confirmed}
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B6B6B' }}>Confirmadas</p>
          </div>
          <div>
            <span className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: '#D4952A' }}>
              {stats.corrected}
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B6B6B' }}>Corregidas</p>
          </div>
        </div>
      </div>
    )
  }

  const p = current.payload || {}

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1A1A1A' }}>Clasificar</h1>
        <span className="font-mono" style={{ fontSize: 14, color: '#9B9B9B' }}>
          {currentIndex + 1} de {total}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#E8E5E0', borderRadius: 2, marginBottom: 24 }}>
        <div
          style={{
            height: '100%',
            width: `${(currentIndex / total) * 100}%`,
            background: '#C9A84C',
            borderRadius: 2,
            transition: 'width 300ms ease',
          }}
        />
      </div>

      {/* Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          animation: 'cardSlideIn 200ms ease-out',
        }}
        key={current.id}
      >
        {/* Product description */}
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#9B9B9B', fontWeight: 500 }}>Producto</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.3 }}>
            {p.product_description || current.decision}
          </p>
        </div>

        {/* Supplier + Value row */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {p.supplier && (
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 12, color: '#9B9B9B' }}>Proveedor</p>
              <p style={{ margin: 0, fontSize: 14, color: '#1A1A1A' }}>{p.supplier}</p>
            </div>
          )}
          {p.value_usd != null && (
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 12, color: '#9B9B9B' }}>Valor</p>
              <p className="font-mono" style={{ margin: 0, fontSize: 14, color: '#1A1A1A' }}>
                ${p.value_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#E8E5E0' }} />

        {/* CRUZ suggestion */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#9B9B9B', fontWeight: 500 }}>CRUZ sugiere</p>
            <ConfidenceBadge value={current.confidence} />
          </div>
          <p className="font-mono" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#1A1A1A' }}>
            {p.suggested_fraccion || 'N/A'}
          </p>
          {p.precedent_count != null && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B6B6B' }}>
              Basado en {p.precedent_count} precedente{p.precedent_count !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* T-MEC badge */}
        {p.tmec_eligible != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              color: p.tmec_eligible ? '#16A34A' : '#DC2626',
              background: p.tmec_eligible ? '#F0FDF4' : '#FEF2F2',
            }}>
              T-MEC: {p.tmec_eligible ? '✅ IGI 0%' : `❌ IGI ${(p.igi_rate || 0) * 100}%`}
            </span>
          </div>
        )}

        {/* Alternative (show top 1) */}
        {p.alternatives && p.alternatives.length > 0 && !showCorrection && (
          <div style={{ background: '#FAFAF8', borderRadius: 8, padding: 12 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#9B9B9B' }}>Alternativa</p>
            <span className="font-mono" style={{ fontSize: 16, color: '#6B6B6B' }}>
              {p.alternatives[0].fraccion}
            </span>
            <span style={{ fontSize: 13, color: '#9B9B9B', marginLeft: 8 }}>
              ({Math.round(p.alternatives[0].confidence * 100)}%)
            </span>
          </div>
        )}

        {/* Correction panel */}
        {showCorrection && (
          <div style={{ background: '#FAFAF8', borderRadius: 8, padding: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
              Seleccionar fracción correcta
            </p>
            {(p.alternatives || []).map(alt => (
              <label
                key={alt.fraccion}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 8,
                  cursor: 'pointer',
                  background: selectedAlt === alt.fraccion ? '#FFF7E0' : '#FFFFFF',
                  border: selectedAlt === alt.fraccion ? '2px solid #C9A84C' : '1px solid #E8E5E0',
                  transition: 'all 150ms',
                }}
              >
                <input
                  type="radio"
                  name="correction"
                  value={alt.fraccion}
                  checked={selectedAlt === alt.fraccion}
                  onChange={() => setSelectedAlt(alt.fraccion)}
                  style={{ accentColor: '#C9A84C' }}
                />
                <span className="font-mono" style={{ fontSize: 16, fontWeight: 600 }}>{alt.fraccion}</span>
                <span style={{ fontSize: 13, color: '#6B6B6B', flex: 1 }}>{alt.description}</span>
                <span className="font-mono" style={{ fontSize: 13, color: '#9B9B9B' }}>
                  {Math.round(alt.confidence * 100)}%
                </span>
              </label>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button
                onClick={() => { setShowCorrection(false); setSelectedAlt(null) }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: '#F5F4F0',
                  color: '#6B6B6B',
                  border: 'none',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => selectedAlt && handleVote('correct', selectedAlt)}
                disabled={!selectedAlt || voting}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: selectedAlt ? '#C9A84C' : '#E8E5E0',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: selectedAlt ? 'pointer' : 'not-allowed',
                }}
              >
                Guardar corrección
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!showCorrection && (
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <button
              onClick={() => setShowCorrection(true)}
              disabled={voting}
              style={{
                flex: 1,
                minHeight: 60,
                borderRadius: 12,
                background: '#F5F4F0',
                color: '#1A1A1A',
                border: '1px solid #E8E5E0',
                fontSize: 18,
                fontWeight: 600,
                cursor: voting ? 'wait' : 'pointer',
                transition: 'background 150ms',
              }}
            >
              ✗ NO
            </button>
            <button
              onClick={() => handleVote('confirm')}
              disabled={voting}
              style={{
                flex: 2,
                minHeight: 60,
                borderRadius: 12,
                background: '#C9A84C',
                color: '#FFFFFF',
                border: 'none',
                fontSize: 18,
                fontWeight: 600,
                cursor: voting ? 'wait' : 'pointer',
                transition: 'background 150ms',
              }}
              onMouseOver={(e) => { if (!voting) e.currentTarget.style.background = '#B8933B' }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#C9A84C' }}
            >
              ✓ SÍ APROBAR
            </button>
          </div>
        )}

        {/* Keyboard hint */}
        {!showCorrection && (
          <p style={{ margin: 0, textAlign: 'center', fontSize: 12, color: '#9B9B9B' }}>
            ← rechazar · → aprobar
          </p>
        )}
      </div>

      {/* Stats footer */}
      {(stats.confirmed + stats.corrected) > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 24 }}>
          <span style={{ fontSize: 13, color: '#16A34A' }}>✓ {stats.confirmed}</span>
          <span style={{ fontSize: 13, color: '#D4952A' }}>✗ {stats.corrected}</span>
        </div>
      )}

      <style>{`
        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
