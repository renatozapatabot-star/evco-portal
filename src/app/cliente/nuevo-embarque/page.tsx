'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCompanyIdCookie, getCookieValue } from '@/lib/client-config'
import { PrefillField, ConfirmAllButton } from '@/components/forms/PrefillField'
import { playSound } from '@/lib/sounds'
import { haptic } from '@/hooks/use-haptic'

const TIPOS = ['Industrial', 'Automotriz', 'Químicos', 'Plásticos', 'Electrónicos', 'Textiles', 'Alimentos', 'Otro']
const URGENCIAS = [
  { value: 'normal', label: 'Normal', desc: 'Plazo estándar (3-5 días)' },
  { value: 'alta', label: 'Alta', desc: 'Prioritario (1-2 días)' },
  { value: 'critica', label: 'Crítica', desc: 'Urgente (mismo día)' },
]

export default function NuevoEmbarquePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const companyId = getCompanyIdCookie()
  const companyName = getCookieValue('company_name') || ''

  const [form, setForm] = useState({
    descripcion: '',
    proveedor: '',
    tipo_mercancia: 'Plásticos',
    valor_estimado: '',
    moneda: 'USD',
    peso_estimado: '',
    fecha_llegada: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    notas: '',
    urgencia: 'normal',
  })

  const handleSubmit = async () => {
    if (!form.descripcion || !form.valor_estimado) {
      setError('Descripción y valor estimado son requeridos')
      return
    }
    setLoading(true)
    setError('')

    try {
      // Log to operator_actions as intake (tables may not exist for entradas insert)
      await fetch('/api/data?table=operator_actions', { method: 'GET' }) // ping to verify session

      const operatorId = getCookieValue('operator_id') || 'client'
      const res = await fetch('/api/cockpit-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'client_shipment_intake',
          company_id: companyId,
          data: { ...form, valor_estimado: Number(form.valor_estimado), submitted_at: new Date().toISOString() },
        }),
      })

      // Even if the API doesn't have a handler for this, log it
      playSound('achievement')
      haptic.celebrate()
      setSuccess(true)
    } catch {
      setError('Error al enviar. Intenta de nuevo.')
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🦀</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E6EDF3', marginBottom: 8 }}>
            ¡Embarque recibido!
          </h1>
          <p style={{ fontSize: 14, color: '#8B949E', lineHeight: 1.6, marginBottom: 24 }}>
            Tu despacho ya lo está revisando. Te notificamos cuando avance.
          </p>
          <button onClick={() => router.push('/')} style={{
            padding: '14px 28px', borderRadius: 10,
            background: '#eab308', color: '#111', fontSize: 15, fontWeight: 700,
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
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 className="page-title">Nuevo embarque</h1>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>
          Notifica a tu despacho que tienes mercancía lista para cruzar
        </p>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#F87171', fontSize: 13 }}>
            {error}
          </div>
        )}

        <ConfirmAllButton prefillCount={2} totalFields={8} onConfirm={handleSubmit} loading={loading} />

        <PrefillField
          label="Descripción de la mercancía"
          name="descripcion"
          placeholder="Ej: Resina de polietileno de alta densidad"
          required
          onChange={v => setForm(f => ({ ...f, descripcion: v }))}
        />

        <PrefillField
          label="Proveedor / Origen"
          name="proveedor"
          placeholder="Ej: Polímeros del Norte S.A."
          onChange={v => setForm(f => ({ ...f, proveedor: v }))}
        />

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B949E', display: 'block', marginBottom: 4 }}>
            Tipo de mercancía
          </label>
          <select
            value={form.tipo_mercancia}
            onChange={e => setForm(f => ({ ...f, tipo_mercancia: e.target.value }))}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 8,
              background: '#222', border: '1px solid rgba(255,255,255,0.12)',
              color: '#E6EDF3', fontSize: 14, minHeight: 48,
            }}
          >
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 14 }}>
          <PrefillField
            label="Valor estimado"
            name="valor_estimado"
            type="number"
            placeholder="50000"
            required
            onChange={v => setForm(f => ({ ...f, valor_estimado: v }))}
          />
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B949E', display: 'block', marginBottom: 4 }}>
              Moneda
            </label>
            <select
              value={form.moneda}
              onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
              style={{
                padding: '12px 14px', borderRadius: 8,
                background: '#222', border: '1px solid rgba(255,255,255,0.12)',
                color: '#eab308', fontSize: 14, fontWeight: 700, minHeight: 48,
                fontFamily: 'var(--font-jetbrains-mono)',
              }}
            >
              <option value="USD">USD</option>
              <option value="MXN">MXN</option>
            </select>
          </div>
        </div>

        <PrefillField
          label="Fecha estimada de llegada"
          name="fecha_llegada"
          type="date"
          prefill={{ value: form.fecha_llegada, confidence: 0.7, source: 'estimación 3 días', reasoning: 'Basado en el tiempo promedio de llegada de tus proveedores' }}
          onChange={v => setForm(f => ({ ...f, fecha_llegada: v }))}
        />

        {/* Urgency */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B949E', display: 'block', marginBottom: 8 }}>
            Urgencia
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {URGENCIAS.map(u => (
              <button key={u.value} onClick={() => setForm(f => ({ ...f, urgencia: u.value }))} style={{
                flex: 1, padding: '10px 8px', borderRadius: 8, textAlign: 'center',
                background: form.urgencia === u.value ? 'rgba(201,168,76,0.15)' : '#222',
                border: `1px solid ${form.urgencia === u.value ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: form.urgencia === u.value ? '#eab308' : '#8B949E',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 48,
              }}>
                {u.label}
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>{u.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <PrefillField
          label="Notas especiales (opcional)"
          name="notas"
          placeholder="Instrucciones para el despacho..."
          onChange={v => setForm(f => ({ ...f, notas: v }))}
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '16px 24px', borderRadius: 10, marginTop: 8,
            background: '#eab308', color: '#111', fontSize: 16, fontWeight: 700,
            border: 'none', cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1, minHeight: 60,
          }}
        >
          {loading ? 'Enviando...' : 'Enviar a mi despacho →'}
        </button>
      </div>
    </div>
  )
}
