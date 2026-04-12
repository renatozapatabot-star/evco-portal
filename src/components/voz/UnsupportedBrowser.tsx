'use client'

import { COLORS } from './types'

export default function UnsupportedBrowser() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: COLORS.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'var(--font-geist-sans)',
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: COLORS.grayDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={COLORS.gray} strokeWidth="2">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </div>
      <p style={{ color: COLORS.white, fontSize: 18, textAlign: 'center', marginBottom: 8 }}>
        Modo Voz no disponible
      </p>
      <p style={{ color: COLORS.gray, fontSize: 14, textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
        Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.
      </p>
      <button
        onClick={() => document.dispatchEvent(new CustomEvent('cruz:open-chat'))}
        style={{
          marginTop: 32,
          padding: '12px 24px',
          backgroundColor: COLORS.goldFaint,
          color: COLORS.gold,
          border: `1px solid ${COLORS.goldDark}`,
          borderRadius: 8,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Ir al chat de AGUILA
      </button>
    </div>
  )
}
