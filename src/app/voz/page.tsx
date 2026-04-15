'use client'

import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { STATUS_LABELS, COLORS } from '@/components/voz/types'
import { useVoice } from '@/components/voz/useVoice'
import VoiceKeyframes from '@/components/voz/VoiceKeyframes'
import VoiceOrb from '@/components/voz/VoiceOrb'
import ConversationHistory from '@/components/voz/ConversationHistory'
import DrivingModeBadge from '@/components/voz/DrivingModeBadge'
import UnsupportedBrowser from '@/components/voz/UnsupportedBrowser'

export default function VozPage() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const {
    voiceState, interimText, finalText, responseText,
    history, error, supported, drivingMode, handleOrbTap,
  } = useVoice()

  if (!supported) {
    return <UnsupportedBrowser />
  }

  return (
    <>
      <VoiceKeyframes />

      <div style={{
        minHeight: '100vh',
        backgroundColor: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '24px 16px 24px' : '48px 24px 32px',
        fontFamily: 'var(--font-geist-sans)',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}>

        {drivingMode && <DrivingModeBadge />}

        <div style={{ flex: '0 0 auto' }} />

        {/* Center Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          flex: '1 0 auto',
          justifyContent: 'center',
          maxWidth: 400,
          width: '100%',
        }}>

          <VoiceOrb voiceState={voiceState} onTap={handleOrbTap} />

          {/* Status Text */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            {voiceState === 'PROCESSING' && (
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: COLORS.gold,
                animation: 'pulse-dot 1.2s ease-in-out infinite',
              }} />
            )}
            <p style={{
              color: voiceState === 'LISTENING' ? COLORS.gold : COLORS.grayLight,
              fontSize: 16,
              fontWeight: voiceState === 'LISTENING' || voiceState === 'PROCESSING' ? 600 : 400,
              letterSpacing: 0.5,
              margin: 0,
              transition: 'all 0.3s ease',
            }}>
              {STATUS_LABELS[voiceState]}
            </p>
          </div>

          {/* Transcript Area */}
          <div style={{
            minHeight: 48,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            width: '100%',
          }}>
            {interimText && (
              <p style={{
                color: COLORS.gray,
                fontSize: 'var(--aguila-fs-kpi-small)',
                textAlign: 'center',
                margin: 0,
                fontStyle: 'italic',
                animation: 'fadeIn 0.2s ease',
              }}>
                {interimText}
              </p>
            )}
            {finalText && !interimText && (
              <p style={{
                color: COLORS.white,
                fontSize: 'var(--aguila-fs-kpi-small)',
                textAlign: 'center',
                margin: 0,
                animation: 'fadeIn 0.3s ease',
              }}>
                {finalText}
              </p>
            )}
          </div>

          {/* Response Text */}
          {responseText && (
            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              width: '100%',
              padding: '16px',
              backgroundColor: 'rgba(192,197,206,0.08)',
              borderRadius: 12,
              border: '1px solid rgba(192,197,206,0.15)',
              animation: 'fadeIn 0.4s ease',
            }}>
              <p style={{
                color: COLORS.gold,
                fontSize: 16,
                textAlign: 'center',
                margin: 0,
                lineHeight: 1.6,
              }}>
                {responseText}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p style={{
              color: COLORS.red,
              fontSize: 'var(--aguila-fs-body)',
              textAlign: 'center',
              margin: 0,
              padding: '8px 16px',
              backgroundColor: 'rgba(255,68,68,0.1)',
              borderRadius: 8,
              animation: 'fadeIn 0.3s ease',
            }}>
              {error}
            </p>
          )}

          {voiceState === 'IDLE' && <ConversationHistory history={history} />}
        </div>

        {/* Bottom Section */}
        <div style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          paddingTop: 24,
        }}>
          <p style={{
            color: COLORS.gold,
            fontSize: 'var(--aguila-fs-body)',
            fontWeight: 600,
            letterSpacing: 1,
            margin: 0,
            opacity: 0.8,
          }}>
            Modo Voz &middot; ZAPATA AI
          </p>
          <p style={{
            color: COLORS.gray,
            fontSize: 12,
            margin: 0,
          }}>
            Toca el orbe o di &ldquo;Oye Cruz&rdquo;
          </p>
          <button
            aria-label="Volver al panel principal"
            onClick={() => router.push('/')}
            style={{
              marginTop: 8,
              padding: '14px 24px', minHeight: 60,
              backgroundColor: 'transparent',
              color: COLORS.grayLight,
              border: `1px solid ${COLORS.grayDark}`,
              borderRadius: 8,
              fontSize: 'var(--aguila-fs-body)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.borderColor = COLORS.gold
              ;(e.target as HTMLElement).style.color = COLORS.gold
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.borderColor = COLORS.grayDark
              ;(e.target as HTMLElement).style.color = COLORS.grayLight
            }}
          >
            &larr; Volver al panel
          </button>
        </div>
      </div>
    </>
  )
}
