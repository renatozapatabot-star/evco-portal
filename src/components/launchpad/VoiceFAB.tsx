'use client'

import { useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useVapi } from '@/hooks/useVapi'
import VoiceOverlay from './VoiceOverlay'
import VoiceKeyframes from '@/components/voz/VoiceKeyframes'
import { GOLD_GRADIENT } from '@/lib/design-system'

/**
 * Floating Action Button — big gold mic on the launchpad.
 * Taps to start a Vapi voice call. Opens full-screen overlay.
 *
 * 72px diameter (exceeds 60px touch target for 3 AM Driver standard).
 * Fixed position, bottom-right, above any bottom nav.
 */
export default function VoiceFAB() {
  const { status, transcripts, isActive, startCall, stopCall } = useVapi()

  const handleTap = useCallback(async () => {
    if (isActive) {
      await stopCall()
    } else {
      await startCall()
    }
  }, [isActive, startCall, stopCall])

  const handleClose = useCallback(async () => {
    await stopCall()
  }, [stopCall])

  return (
    <>
      <VoiceKeyframes />

      {/* The FAB — visible when not in a call */}
      {!isActive && (
        <button
          onClick={handleTap}
          aria-label="Activar voz AGUILA"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: GOLD_GRADIENT,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 20px rgba(196,150,60,0.4), 0 2px 8px rgba(0,0,0,0.15)`,
            animation: 'pulse 3s ease-in-out infinite',
            zIndex: 1000,
            transition: 'transform 150ms ease',
          }}
          onPointerDown={(e) => { (e.currentTarget.style.transform = 'scale(0.92)') }}
          onPointerUp={(e) => { (e.currentTarget.style.transform = 'scale(1)') }}
          onPointerLeave={(e) => { (e.currentTarget.style.transform = 'scale(1)') }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </button>
      )}

      {/* Full-screen overlay — shown during call */}
      {isActive && typeof document !== 'undefined' && createPortal(
        <VoiceOverlay
          status={status}
          transcripts={transcripts}
          onClose={handleClose}
        />,
        document.body,
      )}
    </>
  )
}
