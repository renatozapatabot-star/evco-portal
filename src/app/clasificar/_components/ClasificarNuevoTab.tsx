'use client'

import { useState, useTransition, useRef } from 'react'
import { GlassCard } from '@/components/aguila/GlassCard'
import { AguilaTextarea } from '@/components/aguila'

interface Alternative {
  fraccion: string
  descripcion: string
  confidence: number
}

interface ClassifyResponse {
  id: string
  fraccion: string | null
  tmec_eligible: boolean | null
  nom_required: string[]
  confidence: number
  justificacion: string | null
  alternatives: Alternative[]
  model: string
  latency_ms: number
}

interface ApiError {
  code: string
  message: string
}

interface ClasificarNuevoTabProps {
  canInsert: boolean
}

const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const ACCEPTED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

function ConfidenceBar({ value }: { value: number }) {
  const tone = value >= 85 ? 'var(--portal-status-green-fg)' : value >= 70 ? 'var(--portal-status-amber-fg)' : 'var(--portal-status-red-fg)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)' }}>
          Confianza
        </span>
        <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: tone }}>
          {value}%
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.max(2, Math.min(100, value))}%`,
            background: tone,
            transition: 'width 240ms ease',
          }}
        />
      </div>
    </div>
  )
}

export function ClasificarNuevoTab({ canInsert }: ClasificarNuevoTabProps) {
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ClassifyResponse | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [traficoId, setTraficoId] = useState('')
  const [insertState, setInsertState] = useState<'idle' | 'inserting' | 'inserted' | 'error'>('idle')
  const [insertMessage, setInsertMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | null) {
    if (!file) {
      setImageFile(null)
      setImagePreview(null)
      return
    }
    if (!ACCEPTED_MIMES.has(file.type)) {
      setError({ code: 'INVALID_IMAGE', message: 'Formato no soportado. Usa JPG, PNG o WebP.' })
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError({ code: 'IMAGE_TOO_LARGE', message: 'La imagen excede 6 MB.' })
      return
    }
    setError(null)
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function reset() {
    setResult(null)
    setError(null)
    setInsertState('idle')
    setInsertMessage(null)
    setTraficoId('')
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (description.trim().length < 3) {
      setError({ code: 'INVALID_INPUT', message: 'La descripción debe tener al menos 3 caracteres.' })
      return
    }
    setError(null)
    setResult(null)
    setInsertState('idle')

    const payload: { description: string; imageBase64?: string; imageMime?: string } = {
      description: description.trim(),
    }
    if (imageFile) {
      try {
        payload.imageBase64 = await fileToBase64(imageFile)
        payload.imageMime = imageFile.type
      } catch (e) {
        setError({ code: 'INVALID_IMAGE', message: e instanceof Error ? e.message : 'Error de imagen' })
        return
      }
    }

    startTransition(async () => {
      const res = await fetch('/api/clasificar/nuevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? { code: 'INTERNAL_ERROR', message: 'Error desconocido' })
        return
      }
      setResult(json.data)
    })
  }

  async function onInsert() {
    if (!result || !traficoId.trim()) return
    setInsertState('inserting')
    setInsertMessage(null)
    try {
      const res = await fetch('/api/clasificar/nuevo/insertar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classification_log_id: result.id, trafico_id: traficoId.trim() }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setInsertState('error')
        setInsertMessage(json.error?.message ?? 'No se pudo insertar')
        return
      }
      setInsertState('inserted')
      setInsertMessage(`Insertado en embarque ${json.data.trafico_id}`)
    } catch (e) {
      setInsertState('error')
      setInsertMessage(e instanceof Error ? e.message : 'Error de red')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, margin: '0 auto' }}>
      <GlassCard>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <AguilaTextarea
              id="cn-desc"
              label="Descripción del producto"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Resina de polietileno de baja densidad para inyección, peso molecular 100k, presentación pellet…"
              maxLength={2000}
              required
              rows={4}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.45)' }}>
                {description.length}/2000
              </span>
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--aguila-fs-meta)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.6)',
                marginBottom: 6,
              }}
            >
              Imagen del producto (opcional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  minHeight: 60,
                  padding: '0 20px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.92)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontSize: 'var(--aguila-fs-section)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {imageFile ? 'Cambiar imagen' : 'Adjuntar imagen'}
              </button>
              {imageFile && (
                <>
                  <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-compact)', color: 'rgba(255,255,255,0.6)' }}>
                    {imageFile.name} · {(imageFile.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => { handleFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    style={{
                      minHeight: 60,
                      padding: '0 16px',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      fontSize: 'var(--aguila-fs-body)',
                      cursor: 'pointer',
                    }}
                  >
                    Quitar
                  </button>
                </>
              )}
            </div>
            {imagePreview && (
              <div style={{ marginTop: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Vista previa"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 240,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                />
              </div>
            )}
            <p style={{ margin: '6px 0 0', fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.45)' }}>
              JPG, PNG o WebP · máximo 6 MB · habilita Claude Vision (Sonnet)
            </p>
          </div>

          <button
            type="submit"
            disabled={pending || description.trim().length < 3}
            style={{
              minHeight: 60,
              borderRadius: 12,
              background: pending || description.trim().length < 3 ? 'rgba(234,179,8,0.3)' : 'var(--portal-gold-500)',
              color: 'var(--portal-ink-0)',
              border: 'none',
              fontSize: 'var(--aguila-fs-body-lg)',
              fontWeight: 700,
              cursor: pending || description.trim().length < 3 ? 'wait' : 'pointer',
              transition: 'background 150ms',
            }}
          >
            {pending ? 'Clasificando…' : 'Clasificar producto'}
          </button>

          {error && (
            <div
              role="alert"
              style={{
                padding: 12,
                borderRadius: 12,
                background: 'var(--portal-status-red-bg)',
                border: '1px solid var(--portal-status-red-ring)',
                color: 'var(--portal-status-red-fg)',
                fontSize: 'var(--aguila-fs-body)',
              }}
            >
              {error.message}
            </div>
          )}
        </form>
      </GlassCard>

      {result && (
        <GlassCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)' }}>
                  Fracción arancelaria
                </p>
                <p
                  className="font-mono"
                  style={{
                    margin: 0,
                    fontSize: 36,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: result.fraccion ? 'var(--portal-fg-1)' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {result.fraccion ?? 'Sin clasificar'}
                </p>
              </div>
              <div style={{ minWidth: 180 }}>
                <ConfidenceBar value={result.confidence} />
              </div>
            </div>

            {(result.tmec_eligible != null || result.nom_required.length > 0) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {result.tmec_eligible === true && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(234,179,8,0.15)',
                      border: '1px solid rgba(234,179,8,0.4)',
                      color: 'var(--portal-status-amber-fg)',
                      fontSize: 'var(--aguila-fs-compact)',
                      fontWeight: 600,
                    }}
                  >
                    T-MEC elegible · IGI 0%
                  </span>
                )}
                {result.tmec_eligible === false && (
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 'var(--aguila-fs-compact)',
                      fontWeight: 600,
                    }}
                  >
                    Sin preferencia T-MEC
                  </span>
                )}
                {result.nom_required.map((nom) => (
                  <span
                    key={nom}
                    className="font-mono"
                    style={{
                      display: 'inline-flex',
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(126,34,206,0.15)',
                      border: '1px solid rgba(126,34,206,0.4)',
                      color: '#D8B4FE',
                      fontSize: 'var(--aguila-fs-compact)',
                      fontWeight: 600,
                    }}
                  >
                    {nom}
                  </span>
                ))}
              </div>
            )}

            {result.justificacion && (
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)' }}>
                  Justificación
                </p>
                <p style={{ margin: 0, fontSize: 'var(--aguila-fs-section)', lineHeight: 1.5, color: 'rgba(255,255,255,0.85)' }}>
                  {result.justificacion}
                </p>
              </div>
            )}

            {result.alternatives.length > 0 && (
              <details style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                  Alternativas ({result.alternatives.length})
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {result.alternatives.map((alt) => (
                    <div
                      key={alt.fraccion}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 8,
                      }}
                    >
                      <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
                        {alt.fraccion}
                      </span>
                      <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'rgba(255,255,255,0.6)', flex: 1 }}>
                        {alt.descripcion}
                      </span>
                      <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-compact)', color: 'rgba(255,255,255,0.6)' }}>
                        {alt.confidence}%
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div
              style={{
                display: 'flex',
                gap: 12,
                fontSize: 'var(--aguila-fs-meta)',
                color: 'rgba(255,255,255,0.45)',
                paddingTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span className="font-mono">{result.model}</span>
              <span className="font-mono">·</span>
              <span className="font-mono">{result.latency_ms} ms</span>
            </div>

            {canInsert && result.fraccion && result.confidence > 85 && insertState !== 'inserted' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                <label
                  htmlFor="cn-trafico"
                  style={{ fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)' }}
                >
                  Insertar en embarque
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    id="cn-trafico"
                    type="text"
                    value={traficoId}
                    onChange={(e) => setTraficoId(e.target.value)}
                    placeholder="Número de embarque"
                    className="font-mono"
                    style={{
                      flex: '1 1 200px',
                      minHeight: 60,
                      background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.92)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12,
                      padding: '0 14px',
                      fontSize: 'var(--aguila-fs-section)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={onInsert}
                    disabled={insertState === 'inserting' || !traficoId.trim()}
                    style={{
                      minHeight: 60,
                      padding: '0 24px',
                      borderRadius: 12,
                      background: insertState === 'inserting' || !traficoId.trim() ? 'var(--portal-status-green-ring)' : 'var(--portal-status-green-fg)',
                      color: 'var(--portal-ink-0)',
                      border: 'none',
                      fontSize: 'var(--aguila-fs-section)',
                      fontWeight: 700,
                      cursor: insertState === 'inserting' || !traficoId.trim() ? 'wait' : 'pointer',
                    }}
                  >
                    {insertState === 'inserting' ? 'Insertando…' : 'Insertar en embarque'}
                  </button>
                </div>
              </div>
            )}

            {insertMessage && (
              <div
                role="status"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background:
                    insertState === 'inserted'
                      ? 'var(--portal-status-green-bg)'
                      : 'var(--portal-status-red-bg)',
                  border:
                    insertState === 'inserted'
                      ? '1px solid var(--portal-status-green-ring)'
                      : '1px solid var(--portal-status-red-ring)',
                  color: insertState === 'inserted' ? 'var(--portal-status-green-fg)' : 'var(--portal-status-red-fg)',
                  fontSize: 'var(--aguila-fs-body)',
                }}
              >
                {insertMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  minHeight: 48,
                  padding: '0 16px',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  fontSize: 'var(--aguila-fs-body)',
                  cursor: 'pointer',
                }}
              >
                Nueva clasificación
              </button>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
