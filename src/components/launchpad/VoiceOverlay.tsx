'use client'

import { useEffect, useRef } from 'react'
import VoiceOrb from '@/components/voz/VoiceOrb'
import VoiceKeyframes from '@/components/voz/VoiceKeyframes'
import { STATUS_LABELS, COLORS } from '@/components/voz/types'
import type { VoiceState } from '@/components/voz/types'
import type { VapiStatus } from '@/hooks/useVapi'

interface VoiceOverlayProps {
  status: VapiStatus
  transcripts: Array<{ role: 'user' | 'assistant'; text: string }>
  onClose: () => void
}

/** Map Vapi status to VoiceOrb state */
function toVoiceState(status: VapiStatus): VoiceState {
  switch (status) {
    case 'connecting':
    case 'processing':
      return 'PROCESSING'
    case 'listening':
      return 'LISTENING'
    case 'speaking':
      return 'SPEAKING'
    default:
      return 'IDLE'
  }
}

/** Detect tel: URLs in assistant responses */
function extractPhoneNumber(text: string): string | null {
  // Match phone numbers: +52..., +1..., or standalone digits
  const match = text.match(/(\+?\d[\d\s\-()]{7,15}\d)/)
  if (!match) return null
  const clean = match[1].replace(/[\s\-()]/g, '')
  return clean.startsWith('+') ? clean : `+${clean}`
}

export default function VoiceOverlay({ status, transcripts, onClose }: VoiceOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const voiceState = toVoiceState(status)

  // Auto-scroll to bottom on new transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcripts])

  // Find phone number in latest assistant message for "Llamar" button
  const lastAssistant = [...transcripts].reverse().find(t => t.role === 'assistant')
  const phoneNumber = lastAssistant ? extractPhoneNumber(lastAssistant.text) : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#05070B',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 200ms ease-out',
      }}
    >
      <VoiceKeyframes />

      {/* Close / end call button */}
      <button
        onClick={onClose}
        aria-label="Terminar llamada"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          color: '#FFFFFF',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>

      {/* Status label */}
      <p style={{ color: COLORS.grayLight, fontSize: 14, marginBottom: 24, letterSpacing: 1 }}>
        {STATUS_LABELS[voiceState]}
      </p>

      {/* The Orb */}
      <div onClick={onClose} style={{ cursor: 'pointer' }}>
        <VoiceOrb voiceState={voiceState} onTap={onClose} />
      </div>

      {/* Transcript area */}
      <div
        ref={scrollRef}
        style={{
          marginTop: 32,
          width: '100%',
          maxWidth: 400,
          maxHeight: 200,
          overflowY: 'auto',
          padding: '0 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {transcripts.map((t, i) => (
          <p
            key={i}
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.5,
              color: t.role === 'user' ? '#FFFFFF' : COLORS.gold,
              textAlign: t.role === 'user' ? 'right' : 'left',
              opacity: 0.9,
            }}
          >
            {t.text}
          </p>
        ))}
      </div>

      {/* Phone call button — appears when CRUZ returns a phone number */}
      {phoneNumber && (
        <a
          href={`tel:${phoneNumber}`}
          style={{
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 28px',
            borderRadius: 12,
            background: COLORS.gold,
            color: '#05070B',
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
            minHeight: 60,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          Llamar {phoneNumber}
        </a>
      )}

      {/* Instruction */}
      <p style={{ position: 'absolute', bottom: 32, color: COLORS.grayLight, fontSize: 13, opacity: 0.6 }}>
        Toca el orbe para terminar
      </p>
    </div>
  )
}
