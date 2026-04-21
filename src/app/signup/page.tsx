'use client'

import { useActionState } from 'react'
import { signupAction } from './actions'
import Link from 'next/link'
import { AduanaMark } from '@/components/command-center/CommandCenterAguilaMark'
import { AguilaInput, AguilaSelect } from '@/components/aguila'

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
      minHeight: '100vh', background: 'var(--portal-ink-0)',
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
            PORTAL
          </span>
        </div>

        <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: 'var(--portal-fg-1)', textAlign: 'center', marginBottom: 8 }}>
          Solicitar acceso
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 28 }}>
          Inteligencia aduanera para agentes de comercio exterior
        </p>

        {state?.error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
            color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)',
          }}>
            {state.error}
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AguilaInput name="full_name" label="Nombre del agente" placeholder="Juan García López" required />
          <AguilaInput name="email" label="Correo electrónico" type="email" placeholder="juan@agencia.com" required />
          <AguilaInput name="firm_name" label="Nombre de la agencia" placeholder="Agencia Aduanal García" required />
          <AguilaInput name="patente" label="Patente aduanal" placeholder="3596" required maxLength={5} mono />
          <AguilaSelect
            name="aduana"
            label="Aduana principal"
            required
            placeholder="Seleccionar..."
            defaultValue=""
            options={ADUANAS.map((a) => ({ value: a, label: a }))}
          />
          <AguilaInput name="telefono" label="Teléfono (opcional)" placeholder="+52 956 123 4567" type="tel" />

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

