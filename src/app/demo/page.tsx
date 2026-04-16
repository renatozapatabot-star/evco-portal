'use client'

import { useState } from 'react'
import { Search, ArrowRight } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { AguilaMark } from '@/components/brand/AguilaMark'

export default function DemoPage() {
  const isMobile = useIsMobile()
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 16 : 24 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <AguilaMark size={56} />
        </div>
        <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', marginBottom: 24 }}>Inteligencia Aduanal · Patente 3596</div>

        {/* Before/After strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, textAlign: 'center' }}>
          <div style={{ flex: 1, padding: '16px 12px', borderRadius: 10, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)' }}>
            <div style={{ fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, color: '#DC2626', fontFamily: 'var(--font-mono)' }}>22 min</div>
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', marginTop: 4 }}>Proceso manual</div>
          </div>
          <div style={{ flex: 1, padding: '16px 12px', borderRadius: 10, background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)' }}>
            <div style={{ fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, color: '#16A34A', fontFamily: 'var(--font-mono)' }}>2 min</div>
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', marginTop: 4 }}>Con CRUZ</div>
          </div>
        </div>

        {/* Live demo CTA */}
        <a href="/demo/live" style={{
          display: 'block', padding: '16px 24px', borderRadius: 12, marginBottom: 24,
          background: 'var(--gold)', color: '#111', fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700,
          textDecoration: 'none', textAlign: 'center', minHeight: 60,
          lineHeight: '28px',
        }}>
          Ver demo en vivo →
        </a>

        <h1 style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, margin: '0 0 8px' }}>
          ¿Ya tiene clave? Ingrese aquí.
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>
          Si ya es cliente, ingrese su clave para acceder a su portal personalizado.
        </p>
        {!result && !notified && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 60, borderRadius: 12, border: '2px solid var(--border)', background: 'var(--bg-card)' }}>
              <Search size={18} style={{ color: 'var(--text-muted)' }} />
              <input type="text" value={clave} onChange={e => setClave(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePreview()}
                placeholder="Ingrese su clave" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }} />
            </div>
            <button onClick={handlePreview} disabled={loading || !clave.trim()} style={{
              width: 60, height: 60, borderRadius: 12, border: 'none', background: 'var(--gold)', color: 'var(--bg-card)',
              cursor: clave.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: clave.trim() ? 1 : 0.5,
            }}>
              <ArrowRight size={20} />
            </button>
          </div>
        )}
        {result && !notified && (
          <div className="card card-enter" style={{ padding: 32, marginTop: 24 }}>
            <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600, marginBottom: 24 }}>Sus datos están disponibles.</div>
            <button onClick={() => setNotified(true)} className="spring-press" style={{
              width: '100%', padding: '14px 24px', minHeight: 60, borderRadius: 12, border: 'none',
              background: 'var(--gold)', color: 'var(--bg-card)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>Solicitar acceso</button>
          </div>
        )}
        {notified && (
          <div className="card card-enter" style={{ padding: 32, marginTop: 24 }}>
            <div style={{ fontSize: 'var(--aguila-fs-kpi-compact)', marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600, color: 'var(--success)' }}>Solicitud enviada</div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', marginTop: 8 }}>Nuestro equipo se comunicará en 24 horas.</div>
          </div>
        )}
        <div style={{ marginTop: 48, fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-disabled)' }}>Renato Zapata & Company · Est. 1941</div>
      </div>
    </div>
  )
}
