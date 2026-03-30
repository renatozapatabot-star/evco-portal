'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GOLD, GREEN, RED } from '@/lib/design-system'

const T = {
  bg: '#0D0D0D', surface: '#161616', border: '#2A2A2A',
  text: '#E8E6E0', sub: '#9C9690', muted: '#666',
  gold: GOLD, green: GREEN, red: RED,
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function OnboardPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', rfc: '', clave_cliente: '',
    contact_name: '', contact_email: '', contact_phone: '',
    immex: false, language: 'bilingual',
    portal_password: generatePassword(),
  })

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }))

  async function handleActivate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data)
      setStep(5)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', height: 40, border: `1px solid ${T.border}`, borderRadius: 8,
    padding: '0 12px', fontSize: 14, background: T.bg, color: T.text,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    display: 'block', color: T.sub, fontSize: 11, fontWeight: 600,
    marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: "'DM Sans', sans-serif", color: T.text, maxWidth: 600 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Nuevo Cliente</h1>
      <p style={{ color: T.muted, fontSize: 13, margin: '0 0 28px' }}>
        Paso {Math.min(step, 4)} de 4 &middot; Onboarding wizard
      </p>

      {error && (
        <div style={{ background: 'rgba(220,38,38,0.1)', border: `1px solid ${T.red}30`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: T.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>Información de la Empresa</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Razón Social *</label>
                <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="EVCO Plastics de México S.A. de C.V." />
              </div>
              <div>
                <label style={labelStyle}>RFC *</label>
                <input style={inputStyle} value={form.rfc} onChange={e => set('rfc', e.target.value.toUpperCase())}
                  placeholder="EPM160101XXX" maxLength={13} />
              </div>
              <div>
                <label style={labelStyle}>Clave GlobalPC *</label>
                <input style={inputStyle} value={form.clave_cliente} onChange={e => set('clave_cliente', e.target.value)}
                  placeholder="Ej: 1234" />
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={!form.name || !form.rfc || !form.clave_cliente}
              style={{ marginTop: 20, padding: '10px 24px', background: T.gold, border: 'none',
                borderRadius: 8, color: '#1A1710', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Siguiente
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>Contacto Principal</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Nombre del Contacto</label>
                <input style={inputStyle} value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
                  placeholder="Juan Pérez" />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input style={inputStyle} type="email" value={form.contact_email}
                  onChange={e => set('contact_email', e.target.value)}
                  placeholder="contacto@empresa.com" />
              </div>
              <div>
                <label style={labelStyle}>Teléfono</label>
                <input style={inputStyle} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
                  placeholder="+52 (867) 123-4567" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(1)}
                style={{ padding: '10px 20px', background: T.bg, border: `1px solid ${T.border}`,
                  borderRadius: 8, color: T.text, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Atrás
              </button>
              <button onClick={() => setStep(3)} disabled={!form.contact_email}
                style={{ padding: '10px 24px', background: T.gold, border: 'none',
                  borderRadius: 8, color: '#1A1710', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>Configuración</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.immex} onChange={e => set('immex', e.target.checked)} />
                <span style={{ fontSize: 14 }}>Empresa IMMEX</span>
              </label>
              <div>
                <label style={labelStyle}>Idioma de Portal</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.language}
                  onChange={e => set('language', e.target.value)}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="bilingual">Bilingüe</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Contraseña del Portal</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.05em' }}
                    value={form.portal_password} onChange={e => set('portal_password', e.target.value)} />
                  <button onClick={() => set('portal_password', generatePassword())}
                    style={{ padding: '0 12px', background: T.bg, border: `1px solid ${T.border}`,
                      borderRadius: 8, color: T.sub, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Regenerar
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(2)}
                style={{ padding: '10px 20px', background: T.bg, border: `1px solid ${T.border}`,
                  borderRadius: 8, color: T.text, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Atrás
              </button>
              <button onClick={() => setStep(4)}
                style={{ padding: '10px 24px', background: T.gold, border: 'none',
                  borderRadius: 8, color: '#1A1710', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Revisar
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>Confirmar Activación</h2>
            <div style={{ background: T.bg, borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 2 }}>
              <div><strong>Empresa:</strong> {form.name}</div>
              <div><strong>RFC:</strong> {form.rfc}</div>
              <div><strong>Clave:</strong> {form.clave_cliente}</div>
              <div><strong>Contacto:</strong> {form.contact_name} ({form.contact_email})</div>
              <div><strong>IMMEX:</strong> {form.immex ? 'Sí' : 'No'}</div>
              <div><strong>Password:</strong> <code style={{ background: T.border, padding: '2px 8px', borderRadius: 4 }}>{form.portal_password}</code></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(3)}
                style={{ padding: '10px 20px', background: T.bg, border: `1px solid ${T.border}`,
                  borderRadius: 8, color: T.text, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Atrás
              </button>
              <button onClick={handleActivate} disabled={loading}
                style={{ padding: '10px 24px',
                  background: loading ? '#333' : 'linear-gradient(135deg, #16A34A, #15803D)',
                  border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {loading ? 'Activando...' : 'Activar Cliente'}
              </button>
            </div>
          </div>
        )}

        {step === 5 && result && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Cliente Activado</h2>
            <p style={{ color: T.sub, fontSize: 14, margin: '0 0 24px' }}>{form.name} ya tiene acceso al portal</p>
            <div style={{ background: T.bg, borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 2, textAlign: 'left' }}>
              <div><strong>URL:</strong> https://evco-portal.vercel.app</div>
              <div><strong>Password:</strong> <code style={{ background: T.border, padding: '2px 8px', borderRadius: 4 }}>{form.portal_password}</code></div>
              <div><strong>Company ID:</strong> {result.company_id}</div>
            </div>
            <button onClick={() => router.push('/admin')}
              style={{ marginTop: 20, padding: '10px 24px', background: T.gold, border: 'none',
                borderRadius: 8, color: '#1A1710', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Volver al Admin
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
