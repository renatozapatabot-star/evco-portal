'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CruzMark } from '@/components/command-center/CruzMark'
import { Suspense } from 'react'

function OnboardingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const slug = searchParams.get('slug') || ''
  const [step, setStep] = useState(1)
  const [seedSample, setSeedSample] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const steps = [
    { num: 1, label: 'Confirmar datos' },
    { num: 2, label: 'Datos de ejemplo' },
    { num: 3, label: 'Clasificación demo' },
    { num: 4, label: 'Listo' },
  ]

  return (
    <div style={{
      minHeight: '100vh', background: '#0D0D0C',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 560, background: '#1A1A1A',
        borderRadius: 20, padding: 40, border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
          <CruzMark size={36} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.08em' }}>
            CRUZ
          </span>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {steps.map(s => (
            <div key={s.num} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s.num <= step ? 'var(--gold, #C9A84C)' : 'rgba(255,255,255,0.1)',
              transition: 'background 300ms',
            }} />
          ))}
        </div>

        {/* Step 1: Confirm */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>
              Confirma los datos de tu agencia
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
              Agencia: <strong style={{ color: '#FFFFFF' }}>{slug}</strong>
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
              Tu cuenta ha sido creada. En el siguiente paso puedes cargar datos de ejemplo para explorar la plataforma.
            </p>
            <button onClick={() => setStep(2)} style={btnStyle}>Continuar →</button>
          </div>
        )}

        {/* Step 2: Sample data */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>
              Datos de ejemplo
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
              ¿Quieres ver CRUZ con datos de ejemplo? Puedes eliminarlos después.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', marginBottom: 20 }}>
              <input type="checkbox" checked={seedSample} onChange={e => setSeedSample(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 14, color: '#FFFFFF' }}>Cargar 10 tráficos de ejemplo (MUESTRA)</span>
            </label>
            <button
              onClick={async () => {
                if (seedSample) {
                  setSeeding(true)
                  try {
                    await fetch('/api/onboarding/seed-sample', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ slug }),
                    })
                  } catch { /* continue anyway */ }
                  setSeeding(false)
                }
                setStep(3)
              }}
              disabled={seeding}
              style={{ ...btnStyle, opacity: seeding ? 0.6 : 1 }}
            >
              {seeding ? 'Cargando datos...' : 'Continuar →'}
            </button>
          </div>
        )}

        {/* Step 3: Classification demo */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>
              Clasificación inteligente
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
              Así es como CRUZ clasifica productos automáticamente:
            </p>
            <div style={{
              padding: '16px 20px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Producto</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 12 }}>
                RESINA DE POLIETILENO DE ALTA DENSIDAD EN PELLETS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <div style={demoField}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Fracción</span>
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--gold)' }}>3901.20.01</span>
                </div>
                <div style={demoField}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>IGI</span>
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#16A34A' }}>0% (T-MEC)</span>
                </div>
                <div style={demoField}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>DTA</span>
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFFFFF' }}>$462 MXN</span>
                </div>
                <div style={demoField}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Confianza</span>
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--gold)' }}>92%</span>
                </div>
              </div>
            </div>
            <button onClick={() => setStep(4)} style={btnStyle}>Continuar →</button>
          </div>
        )}

        {/* Step 4: Ready */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
              🚀
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>
              ¡Listo!
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24 }}>
              Tu agencia ADUANA está activada. El panel de control te espera.
            </p>
            <button onClick={() => router.push('/login')} style={btnStyle}>
              Ir al panel →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: '100%', padding: '14px 20px', borderRadius: 10,
  background: 'var(--gold, #C9A84C)', color: '#1A1A1A',
  fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
}

const demoField: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  display: 'flex', flexDirection: 'column', gap: 2,
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0D0D0C' }} />}>
      <OnboardingContent />
    </Suspense>
  )
}
