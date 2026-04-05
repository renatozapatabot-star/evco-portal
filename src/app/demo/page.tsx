'use client'

import { useState } from 'react'
import { Search, ArrowRight } from 'lucide-react'

export default function DemoPage() {
  const [clave, setClave] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ count: number; name: string } | null>(null)
  const [notified, setNotified] = useState(false)

  async function handlePreview() {
    if (!clave.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/data?table=companies&limit=1')
      const data = await res.json()
      setResult({ count: (data.data || []).length, name: clave })
    } catch { setResult({ count: 0, name: clave }) }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.15em', marginBottom: 8 }}>CRUZ</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>Inteligencia Aduanal · Patente 3596</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, margin: '0 0 8px' }}>
          Su información ya está aquí.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 32px', lineHeight: 1.6 }}>
          No necesita instalar nada. No necesita subir datos. Abra el portal. Todo listo.
        </p>
        {!result && !notified && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 52, borderRadius: 12, border: '2px solid var(--border)', background: 'var(--bg-card)' }}>
              <Search size={18} style={{ color: 'var(--text-muted)' }} />
              <input type="text" value={clave} onChange={e => setClave(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePreview()}
                placeholder="Ingrese su clave" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }} />
            </div>
            <button onClick={handlePreview} disabled={loading || !clave.trim()} style={{
              width: 52, height: 52, borderRadius: 12, border: 'none', background: 'var(--gold)', color: 'var(--bg-card)',
              cursor: clave.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: clave.trim() ? 1 : 0.5,
            }}>
              <ArrowRight size={20} />
            </button>
          </div>
        )}
        {result && !notified && (
          <div className="card card-enter" style={{ padding: 32, marginTop: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 24 }}>Sus datos están disponibles.</div>
            <button onClick={() => setNotified(true)} className="spring-press" style={{
              width: '100%', padding: '14px 24px', minHeight: 52, borderRadius: 12, border: 'none',
              background: 'var(--gold)', color: 'var(--bg-card)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>Solicitar acceso</button>
          </div>
        )}
        {notified && (
          <div className="card card-enter" style={{ padding: 32, marginTop: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>Solicitud enviada</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Nuestro equipo se comunicará en 24 horas.</div>
          </div>
        )}
        <div style={{ marginTop: 48, fontSize: 11, color: 'var(--text-disabled)' }}>Renato Zapata & Company · Est. 1941</div>
      </div>
    </div>
  )
}
