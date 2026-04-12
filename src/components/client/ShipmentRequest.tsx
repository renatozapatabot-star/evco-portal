'use client'

import { useState, useRef } from 'react'
import {
  Truck, Package, DollarSign, FileUp, StickyNote,
  Loader2, CheckCircle, XCircle, Send, RotateCcw,
  Ship, Plane, MapPin,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

interface ShipmentPayload {
  supplier: string
  description: string
  estimatedValue: number | null
  shippingMethod: 'terrestre' | 'maritimo' | 'aereo'
  notes: string
}

interface AttachedFile {
  file: File
  id: string
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
  color: '#E6EDF3',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

// ── Shipping method options ────────────────────────────────

const SHIPPING_METHODS = [
  { value: 'terrestre' as const, label: 'Terrestre', icon: Truck },
  { value: 'maritimo' as const, label: 'Marítimo', icon: Ship },
  { value: 'aereo' as const, label: 'Aéreo', icon: Plane },
]

// ── Component ──────────────────────────────────────────────

export function ShipmentRequest() {
  const [form, setForm] = useState<ShipmentPayload>({
    supplier: '',
    description: '',
    estimatedValue: null,
    shippingMethod: 'terrestre',
    notes: '',
  })
  const [files, setFiles] = useState<AttachedFile[]>([])
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canSubmit = form.supplier.trim().length > 1 && form.description.trim().length > 5

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? []).map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }))
    setFiles(prev => [...prev, ...newFiles])
    // Reset input so re-selecting the same file works
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setState('loading')
    setErrorMsg('')

    try {
      const formData = new FormData()
      formData.append('supplier', form.supplier)
      formData.append('description', form.description)
      if (form.estimatedValue !== null) {
        formData.append('estimatedValue', form.estimatedValue.toString())
      }
      formData.append('shippingMethod', form.shippingMethod)
      formData.append('notes', form.notes)

      for (const { file } of files) {
        formData.append('documents', file)
      }

      const res = await fetch('/api/client-requests', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Error del servidor' }))
        throw new Error(body.error || `Error ${res.status}`)
      }

      setState('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado')
      setState('error')
    }
  }

  function handleReset() {
    setForm({ supplier: '', description: '', estimatedValue: null, shippingMethod: 'terrestre', notes: '' })
    setFiles([])
    setState('idle')
    setErrorMsg('')
  }

  // ── Success state ──
  if (state === 'success') {
    return (
      <div style={glassCard}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 16, padding: '32px 16px', textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(34,197,94,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle size={32} color="#22C55E" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3', marginBottom: 8 }}>
              Solicitud enviada
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, maxWidth: 400 }}>
              Tráfico preliminar creado. Su agente aduanal ha sido notificado
              y se comunicará con usted para confirmar los detalles.
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            style={{
              minHeight: 60,
              padding: '14px 32px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: '#E6EDF3',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            <RotateCcw size={16} />
            Nueva solicitud
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Truck size={18} color="#C0C5CE" />
        <span style={{
          fontSize: 14, fontWeight: 700, color: '#C0C5CE',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Nueva Solicitud de Embarque
        </span>
      </div>

      {/* ── Form Card ── */}
      <form onSubmit={handleSubmit} style={glassCard}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Proveedor */}
          <div>
            <label style={labelStyle}>
              <MapPin size={14} color="#94a3b8" />
              Proveedor *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Dow Chemical Company"
              value={form.supplier}
              onChange={(e) => setForm(f => ({ ...f, supplier: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* Descripcion */}
          <div>
            <label style={labelStyle}>
              <Package size={14} color="#94a3b8" />
              Descripción de mercancía *
            </label>
            <textarea
              required
              minLength={6}
              rows={3}
              placeholder="Ej: 20 pallets de resina HDPE, 25kg cada saco, 500 sacos total"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            />
          </div>

          {/* Two-column */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}>
            {/* Valor estimado */}
            <div>
              <label style={labelStyle}>
                <DollarSign size={14} color="#94a3b8" />
                Valor estimado USD
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={form.estimatedValue ?? ''}
                onChange={(e) => setForm(f => ({
                  ...f,
                  estimatedValue: e.target.value ? parseFloat(e.target.value) : null,
                }))}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              />
            </div>

            {/* Metodo de envio */}
            <div>
              <label style={labelStyle}>
                <Truck size={14} color="#94a3b8" />
                Método de envío
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {SHIPPING_METHODS.map(({ value, label, icon: Icon }) => {
                  const isActive = form.shippingMethod === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, shippingMethod: value }))}
                      style={{
                        flex: 1,
                        minHeight: 48,
                        padding: '10px 8px',
                        borderRadius: 12,
                        border: `1px solid ${isActive ? 'rgba(192,197,206,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        background: isActive ? 'rgba(192,197,206,0.08)' : 'rgba(255,255,255,0.04)',
                        color: isActive ? '#C0C5CE' : '#94a3b8',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.2s',
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* File upload */}
          <div>
            <label style={labelStyle}>
              <FileUp size={14} color="#94a3b8" />
              Documentos adjuntos
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                ...inputStyle,
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderStyle: 'dashed',
                color: '#64748b',
                fontSize: 13,
                gap: 8,
              }}
            >
              <FileUp size={16} />
              Seleccionar archivos (factura, packing list, etc.)
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* File list */}
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {files.map(({ file, id }) => (
                  <div key={id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#94a3b8',
                  }}>
                    <FileUp size={14} color="#C0C5CE" />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748b' }}>
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(id) }}
                      style={{
                        background: 'none', border: 'none',
                        color: '#64748b', cursor: 'pointer',
                        padding: 4, lineHeight: 0,
                      }}
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label style={labelStyle}>
              <StickyNote size={14} color="#94a3b8" />
              Notas adicionales
            </label>
            <textarea
              rows={2}
              placeholder="Instrucciones especiales, urgencia, contacto del proveedor..."
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
            />
          </div>

          {/* Error inline */}
          {state === 'error' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px',
              background: 'rgba(239,68,68,0.08)',
              borderRadius: 12,
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <XCircle size={16} color="#EF4444" />
              <span style={{ fontSize: 13, color: '#EF4444' }}>{errorMsg}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit || state === 'loading'}
            style={{
              minHeight: 60,
              padding: '16px 32px',
              borderRadius: 14,
              border: 'none',
              background: canSubmit && state !== 'loading' ? '#E8EAED' : 'rgba(255,255,255,0.06)',
              color: canSubmit && state !== 'loading' ? '#000' : '#64748b',
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
                Enviando solicitud...
              </>
            ) : (
              <>
                <Send size={18} />
                Enviar Solicitud de Embarque
              </>
            )}
          </button>
        </div>
      </form>

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
