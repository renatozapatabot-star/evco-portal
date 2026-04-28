'use client'

import { useState } from 'react'
import {
  Search, Package, Globe, Layers, Target, DollarSign,
  CheckCircle, AlertTriangle, XCircle, Loader2, Send,
} from 'lucide-react'
import { csrfFetch } from '@/lib/client-config'

// ── Types ──────────────────────────────────────────────────

interface ClassifyPayload {
  description: string
  country: string
  material: string
  use: string
  value: number | null
}

interface ClassifyResult {
  fraccion: string
  confidence: number
  tmec_eligible: boolean
  description: string
  notes: string
}

type FormState = 'idle' | 'loading' | 'success' | 'error'

// ── Glass card style ───────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '12px 16px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  color: 'var(--portal-fg-1)',
  fontSize: 'var(--aguila-fs-section)',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--aguila-fs-compact)',
  fontWeight: 600,
  color: 'var(--portal-fg-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

// ── Confidence color helper ────────────────────────────────

function confidenceColor(pct: number): string {
  if (pct >= 85) return 'var(--portal-status-green-fg)'
  if (pct >= 70) return 'var(--portal-status-amber-fg)'
  return 'var(--portal-status-red-fg)'
}

function confidenceLabel(pct: number): string {
  if (pct >= 85) return 'Alta'
  if (pct >= 70) return 'Media'
  return 'Baja'
}

// ── Component ──────────────────────────────────────────────

export function SelfClassify() {
  const [form, setForm] = useState<ClassifyPayload>({
    description: '',
    country: '',
    material: '',
    use: '',
    value: null,
  })
  const [state, setState] = useState<FormState>('idle')
  const [result, setResult] = useState<ClassifyResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const canSubmit = form.description.trim().length > 5

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setState('loading')
    setResult(null)
    setErrorMsg('')

    try {
      const res = await csrfFetch('/api/clasificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Error del servidor' }))
        throw new Error(body.error || `Error ${res.status}`)
      }

      const data: ClassifyResult = await res.json()
      setResult(data)
      setState('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado')
      setState('error')
    }
  }

  function handleReset() {
    setForm({ description: '', country: '', material: '', use: '', value: null })
    setState('idle')
    setResult(null)
    setErrorMsg('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search size={18} color="var(--portal-fg-3)" />
        <span style={{
          fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: 'var(--portal-fg-3)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Clasificar Producto
        </span>
      </div>

      {/* ── Form Card ── */}
      <form onSubmit={handleSubmit} style={glassCard}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Descripcion */}
          <div>
            <label style={labelStyle}>
              <Package size={14} color="var(--portal-fg-4)" />
              Descripción del producto *
            </label>
            <textarea
              required
              minLength={6}
              rows={3}
              placeholder="Ej: Resina de polietileno de alta densidad, pellets, grado inyección"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            />
          </div>

          {/* Two-column grid for smaller fields */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}>
            {/* Pais de origen */}
            <div>
              <label style={labelStyle}>
                <Globe size={14} color="var(--portal-fg-4)" />
                País de origen
              </label>
              <input
                type="text"
                placeholder="Ej: Estados Unidos"
                value={form.country}
                onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Material */}
            <div>
              <label style={labelStyle}>
                <Layers size={14} color="var(--portal-fg-4)" />
                Composición / Material
              </label>
              <input
                type="text"
                placeholder="Ej: Polietileno HDPE"
                value={form.material}
                onChange={(e) => setForm(f => ({ ...f, material: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Uso previsto */}
            <div>
              <label style={labelStyle}>
                <Target size={14} color="var(--portal-fg-4)" />
                Uso previsto
              </label>
              <input
                type="text"
                placeholder="Ej: Fabricación de contenedores industriales"
                value={form.use}
                onChange={(e) => setForm(f => ({ ...f, use: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Valor unitario */}
            <div>
              <label style={labelStyle}>
                <DollarSign size={14} color="var(--portal-fg-4)" />
                Valor unitario estimado USD
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={form.value ?? ''}
                onChange={(e) => setForm(f => ({
                  ...f,
                  value: e.target.value ? parseFloat(e.target.value) : null,
                }))}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!canSubmit || state === 'loading'}
            style={{
              minHeight: 60,
              padding: '16px 32px',
              borderRadius: 14,
              border: 'none',
              background: canSubmit && state !== 'loading' ? 'var(--portal-fg-1)' : 'rgba(255,255,255,0.06)',
              color: canSubmit && state !== 'loading' ? '#000' : 'var(--portal-fg-5)',
              fontSize: 15,
              fontWeight: 700,
              cursor: canSubmit && state !== 'loading' ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              width: '100%',
            }}
          >
            {state === 'loading' ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                Clasificando...
              </>
            ) : (
              <>
                <Search size={18} />
                Clasificar con IA
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Error state ── */}
      {state === 'error' && (
        <div style={{
          ...glassCard,
          borderColor: 'var(--portal-status-red-ring)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <XCircle size={20} color="var(--portal-status-red-fg)" />
          <div>
            <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--portal-status-red-fg)' }}>
              Error en clasificación
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', marginTop: 4 }}>
              {errorMsg}
            </div>
          </div>
        </div>
      )}

      {/* ── Result card ── */}
      {state === 'success' && result && (
        <div style={{
          ...glassCard,
          borderColor: 'rgba(192,197,206,0.2)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 25px -8px rgba(192,197,206,0.15)',
        }}>
          <div style={{
            fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, color: 'var(--portal-fg-3)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: 16,
          }}>
            Resultado de Clasificación
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Fraccion */}
            <div>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', fontWeight: 600, marginBottom: 4 }}>
                Fracción sugerida
              </div>
              <div style={{
                fontSize: 'var(--aguila-fs-kpi-mid)',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--portal-fg-3)',
                letterSpacing: '0.04em',
              }}>
                {result.fraccion}
              </div>
              {result.description && (
                <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', marginTop: 4 }}>
                  {result.description}
                </div>
              )}
            </div>

            {/* Confidence + T-MEC row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
            }}>
              {/* Confianza */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 12,
                padding: 16,
              }}>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', fontWeight: 600, marginBottom: 6 }}>
                  Confianza
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 'var(--aguila-fs-title)',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: confidenceColor(result.confidence),
                  }}>
                    {result.confidence}%
                  </span>
                  <span style={{
                    fontSize: 'var(--aguila-fs-meta)',
                    fontWeight: 600,
                    color: confidenceColor(result.confidence),
                    textTransform: 'uppercase',
                  }}>
                    {confidenceLabel(result.confidence)}
                  </span>
                </div>
                {/* Confidence bar */}
                <div style={{
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.06)',
                  marginTop: 8,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${result.confidence}%`,
                    background: confidenceColor(result.confidence),
                    borderRadius: 2,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>

              {/* T-MEC */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 12,
                padding: 16,
              }}>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', fontWeight: 600, marginBottom: 6 }}>
                  T-MEC elegible
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {result.tmec_eligible ? (
                    <>
                      <CheckCircle size={22} color="var(--portal-status-green-fg)" />
                      <span style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: 'var(--portal-status-green-fg)' }}>
                        Sí
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle size={22} color="var(--portal-status-red-fg)" />
                      <span style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: 'var(--portal-status-red-fg)' }}>
                        No
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {result.notes && (
              <div style={{
                fontSize: 'var(--aguila-fs-body)',
                color: 'var(--portal-fg-4)',
                lineHeight: 1.5,
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: 12,
              }}>
                {result.notes}
              </div>
            )}

            {/* Actions row */}
            <div style={{
              display: 'flex', gap: 12, flexWrap: 'wrap',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: 16,
            }}>
              <button
                type="button"
                onClick={() => {
                  // Formal classification request — future endpoint
                }}
                style={{
                  minHeight: 60,
                  padding: '14px 28px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'var(--portal-fg-1)',
                  color: '#000',
                  fontSize: 'var(--aguila-fs-section)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  justifyContent: 'center',
                }}
              >
                <Send size={16} />
                Solicitar Clasificación Formal
              </button>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  minHeight: 60,
                  padding: '14px 28px',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--portal-fg-4)',
                  fontSize: 'var(--aguila-fs-section)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  justifyContent: 'center',
                }}
              >
                Nueva consulta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        textarea:focus, input:focus {
          border-color: rgba(192,197,206,0.3) !important;
        }
      `}</style>
    </div>
  )
}
