'use client'

import { useState, useEffect, useCallback } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'

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

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 85 ? 'var(--portal-status-green-fg)' : pct >= 70 ? 'var(--portal-status-amber-fg)' : 'var(--portal-status-red-fg)'
  const bg = pct >= 85 ? 'var(--portal-status-green-bg)' : pct >= 70 ? 'rgba(192,197,206,0.08)' : 'var(--portal-status-red-bg)'
  return (
    <span
      className="font-mono"
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 'var(--aguila-fs-body)',
        fontWeight: 600,
        color,
        background: bg,
      }}
    >
      {pct}%
    </span>
  )
}

export function PendientesTab() {
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (showCorrection) return
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

  if (!current) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--aguila-fs-kpi-hero)', marginBottom: 16 }}>&#127881;</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 'var(--aguila-fs-title)', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
          ¡Listo!
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 'var(--aguila-fs-body-lg)', color: 'var(--portal-fg-5)' }}>
          {stats.confirmed + stats.corrected} clasificaciones revisadas
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
          <div>
            <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 700, color: 'var(--portal-status-green-fg)' }}>
              {stats.confirmed}
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)' }}>Confirmadas</p>
          </div>
          <div>
            <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 700, color: 'var(--portal-status-amber-fg)' }}>
              {stats.corrected}
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)' }}>Corregidas</p>
          </div>
        </div>
      </div>
    )
  }

  const p = current.payload || {}

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-fg-4)' }}>
          {currentIndex + 1} de {total}
        </span>
      </div>

      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 24 }}>
        <div
          style={{
            height: '100%',
            width: `${(currentIndex / total) * 100}%`,
            background: 'var(--portal-fg-1)',
            borderRadius: 2,
            transition: 'width 300ms ease',
          }}
        />
      </div>

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
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', fontWeight: 500 }}>Producto</p>
          <p style={{ margin: 0, fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: 'rgba(255,255,255,0.92)', lineHeight: 1.3 }}>
            {p.product_description || current.decision}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {p.supplier && (
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)' }}>Proveedor</p>
              <p style={{ margin: 0, fontSize: 'var(--aguila-fs-section)', color: 'rgba(255,255,255,0.92)' }}>{p.supplier}</p>
            </div>
          )}
          {p.value_usd != null && (
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)' }}>Valor</p>
              <p className="font-mono" style={{ margin: 0, fontSize: 'var(--aguila-fs-section)', color: 'rgba(255,255,255,0.92)' }}>
                ${p.value_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </p>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', fontWeight: 500 }}>CRUZ sugiere</p>
            <ConfidenceBadge value={current.confidence} />
          </div>
          <p className="font-mono" style={{ margin: 0, fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
            {p.suggested_fraccion || 'N/A'}
          </p>
          {p.precedent_count != null && (
            <p style={{ margin: '4px 0 0', fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)' }}>
              Basado en {p.precedent_count} precedente{p.precedent_count !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {p.tmec_eligible != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: 'var(--aguila-fs-body)',
              fontWeight: 600,
              color: p.tmec_eligible ? 'var(--portal-status-green-fg)' : 'var(--portal-status-red-fg)',
              background: p.tmec_eligible ? 'var(--portal-status-green-bg)' : 'var(--portal-status-red-bg)',
            }}>
              T-MEC: {p.tmec_eligible ? '✓ IGI 0%' : `✗ IGI ${(p.igi_rate || 0) * 100}%`}
            </span>
          </div>
        )}

        {p.alternatives && p.alternatives.length > 0 && !showCorrection && (
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 }}>
            <p style={{ margin: '0 0 4px', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)' }}>Alternativa</p>
            <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body-lg)', color: 'rgba(255,255,255,0.85)' }}>
              {p.alternatives[0].fraccion}
            </span>
            <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', marginLeft: 8 }}>
              ({Math.round(p.alternatives[0].confidence * 100)}%)
            </span>
          </div>
        )}

        {showCorrection && (
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
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
                  background: selectedAlt === alt.fraccion ? 'rgba(192,197,206,0.18)' : 'rgba(255,255,255,0.04)',
                  border: selectedAlt === alt.fraccion ? '2px solid #eab308' : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 150ms',
                  color: 'rgba(255,255,255,0.92)',
                }}
              >
                <input
                  type="radio"
                  name="correction"
                  value={alt.fraccion}
                  checked={selectedAlt === alt.fraccion}
                  onChange={() => setSelectedAlt(alt.fraccion)}
                  style={{ accentColor: 'var(--portal-fg-1)' }}
                />
                <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600 }}>{alt.fraccion}</span>
                <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.7)', flex: 1 }}>{alt.description}</span>
                <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)' }}>
                  {Math.round(alt.confidence * 100)}%
                </span>
              </label>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button
                onClick={() => { setShowCorrection(false); setSelectedAlt(null) }}
                style={{
                  flex: 1,
                  minHeight: 60,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontSize: 'var(--aguila-fs-section)',
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
                  minHeight: 60,
                  borderRadius: 12,
                  background: selectedAlt ? 'var(--portal-gold-500)' : 'rgba(255,255,255,0.12)',
                  color: 'var(--portal-ink-0)',
                  border: 'none',
                  fontSize: 'var(--aguila-fs-section)',
                  fontWeight: 600,
                  cursor: selectedAlt ? 'pointer' : 'not-allowed',
                }}
              >
                Guardar corrección
              </button>
            </div>
          </div>
        )}

        {!showCorrection && (
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <button
              onClick={() => setShowCorrection(true)}
              disabled={voting}
              style={{
                flex: 1,
                minHeight: 60,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.92)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontSize: 'var(--aguila-fs-kpi-small)',
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
                background: 'var(--portal-gold-500)',
                color: 'var(--portal-ink-0)',
                border: 'none',
                fontSize: 'var(--aguila-fs-kpi-small)',
                fontWeight: 700,
                cursor: voting ? 'wait' : 'pointer',
                transition: 'background 150ms',
              }}
            >
              ✓ SÍ APROBAR
            </button>
          </div>
        )}

        {!showCorrection && (
          <p style={{ margin: 0, textAlign: 'center', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)' }}>
            ← rechazar · → aprobar
          </p>
        )}
      </div>

      {(stats.confirmed + stats.corrected) > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 24 }}>
          <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-status-green-fg)' }}>✓ {stats.confirmed}</span>
          <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-status-amber-fg)' }}>✗ {stats.corrected}</span>
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
