'use client'

import { useActionState } from 'react'
import { signupAction } from './actions'
import Link from 'next/link'
import { AduanaMark } from '@/components/command-center/CommandCenterAguilaMark'

const ADUANAS = ['Nuevo Laredo (240)', 'Colombia (240)', 'Reynosa (260)', 'Matamoros (210)', 'Ciudad Juárez (070)', 'Tijuana (070)', 'Mexicali (071)', 'Nogales (080)', 'Manzanillo (160)', 'Lázaro Cárdenas (470)', 'Veracruz (430)', 'Monterrey', 'Guadalajara', 'Otra']

export default function SignupPage() {
  const [state, action, pending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => {
      const result = await signupAction(formData)
      return result || null
    },
    null
  )

  return (
    <div style={{
      minHeight: '100vh', background: '#05070B',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: 'rgba(255,255,255,0.03)',
        borderRadius: 20, padding: 40, border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, justifyContent: 'center' }}>
          <AduanaMark size={40} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.08em' }}>
            ZAPATA AI
          </span>
        </div>

        <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: '#FFFFFF', textAlign: 'center', marginBottom: 8 }}>
          Solicitar acceso
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 28 }}>
          Inteligencia aduanera para agentes de comercio exterior
        </p>

        {state?.error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
            color: '#F87171', fontSize: 'var(--aguila-fs-body)',
          }}>
            {state.error}
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input name="full_name" label="Nombre del agente" placeholder="Juan García López" required />
          <Input name="email" label="Correo electrónico" type="email" placeholder="juan@agencia.com" required />
          <Input name="firm_name" label="Nombre de la agencia" placeholder="Agencia Aduanal García" required />
          <Input name="patente" label="Patente aduanal" placeholder="3596" required maxLength={5} />
          <div>
            <label style={{ fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 4, display: 'block' }}>
              Aduana principal
            </label>
            <select name="aduana" required style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#FFFFFF', fontSize: 'var(--aguila-fs-section)',
            }}>
              <option value="">Seleccionar...</option>
              {ADUANAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <Input name="telefono" label="Teléfono (opcional)" placeholder="+52 956 123 4567" />

          <button type="submit" disabled={pending} style={{
            marginTop: 8, padding: '14px 20px', borderRadius: 10,
            background: 'var(--gold, #E8EAED)', color: 'rgba(255,255,255,0.03)',
            fontSize: 15, fontWeight: 700, border: 'none', cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}>
            {pending ? 'Enviando...' : 'Solicitar acceso'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 'var(--aguila-fs-compact)', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
          ¿Ya tienes acceso?{' '}
          <Link href="/login" style={{ color: 'var(--gold, #E8EAED)', textDecoration: 'none' }}>
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

function Input({ name, label, type = 'text', placeholder, required, maxLength }: {
  name: string; label: string; type?: string; placeholder?: string; required?: boolean; maxLength?: number
}) {
  return (
    <div>
      <label style={{ fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 4, display: 'block' }}>
        {label}
      </label>
      <input name={name} type={type} placeholder={placeholder} required={required} maxLength={maxLength} style={{
        width: '100%', padding: '10px 14px', borderRadius: 8,
        background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.1)',
        color: '#FFFFFF', fontSize: 'var(--aguila-fs-section)',
      }} />
    </div>
  )
}
