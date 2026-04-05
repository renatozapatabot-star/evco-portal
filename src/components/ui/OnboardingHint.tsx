'use client'

/**
 * Contextual onboarding tooltip — gold-tinted, with "Entendido" dismiss.
 * Shows max 1 per session. The product teaches itself.
 */

interface OnboardingHintProps {
  text: string
  onDismiss: () => void
}

export function OnboardingHint({ text, onDismiss }: OnboardingHintProps) {
  return (
    <div style={{
      background: 'rgba(196,150,60,0.06)',
      border: '1px solid rgba(196,150,60,0.2)',
      borderRadius: 12,
      padding: '12px 16px',
      maxWidth: 320,
      animation: 'fadeInUp 200ms ease',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💡</span>
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: 13,
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          margin: '0 0 8px',
        }}>
          {text}
        </p>
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--gold)',
            padding: 0,
          }}
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
