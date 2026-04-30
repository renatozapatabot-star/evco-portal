'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useIsMobile } from '@/hooks/use-mobile'
import { AguilaInput, AguilaTextarea } from '@/components/aguila'

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
      <div style={{ minHeight: '100vh', background: 'var(--portal-ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--aguila-fs-kpi-hero)', marginBottom: 16 }}>🦀</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--portal-fg-1)', marginBottom: 8 }}>
            Gracias por tu interés
          </h1>
          <p style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-fg-4)', lineHeight: 1.6, marginBottom: 24 }}>
            Renato Zapata IV te contactará dentro de 24 horas por WhatsApp para configurar tu portal.
          </p>
          <Link href="/demo/live" style={{
            display: 'inline-block', padding: '14px 28px', borderRadius: 10,
            background: 'var(--portal-fg-1)', color: '#111', fontSize: 15, fontWeight: 700,
            textDecoration: 'none',
          }}>
            Seguir explorando el demo →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--portal-ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: isMobile ? 24 : 40, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--portal-fg-1)', letterSpacing: '0.08em', textAlign: 'center', marginBottom: 8 }}>
          PORTAL
        </div>
        <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: '#FFF', textAlign: 'center', marginBottom: 8 }}>
          Solicita acceso real
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 28 }}>
          Tu información ya está en nuestro sistema. Solo necesitamos verificar tu identidad.
        </p>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AguilaInput label="Nombre completo" required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          <AguilaInput label="Nombre de la firma" required placeholder="Ej: Agencia Aduanal García" value={form.firm_name} onChange={(e) => setForm((f) => ({ ...f, firm_name: e.target.value }))} />
          <AguilaInput label="Patente (opcional)" placeholder="Ej: 3596" mono value={form.patente} onChange={(e) => setForm((f) => ({ ...f, patente: e.target.value }))} />
          <AguilaInput label="WhatsApp" required type="tel" placeholder="+52 956 123 4567" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <AguilaInput label="Correo electrónico (opcional)" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <AguilaTextarea
            label="¿Qué te interesó del Portal? (opcional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
          <button type="submit" disabled={loading} style={{
            marginTop: 8, padding: '16px 20px', borderRadius: 10,
            background: 'var(--portal-fg-1)', color: 'rgba(255,255,255,0.03)', fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700,
            border: 'none', cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1, minHeight: 60,
          }}>
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 'var(--aguila-fs-compact)', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
          <Link href="/demo/live" style={{ color: 'var(--portal-fg-1)', textDecoration: 'none' }}>
            ← Volver al demo
          </Link>
        </p>
      </div>
    </div>
  )
}

