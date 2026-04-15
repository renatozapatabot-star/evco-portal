'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { playSound } from '@/lib/sounds'
import { haptic } from '@/hooks/use-haptic'

const CATEGORIAS = [
  { value: 'documento_faltante', label: 'Documento faltante' },
  { value: 'clasificacion_incorrecta', label: 'Clasificación incorrecta' },
  { value: 'demora_cruce', label: 'Demora en cruce' },
  { value: 'cobro_incorrecto', label: 'Cobro incorrecto' },
  { value: 'falta_comunicacion', label: 'Falta de comunicación' },
  { value: 'error_pedimento', label: 'Error en pedimento' },
  { value: 'otro', label: 'Otro' },
]

const SEVERIDADES = [
  { value: 'baja', label: 'Baja', color: '#16A34A' },
  { value: 'media', label: 'Media', color: '#D97706' },
  { value: 'alta', label: 'Alta', color: '#DC2626' },
]

export default function ReportarProblemaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    category: 'otro',
    severity: 'media',
    title: '',
    description: '',
  })

  const handleSubmit = async () => {
    if (!form.title || !form.description) return
    setLoading(true)
    try {
      // V1 · real intake endpoint — was /api/cockpit-insight (GET-only)
      // which silently discarded every report.
      const res = await fetch('/api/cliente/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reportar_problema', data: form }),
      })
      if (!res.ok) {
        setLoading(false)
        return
      }
      playSound('send')
      haptic.confirm()
      setSuccess(true)
    } catch { /* non-blocking; haptic already fired */ }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 'var(--aguila-fs-kpi-hero)', marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E6EDF3', marginBottom: 8 }}>
            Reporte recibido
          </h1>
          <p style={{ fontSize: 'var(--aguila-fs-section)', color: '#8B949E', lineHeight: 1.6, marginBottom: 24 }}>
            Tu despacho fue notificado. Te contactamos en menos de 2 horas.
          </p>
          <button onClick={() => router.push('/')} style={{
            padding: '14px 28px', borderRadius: 10,
            background: '#E8EAED', color: '#111', fontSize: 15, fontWeight: 700,
            border: 'none', cursor: 'pointer', minHeight: 60,
          }}>
            Volver al portal →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <h1 className="page-title">Reportar un problema</h1>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>
          Tu despacho resolverá esto lo antes posible
        </p>

        {/* Category */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B949E', display: 'block', marginBottom: 4 }}>
            Categoría
          </label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{
            width: '100%', padding: '12px 14px', borderRadius: 8,
            background: '#222', border: '1px solid rgba(255,255,255,0.12)', color: '#E6EDF3', fontSize: 'var(--aguila-fs-section)', minHeight: 48,
          }}>
            {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Severity */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B949E', display: 'block', marginBottom: 8 }}>
            Gravedad
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {SEVERIDADES.map(s => (
              <button key={s.value} onClick={() => setForm(f => ({ ...f, severity: s.value }))} style={{
                flex: 1, padding: '10px', borderRadius: 8, textAlign: 'center',
                background: form.severity === s.value ? `${s.color}15` : '#222',
                border: `1px solid ${form.severity === s.value ? `${s.color}40` : 'rgba(255,255,255,0.08)'}`,
                color: form.severity === s.value ? s.color : '#8B949E',
                fontSize: 'var(--aguila-fs-body)', fontWeight: 600, cursor: 'pointer', minHeight: 48,
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B949E', display: 'block', marginBottom: 4 }}>
            Título del problema *
          </label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Falta factura del embarque de marzo" style={{
            width: '100%', padding: '12px 14px', borderRadius: 8,
            background: '#222', border: '1px solid rgba(255,255,255,0.12)',
            color: '#E6EDF3', fontSize: 'var(--aguila-fs-section)', boxSizing: 'border-box', minHeight: 48,
          }} />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B949E', display: 'block', marginBottom: 4 }}>
            Descripción *
          </label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe el problema con detalle..." rows={4} style={{
            width: '100%', padding: '12px 14px', borderRadius: 8,
            background: '#222', border: '1px solid rgba(255,255,255,0.12)',
            color: '#E6EDF3', fontSize: 'var(--aguila-fs-section)', resize: 'vertical', boxSizing: 'border-box', minHeight: 100,
          }} />
        </div>

        <button onClick={handleSubmit} disabled={loading || !form.title || !form.description} style={{
          width: '100%', padding: '16px 24px', borderRadius: 10,
          background: '#E8EAED', color: '#111', fontSize: 16, fontWeight: 700,
          border: 'none', cursor: loading ? 'wait' : 'pointer',
          opacity: (loading || !form.title || !form.description) ? 0.5 : 1, minHeight: 60,
        }}>
          {loading ? 'Enviando...' : 'Enviar reporte →'}
        </button>
      </div>
    </div>
  )
}
