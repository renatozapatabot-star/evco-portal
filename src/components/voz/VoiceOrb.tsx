'use client'

import type { VoiceState } from './types'
import { COLORS } from './types'

interface VoiceOrbProps {
  voiceState: VoiceState
  onTap: () => void
}

function getOrbStyle(voiceState: VoiceState): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: `radial-gradient(circle at 35% 35%, ${COLORS.gold}, ${COLORS.goldDark})`,
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.3s ease',
  }

  switch (voiceState) {
    case 'IDLE':
      return {
        ...base,
        animation: 'pulse 3s ease-in-out infinite, glow 3s ease-in-out infinite',
      }
    case 'LISTENING':
      return {
        ...base,
        animation: 'pulse 1s ease-in-out infinite, glow 1s ease-in-out infinite',
        transform: 'scale(1.1)',
        boxShadow: `0 0 40px ${COLORS.gold}, 0 0 80px ${COLORS.goldFaint}`,
      }
    case 'PROCESSING':
      return {
        ...base,
        animation: 'spin 1.5s linear infinite',
        boxShadow: `0 0 30px ${COLORS.goldFaint}`,
      }
    case 'SPEAKING':
      return {
        ...base,
        animation: 'pulse 0.6s ease-in-out infinite, glow 0.8s ease-in-out infinite',
        boxShadow: `0 0 50px ${COLORS.gold}`,
      }
  }
}

export default function VoiceOrb({ voiceState, onTap }: VoiceOrbProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={voiceState === 'IDLE' ? 'Activar microfono' : 'Detener'}
      onClick={onTap}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTap() }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 120,
        height: 120,
      }}
    >
      {/* Processing ring */}
      {voiceState === 'PROCESSING' && (
        <div style={{
          position: 'absolute',
          width: 100,
          height: 100,
          borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: COLORS.gold,
          borderRightColor: COLORS.goldDark,
          animation: 'spin 1s linear infinite',
        }} />
      )}

      {/* Speaking wave bars */}
      {voiceState === 'SPEAKING' && (
        <div style={{
          position: 'absolute',
          bottom: -8,
          display: 'flex',
          gap: 3,
          alignItems: 'flex-end',
          height: 20,
        }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: 16,
                backgroundColor: COLORS.gold,
                borderRadius: 2,
                animation: `waveBar 0.6s ease-in-out ${i * 0.1}s infinite`,
                transformOrigin: 'bottom',
              }}
            />
          ))}
        </div>
      )}

      {/* The Orb */}
      <div style={getOrbStyle(voiceState)}>
        {/* Microphone icon inside orb */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: voiceState === 'PROCESSING' ? 0.5 : 0.9,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLORS.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </div>
      </div>
    </div>
  )
}
