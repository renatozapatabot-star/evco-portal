'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { VoiceState, ConversationEntry } from './types'

export interface UseVoiceReturn {
  voiceState: VoiceState
  interimText: string
  finalText: string
  responseText: string
  history: ConversationEntry[]
  error: string | null
  supported: boolean
  drivingMode: boolean
  handleOrbTap: () => void
}

export function useVoice(): UseVoiceReturn {
  // State
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE')
  const [interimText, setInterimText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [responseText, setResponseText] = useState('')
  const [history, setHistory] = useState<ConversationEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  const [drivingMode, setDrivingMode] = useState(false)
  const [, setMicPermission] = useState<'granted' | 'denied' | 'unknown'>('unknown')

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const geoWatchRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Speech Recognition constructor
  const SpeechRecognitionCtor = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

  // ---- Speech Recognition Setup ----
  useEffect(() => {
    if (!SpeechRecognitionCtor) {
      setSupported(false)
      return
    }
    synthRef.current = window.speechSynthesis
    synthRef.current.getVoices()

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch { /* ignored */ }
      }
      if (synthRef.current) {
        synthRef.current.cancel()
      }
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current)
      }
    }
  }, [])

  // ---- Driving Mode Detection ----
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDrivingMode(!!(pos.coords.speed && pos.coords.speed > 5))
      },
      () => {},
      { enableHighAccuracy: false }
    )
    geoWatchRef.current = watchId

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  // ---- Text-to-Speech ----
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
      if (drivingMode) {
        setTimeout(() => startListening(), 500)
      }
    }
    utterance.onerror = () => {
      setVoiceState('IDLE')
    }

    synthRef.current.speak(utterance)
  }, [drivingMode])

  // ---- Send to CRUZ API ----
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('Error al comunicarse con AGUILA. Intenta de nuevo.')
      setVoiceState('IDLE')
    }
  }, [speak])

  // ---- Start Listening ----
  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) return

    setError(null)
    setInterimText('')
    setFinalText('')
    setResponseText('')

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'es-MX'
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onstart = () => {
      setVoiceState('LISTENING')
      setMicPermission('granted')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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
        sendToCruz(final)
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
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

    try {
      recognition.start()
    } catch {
      setError('No se pudo iniciar el reconocimiento de voz.')
      setVoiceState('IDLE')
    }
  }, [SpeechRecognitionCtor, sendToCruz])

  // ---- Stop Listening ----
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignored */ }
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

  // ---- Orb Tap Handler ----
  const handleOrbTap = useCallback(() => {
    if (voiceState === 'IDLE') {
      startListening()
    } else {
      stopListening()
    }
  }, [voiceState, startListening, stopListening])

  // Auto-activate listening in driving mode
  useEffect(() => {
    if (drivingMode && voiceState === 'IDLE' && supported) {
      startListening()
    }
  }, [drivingMode])

  return {
    voiceState,
    interimText,
    finalText,
    responseText,
    history,
    error,
    supported,
    drivingMode,
    handleOrbTap,
  }
}
