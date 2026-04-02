'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GOLD, GREEN, RED } from '@/lib/design-system'
import { getCookieValue, PORTAL_URL } from '@/lib/client-config'

const T = {
  bg: 'var(--bg-dark)', surface: 'var(--navy-900)', border: '#2A2A2A',
  text: '#E8E6E0', sub: '#9C9690', muted: '#666',
  gold: GOLD, green: GREEN, red: RED,
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)
}

interface OnboardResult {
  success: boolean
  company_id: string
  company_name: string
  clave_cliente: string
  portal_password: string
  portal_url: string
  email_sent: boolean
  email_error: string | null
  notification_prefs: boolean
  document_templates: boolean
  docs_created: number
}

export default function OnboardPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OnboardResult | null>(null)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)
  const [copied, setCopied] = useState('')

  // Auth gate — broker or admin only
  const [authorized, setAuthorized] = useState(false)
  useEffect(() => {
    const role = getCookieValue('user_role')
    if (role === 'admin' || role === 'broker') {
      setAuthorized(true)
    } else {
      router.push('/login')
    }
  }, [router])

  const [form, setForm] = useState({
    company_name: '',
    company_id: '',
    clave_cliente: '',
    rfc: '',
    primary_email: '',
    portal_password: generatePassword(),
    contact_name: '',
    contact_phone: '',
    immex: false,
    language: 'bilingual',
  })

  const set = (key: string, value: string | boolean) =>
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Auto-slugify company_id from company_name
      if (key === 'company_name' && typeof value === 'string') {
        next.company_id = slugify(value)
      }
      return next
    })

  const isStep1Valid = form.company_name && form.clave_cliente && form.rfc && form.primary_email

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al activar cliente')
      setResult(data)
      setStep(3)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    }
    setLoading(false)
  }

  async function handleSync() {
    if (!result) return
    setSyncing(true)
    try {
      await fetch(`/api/admin/sync?company=${result.company_id}`)
      setSyncDone(true)
    } catch {
      // Sync is fire-and-forget
      setSyncDone(true)
    }
    setSyncing(false)
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, border: `1px solid ${T.border}`, borderRadius: 8,
    padding: '0 12px', fontSize: 14, background: '#0D0D0C', color: T.text,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', color: T.sub, fontSize: 11, fontWeight: 600,
    marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase',
  }

  if (!authorized) return null

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'var(--font-sans)', color: T.text, maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Nuevo Cliente</h1>
      <p style={{ color: T.muted, fontSize: 13, margin: '0 0 24px' }}>
        Paso {step} de 3 &middot; Onboarding
      </p>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: s <= step ? T.gold : T.border,
            transition: 'background 300ms',
          }} />
        ))}
      </div>

      {error && (
        <div style={{
          background: 'rgba(220,38,38,0.1)', border: `1px solid ${T.red}30`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: T.red, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>

        {/* ─── STEP 1: Client Info ─────────────────── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>Información del Cliente</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Razón Social *</label>
                <input style={inputStyle} value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                  placeholder="Empresa S.A. de C.V." />
              </div>

              <div>
                <label style={labelStyle}>Company ID (auto)</label>
                <input style={{ ...inputStyle, color: T.muted, fontFamily: 'var(--font-mono)', fontSize: 13 }}
                  value={form.company_id}
                  onChange={e => setForm(prev => ({ ...prev, company_id: e.target.value }))}
                  placeholder="auto-generated-from-name" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Clave GlobalPC *</label>
                  <input style={inputStyle} value={form.clave_cliente}
                    onChange={e => set('clave_cliente', e.target.value)}
                    placeholder="Ej: 1234" />
                </div>
                <div>
                  <label style={labelStyle}>RFC *</label>
                  <input style={inputStyle} value={form.rfc}
                    onChange={e => set('rfc', e.target.value.toUpperCase())}
                    placeholder="EPM160101XXX" maxLength={13} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Email Principal *</label>
                <input style={inputStyle} type="email" value={form.primary_email}
                  onChange={e => set('primary_email', e.target.value)}
                  placeholder="contacto@empresa.com" />
              </div>

              <div>
                <label style={labelStyle}>Contraseña del Portal</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inputStyle, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                    value={form.portal_password}
                    onChange={e => set('portal_password', e.target.value)} />
                  <button onClick={() => set('portal_password', generatePassword())}
                    style={{
                      padding: '0 14px', background: '#0D0D0C', border: `1px solid ${T.border}`,
                      borderRadius: 8, color: T.sub, fontSize: 12, cursor: 'pointer',
                      whiteSpace: 'nowrap', minHeight: 44,
                    }}>
                    Regenerar
                  </button>
                </div>
                <p style={{ color: T.muted, fontSize: 11, margin: '4px 0 0' }}>
                  Auto-generada si se deja vacía
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!isStep1Valid}
              style={{
                marginTop: 24, padding: '12px 28px',
                background: isStep1Valid ? T.gold : '#333',
                border: 'none', borderRadius: 8,
                color: isStep1Valid ? '#1A1710' : '#666',
                fontWeight: 700, fontSize: 14,
                cursor: isStep1Valid ? 'pointer' : 'not-allowed',
                minHeight: 48,
              }}>
              Revisar y Activar
            </button>
          </div>
        )}

        {/* ─── STEP 2: Review & Confirm ────────────── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>Confirmar Activación</h2>
            <p style={{ color: T.sub, fontSize: 13, margin: '0 0 16px' }}>
              Al activar se creará la empresa, plantillas de documentos, preferencias de notificación, y se enviará email de bienvenida.
            </p>

            <div style={{ background: '#0D0D0C', borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 2.2 }}>
              <div><span style={{ color: T.muted }}>Empresa:</span> <strong>{form.company_name}</strong></div>
              <div><span style={{ color: T.muted }}>Company ID:</span> <code style={{ background: T.border, padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{form.company_id}</code></div>
              <div><span style={{ color: T.muted }}>Clave:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{form.clave_cliente}</span></div>
              <div><span style={{ color: T.muted }}>RFC:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{form.rfc}</span></div>
              <div><span style={{ color: T.muted }}>Email:</span> {form.primary_email}</div>
              <div><span style={{ color: T.muted }}>Password:</span> <code style={{ background: T.border, padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{form.portal_password}</code></div>
            </div>

            <div style={{
              marginTop: 16, background: 'rgba(186,117,23,0.08)', border: `1px solid ${T.gold}30`,
              borderRadius: 8, padding: '12px 16px', fontSize: 12, color: T.sub,
            }}>
              <strong style={{ color: T.gold }}>Se creará automáticamente:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
                <li>Registro en tabla <code>companies</code></li>
                <li>Preferencias de notificación</li>
                <li>4 plantillas de documentos permanentes</li>
                <li>Email de bienvenida a {form.primary_email}</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(1)}
                style={{
                  padding: '12px 20px', background: '#0D0D0C', border: `1px solid ${T.border}`,
                  borderRadius: 8, color: T.text, fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', minHeight: 48,
                }}>
                Atrás
              </button>
              <button onClick={handleSubmit} disabled={loading}
                style={{
                  padding: '12px 28px',
                  background: loading ? '#333' : 'linear-gradient(135deg, #16A34A, #15803D)',
                  border: 'none', borderRadius: 8, color: '#fff',
                  fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer',
                  minHeight: 48,
                }}>
                {loading ? 'Activando...' : 'Activar Cliente'}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Success ─────────────────────── */}
        {step === 3 && result && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>&#x2705;</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Cliente Activado</h2>
              <p style={{ color: T.sub, fontSize: 14, margin: 0 }}>{result.company_name} ya tiene acceso</p>
            </div>

            {/* Status chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
              <StatusChip ok label="Empresa creada" />
              <StatusChip ok={result.notification_prefs} label="Notificaciones" />
              <StatusChip ok={result.document_templates} label={`${result.docs_created} documentos`} />
              <StatusChip ok={result.email_sent} label="Email enviado" error={result.email_error} />
            </div>

            {/* Credentials block */}
            <div style={{
              background: '#0D0D0C', borderRadius: 8, padding: 20, fontSize: 13, lineHeight: 2.2,
            }}>
              <CopyRow label="Portal URL" value={result.portal_url} copied={copied} onCopy={copyToClipboard} />
              <CopyRow label="Company ID" value={result.company_id} copied={copied} onCopy={copyToClipboard} />
              <CopyRow label="Clave" value={result.clave_cliente} copied={copied} onCopy={copyToClipboard} />
              <CopyRow label="Password" value={result.portal_password} copied={copied} onCopy={copyToClipboard} mono />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <button onClick={handleSync} disabled={syncing || syncDone}
                style={{
                  padding: '12px 20px',
                  background: syncDone ? 'rgba(22,163,74,0.15)' : syncing ? '#333' : '#0D0D0C',
                  border: `1px solid ${syncDone ? T.green + '40' : T.border}`,
                  borderRadius: 8,
                  color: syncDone ? T.green : T.text,
                  fontWeight: 600, fontSize: 13, cursor: syncDone ? 'default' : 'pointer',
                  minHeight: 48,
                }}>
                {syncDone ? 'Sync iniciado' : syncing ? 'Sincronizando...' : 'Sync GlobalPC Data'}
              </button>
              <button onClick={() => {
                const text = [
                  `Portal: ${result.portal_url}`,
                  `Password: ${result.portal_password}`,
                  `Company ID: ${result.company_id}`,
                  `Clave: ${result.clave_cliente}`,
                ].join('\n')
                copyToClipboard(text, 'all')
              }}
                style={{
                  padding: '12px 20px', background: '#0D0D0C',
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  color: T.text, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  minHeight: 48,
                }}>
                {copied === 'all' ? 'Copiado!' : 'Copiar Todo'}
              </button>
              <button onClick={() => router.push('/admin')}
                style={{
                  padding: '12px 24px', background: T.gold, border: 'none',
                  borderRadius: 8, color: '#1A1710', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', minHeight: 48,
                }}>
                Volver al Admin
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusChip({ ok, label, error: errorMsg }: { ok: boolean; label: string; error?: string | null }) {
  return (
    <div
      title={errorMsg || undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
        background: ok ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
        color: ok ? '#16A34A' : 'var(--danger-500)',
        border: `1px solid ${ok ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`,
      }}
    >
      <span>{ok ? '\u2713' : '\u2717'}</span>
      {label}
    </div>
  )
}

function CopyRow({ label, value, copied, onCopy, mono }: {
  label: string; value: string; copied: string
  onCopy: (text: string, label: string) => void; mono?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
      <div>
        <span style={{ color: '#666' }}>{label}:</span>{' '}
        <span style={mono ? { fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' } : undefined}>
          {value}
        </span>
      </div>
      <button
        onClick={() => onCopy(value, label)}
        style={{
          background: 'none', border: 'none', color: copied === label ? '#16A34A' : '#666',
          cursor: 'pointer', fontSize: 12, padding: '4px 8px', minWidth: 60, minHeight: 32,
        }}
      >
        {copied === label ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}
