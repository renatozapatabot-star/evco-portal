'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GOLD, GOLD_HOVER } from '@/lib/design-system'

// ─── Types ────────────────────────────────────────────────────────────────────
type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'

interface ConversationEntry {
  id: string
  userText: string
  assistantText: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<VoiceState, string> = {
  IDLE: 'Toca para hablar',
  LISTENING: 'Escuchando...',
  PROCESSING: 'Procesando...',
  SPEAKING: 'Hablando...',
}

const COLORS = {
  bg: '#0A0A08',
  gold: GOLD,
  goldDark: GOLD_HOVER,
  goldFaint: 'rgba(201,168,76,0.15)',
  white: '#FFFFFF',
  gray: '#888888',
  grayLight: '#AAAAAA',
  grayDark: '#333333',
  red: '#FF4444',
  green: 'var(--success-500)',
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function VozPage() {
  const router = useRouter()

  // State
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE')
  const [interimText, setInterimText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [responseText, setResponseText] = useState('')
  const [history, setHistory] = useState<ConversationEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  const [drivingMode, setDrivingMode] = useState(false)
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'unknown'>('unknown')

  // Refs
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const geoWatchRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ─── Speech Recognition Setup ──────────────────────────────────────────────
  const SpeechRecognition = typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null

  useEffect(() => {
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }
    synthRef.current = window.speechSynthesis
    // Preload voices
    synthRef.current.getVoices()

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
      }
      if (synthRef.current) {
        synthRef.current.cancel()
      }
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current)
      }
    }
  }, [])

  // ─── Driving Mode Detection ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.speed && pos.coords.speed > 5) {
          setDrivingMode(true)
        } else {
          setDrivingMode(false)
        }
      },
      () => {},
      { enableHighAccuracy: false }
    )
    geoWatchRef.current = watchId

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  // Auto-activate listening in driving mode
  useEffect(() => {
    if (drivingMode && voiceState === 'IDLE' && supported) {
      startListening()
    }
  }, [drivingMode])

  // ─── Text-to-Speech ────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!synthRef.current) return

    setVoiceState('SPEAKING')
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-MX'
    utterance.rate = 1.1
    utterance.pitch = 0.9

    const voices = synthRef.current.getVoices()
    const spanishVoice = voices.find(
      (v: SpeechSynthesisVoice) => v.lang.startsWith('es') && v.localService
    )
    if (spanishVoice) utterance.voice = spanishVoice

    utterance.onend = () => {
      setVoiceState('IDLE')
      // In driving mode, auto-restart listening after speaking
      if (drivingMode) {
        setTimeout(() => startListening(), 500)
      }
    }
    utterance.onerror = () => {
      setVoiceState('IDLE')
    }

    synthRef.current.speak(utterance)
  }, [drivingMode])

  // ─── Send to CRUZ API ──────────────────────────────────────────────────────
  const sendToCruz = useCallback(async (transcript: string) => {
    setVoiceState('PROCESSING')
    setError(null)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/cruz-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: transcript }],
          context: { page: '/voz', voice_mode: true },
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        throw new Error(`Error ${res.status}`)
      }

      const data = await res.json()
      const reply = data.reply || data.content || data.message || 'Sin respuesta'

      setResponseText(reply)
      setHistory((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userText: transcript,
          assistantText: reply,
        },
      ])

      speak(reply)
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError('Error al comunicarse con CRUZ. Intenta de nuevo.')
      setVoiceState('IDLE')
    }
  }, [speak])

  // ─── Start Listening ───────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognition) return

    setError(null)
    setInterimText('')
    setFinalText('')
    setResponseText('')

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-MX'
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onstart = () => {
      setVoiceState('LISTENING')
      setMicPermission('granted')
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (interim) setInterimText(interim)
      if (final) {
        setFinalText(final)
        setInterimText('')
      }
    }

    recognition.onend = () => {
      const text = finalText || interimText
      // We need to use a ref-based approach since state may be stale
      recognitionRef.current = null
    }

    recognition.onerror = (event: any) => {
      recognitionRef.current = null
      if (event.error === 'not-allowed') {
        setMicPermission('denied')
        setError('Permiso de micrófono denegado. Habilítalo en la configuración del navegador.')
        setVoiceState('IDLE')
      } else if (event.error === 'no-speech') {
        setError('No se detectó voz. Intenta de nuevo.')
        setVoiceState('IDLE')
      } else if (event.error !== 'aborted') {
        setError('Error de reconocimiento de voz. Intenta de nuevo.')
        setVoiceState('IDLE')
      }
    }

    // Handle final transcript via onend to avoid stale closure
    recognition.addEventListener('end', () => {
      // Get final text from the last result event
    })

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      setInterimText(interim)

      if (final) {
        setFinalText(final)
        setInterimText('')
        // Send to CRUZ when we get a final result
        sendToCruz(final)
      }
    }

    try {
      recognition.start()
    } catch {
      setError('No se pudo iniciar el reconocimiento de voz.')
      setVoiceState('IDLE')
    }
  }, [SpeechRecognition, sendToCruz])

  // ─── Stop Listening ────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    if (synthRef.current) {
      synthRef.current.cancel()
    }
    if (abortRef.current) {
      abortRef.current.abort()
    }
    setVoiceState('IDLE')
  }, [])

  // ─── Orb Tap Handler ──────────────────────────────────────────────────────
  const handleOrbTap = useCallback(() => {
    if (voiceState === 'IDLE') {
      startListening()
    } else {
      stopListening()
    }
  }, [voiceState, startListening, stopListening])

  // ─── Orb Animation Style ──────────────────────────────────────────────────
  const getOrbStyle = (): React.CSSProperties => {
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

  // ─── Render: Unsupported Browser ──────────────────────────────────────────
  if (!supported) {
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
          onClick={() => router.push('/cruz')}
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
          Ir al chat de CRUZ
        </button>
      </div>
    )
  }

  // ─── Render: Main Voice Interface ─────────────────────────────────────────
  return (
    <>
      {/* Keyframe Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(201,168,76,0.3), 0 0 40px rgba(201,168,76,0.1); }
          50% { box-shadow: 0 0 40px rgba(201,168,76,0.6), 0 0 80px rgba(201,168,76,0.2); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes waveBar {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes drivingPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        backgroundColor: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '48px 24px 32px',
        fontFamily: 'var(--font-geist-sans)',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}>

        {/* Driving Mode Badge */}
        {drivingMode && (
          <div style={{
            position: 'absolute',
            top: 16,
            right: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            backgroundColor: 'rgba(34,197,94,0.15)',
            border: `1px solid ${COLORS.green}`,
            borderRadius: 20,
            animation: 'drivingPulse 2s ease-in-out infinite',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2">
              <path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M5 17l-1 3m16-3 1 3" />
              <circle cx="7.5" cy="17" r="1.5" />
              <circle cx="16.5" cy="17" r="1.5" />
            </svg>
            <span style={{ color: COLORS.green, fontSize: 12, fontWeight: 600 }}>
              Modo Conducci&oacute;n
            </span>
          </div>
        )}

        {/* Top Spacer */}
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

          {/* Orb Container */}
          <div
            role="button"
            tabIndex={0}
            aria-label={voiceState === 'IDLE' ? 'Activar micrófono' : 'Detener'}
            onClick={handleOrbTap}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOrbTap() }}
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
                border: `3px solid transparent`,
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
            <div style={getOrbStyle()}>
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

          {/* Status Text */}
          <p style={{
            color: voiceState === 'LISTENING' ? COLORS.gold : COLORS.grayLight,
            fontSize: 16,
            fontWeight: voiceState === 'LISTENING' ? 600 : 400,
            letterSpacing: 0.5,
            margin: 0,
            transition: 'all 0.3s ease',
          }}>
            {STATUS_LABELS[voiceState]}
          </p>

          {/* Transcript Area */}
          <div style={{
            minHeight: 48,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            width: '100%',
          }}>
            {/* Interim (gray) */}
            {interimText && (
              <p style={{
                color: COLORS.gray,
                fontSize: 18,
                textAlign: 'center',
                margin: 0,
                fontStyle: 'italic',
                animation: 'fadeIn 0.2s ease',
              }}>
                {interimText}
              </p>
            )}
            {/* Final (white) */}
            {finalText && !interimText && (
              <p style={{
                color: COLORS.white,
                fontSize: 18,
                textAlign: 'center',
                margin: 0,
                animation: 'fadeIn 0.3s ease',
              }}>
                {finalText}
              </p>
            )}
          </div>

          {/* Response Text (gold) */}
          {responseText && (
            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              width: '100%',
              padding: '16px',
              backgroundColor: 'rgba(201,168,76,0.08)',
              borderRadius: 12,
              border: `1px solid rgba(201,168,76,0.15)`,
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
              fontSize: 13,
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

          {/* Conversation History (last 3) */}
          {history.length > 0 && voiceState === 'IDLE' && (
            <div style={{
              width: '100%',
              marginTop: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              maxHeight: 180,
              overflowY: 'auto',
            }}>
              {history.slice(-3).map((entry) => (
                <div key={entry.id} style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  borderLeft: `2px solid ${COLORS.goldDark}`,
                }}>
                  <p style={{ color: COLORS.grayLight, fontSize: 12, margin: '0 0 4px' }}>
                    {entry.userText}
                  </p>
                  <p style={{ color: COLORS.gold, fontSize: 13, margin: 0, opacity: 0.8 }}>
                    {entry.assistantText.length > 100
                      ? entry.assistantText.slice(0, 100) + '...'
                      : entry.assistantText}
                  </p>
                </div>
              ))}
            </div>
          )}
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
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 1,
            margin: 0,
            opacity: 0.8,
          }}>
            Modo Voz &middot; CRUZ AI
          </p>
          <p style={{
            color: COLORS.gray,
            fontSize: 12,
            margin: 0,
          }}>
            Toca el orbe o di &ldquo;Oye Cruz&rdquo;
          </p>
          <button
            onClick={() => router.push('/')}
            style={{
              marginTop: 8,
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: COLORS.grayLight,
              border: `1px solid ${COLORS.grayDark}`,
              borderRadius: 8,
              fontSize: 13,
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
