'use client'

import { useState } from 'react'
import { PortalButton } from './PortalButton'

export interface OnboardingStep {
  title: string
  body: string
  /** Step label like "PASO 01 DE 04". */
  k: string
}

export interface PortalOnboardingTourProps {
  open: boolean
  onClose: () => void
  steps?: OnboardingStep[]
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    title: 'Bienvenido a PORTAL.',
    body: 'Tu ventana en vivo a la operación aduanal. 80+ años de experiencia Zapata, reimaginados.',
    k: 'PASO 01 DE 04',
  },
  {
    title: 'Todo empieza con un cruce.',
    body: 'El mapa te muestra tus embarques en tiempo real, tiempos de espera en cada puente, y dónde está cada trailer ahora mismo.',
    k: 'PASO 02 DE 04',
  },
  {
    title: 'Seis módulos, una operación.',
    body: 'Embarques, pedimentos, expedientes, catálogo, entradas, Anexo 24. Cada tarjeta es un atajo al detalle completo.',
    k: 'PASO 03 DE 04',
  },
  {
    title: 'Pregúntale a PORTAL.',
    body: 'Presiona ⌘K en cualquier momento. PORTAL sabe tu patente, tus SKUs y tu historial. "¿Cuánto IVA pagué en marzo?" — listo.',
    k: 'PASO 04 DE 04',
  },
]

/**
 * 4-step onboarding modal — progress bar · eyebrow · display serif title ·
 * body copy · step dots · back/next buttons. Gated by a feature flag at
 * caller level (NEXT_PUBLIC_ONBOARDING_TOUR_ENABLED) + a cookie/localStorage
 * "dismissed" check so it doesn't reshow.
 *
 * Port of .planning/design-handoff/cruz-portal/project/src/screen-dashboard-extras.jsx:263-349.
 */
export function PortalOnboardingTour({
  open,
  onClose,
  steps = DEFAULT_STEPS,
}: PortalOnboardingTourProps) {
  const [step, setStep] = useState(0)
  if (!open) return null
  const s = steps[step]
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={s.title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3,3,4,0.82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'portalFadeUp 300ms var(--portal-ease-out)',
      }}
    >
      <div
        style={{
          width: 'min(520px, 92vw)',
          background: 'var(--portal-ink-2)',
          border: '1px solid var(--portal-line-3)',
          borderRadius: 'var(--portal-r-4)',
          boxShadow: 'var(--portal-shadow-3)',
          padding: 32,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'var(--portal-line-1)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${((step + 1) / steps.length) * 100}%`,
              background: 'var(--portal-green-2)',
              boxShadow: '0 0 12px var(--portal-green-glow)',
              transition: 'width 400ms var(--portal-ease-out)',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 28,
          }}
        >
          <span className="portal-eyebrow">{s.k}</span>
          <button
            onClick={onClose}
            className="portal-meta"
            style={{
              color: 'var(--portal-fg-4)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Omitir
          </button>
        </div>

        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--portal-font-display)',
            fontWeight: 300,
            fontSize: 36,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            color: 'var(--portal-fg-1)',
          }}
        >
          {s.title}
        </h2>
        <p
          style={{
            marginTop: 14,
            fontSize: 'var(--portal-fs-md)',
            color: 'var(--portal-fg-3)',
            lineHeight: 1.55,
          }}
        >
          {s.body}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 36,
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <span
                key={i}
                aria-hidden
                style={{
                  width: i === step ? 24 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === step ? 'var(--portal-green-2)' : 'var(--portal-ink-5)',
                  transition: 'all 300ms var(--portal-ease-out)',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 0 && (
              <PortalButton variant="ghost" onClick={() => setStep(step - 1)}>
                ← Atrás
              </PortalButton>
            )}
            <PortalButton
              variant="primary"
              onClick={() => {
                if (step === steps.length - 1) {
                  onClose()
                } else {
                  setStep(step + 1)
                }
              }}
            >
              {step === steps.length - 1 ? 'Empezar' : 'Siguiente'} →
            </PortalButton>
          </div>
        </div>
      </div>
    </div>
  )
}
