'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useIsMobile } from '@/hooks/use-mobile'

export default function RequestAccessPage() {
  const isMobile = useIsMobile()
  const [form, setForm] = useState({ full_name: '', firm_name: '', patente: '', phone: '', email: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name || !form.firm_name || !form.phone) { setError('Nombre, firma y teléfono son requeridos'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/demo/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) setSuccess(true)
      else setError('No se pudo enviar. Intenta de nuevo.')
    } catch { setError('Error de conexión.') }
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D0D0C', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🦀</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E6EDF3', marginBottom: 8 }}>
            Gracias por tu interés
          </h1>
          <p style={{ fontSize: 14, color: '#8B949E', lineHeight: 1.6, marginBottom: 24 }}>
            Renato Zapata IV te contactará dentro de 24 horas por WhatsApp para configurar tu portal.
          </p>
          <Link href="/demo/live" style={{
            display: 'inline-block', padding: '14px 28px', borderRadius: 10,
            background: '#C9A84C', color: '#111', fontSize: 15, fontWeight: 700,
            textDecoration: 'none',
          }}>
            Seguir explorando el demo →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0C', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', background: '#1A1A1A', borderRadius: 20, padding: isMobile ? 24 : 40, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: '#C9A84C', letterSpacing: '0.08em', textAlign: 'center', marginBottom: 8 }}>
          CRUZ
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#FFF', textAlign: 'center', marginBottom: 8 }}>
          Solicita acceso real
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 28 }}>
          Tu información ya está en nuestro sistema. Solo necesitamos verificar tu identidad.
        </p>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#F87171', fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Nombre completo *" value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} />
          <Field label="Nombre de la firma *" value={form.firm_name} onChange={v => setForm(f => ({ ...f, firm_name: v }))} placeholder="Ej: Agencia Aduanal García" />
          <Field label="Patente (opcional)" value={form.patente} onChange={v => setForm(f => ({ ...f, patente: v }))} placeholder="Ej: 3596" />
          <Field label="WhatsApp *" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+52 956 123 4567" type="tel" />
          <Field label="Correo electrónico (opcional)" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
              ¿Qué te interesó de ADUANA? (opcional)
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#222', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
          <button type="submit" disabled={loading} style={{
            marginTop: 8, padding: '16px 20px', borderRadius: 10,
            background: '#C9A84C', color: '#1A1A1A', fontSize: 16, fontWeight: 700,
            border: 'none', cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1, minHeight: 60,
          }}>
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
          <Link href="/demo/live" style={{ color: '#C9A84C', textDecoration: 'none' }}>
            ← Volver al demo
          </Link>
        </p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
        width: '100%', padding: '10px 14px', borderRadius: 8,
        background: '#222', border: '1px solid rgba(255,255,255,0.1)',
        color: '#FFF', fontSize: 14, boxSizing: 'border-box',
      }} />
    </div>
  )
}
