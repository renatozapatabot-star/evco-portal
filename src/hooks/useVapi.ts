'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export type VapiStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'processing'

interface VapiTranscript {
  role: 'user' | 'assistant'
  text: string
}

interface UseVapiReturn {
  status: VapiStatus
  transcripts: VapiTranscript[]
  isActive: boolean
  startCall: () => Promise<void>
  stopCall: () => Promise<void>
}

/**
 * Hook wrapping the @vapi-ai/web SDK for voice calls.
 * Manages call lifecycle, status transitions, and transcript capture.
 */
export function useVapi(): UseVapiReturn {
  const [status, setStatus] = useState<VapiStatus>('idle')
  const [transcripts, setTranscripts] = useState<VapiTranscript[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiRef = useRef<any>(null)
  const isActive = status !== 'idle'

  // Lazy-init Vapi instance
  const getVapi = useCallback(async () => {
    if (vapiRef.current) return vapiRef.current
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
    if (!publicKey) {
      console.error('CRUZ Voice: NEXT_PUBLIC_VAPI_PUBLIC_KEY not set')
      return null
    }
    const { default: Vapi } = await import('@vapi-ai/web')
    const instance = new Vapi(publicKey)
    vapiRef.current = instance
    return instance
  }, [])

  // Set up event listeners
  useEffect(() => {
    let vapi = vapiRef.current
    if (!vapi) return

    const onCallStart = () => setStatus('listening')
    const onCallEnd = () => {
      setStatus('idle')
    }
    const onSpeechStart = () => setStatus('listening')
    const onSpeechEnd = () => setStatus('processing')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMessage = (msg: any) => {
      if (msg.type === 'transcript') {
        if (msg.transcriptType === 'final') {
          setTranscripts(prev => [...prev, { role: msg.role, text: msg.transcript }])
        }
      } else if (msg.type === 'speech-update') {
        if (msg.status === 'started' && msg.role === 'assistant') {
          setStatus('speaking')
        } else if (msg.status === 'stopped' && msg.role === 'assistant') {
          setStatus('listening')
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onError = (err: any) => {
      console.error('CRUZ Voice error:', err)
      setStatus('idle')
    }

    vapi.on('call-start', onCallStart)
    vapi.on('call-end', onCallEnd)
    vapi.on('speech-start', onSpeechStart)
    vapi.on('speech-end', onSpeechEnd)
    vapi.on('message', onMessage)
    vapi.on('error', onError)

    return () => {
      vapi = vapiRef.current
      if (!vapi) return
      vapi.removeListener('call-start', onCallStart)
      vapi.removeListener('call-end', onCallEnd)
      vapi.removeListener('speech-start', onSpeechStart)
      vapi.removeListener('speech-end', onSpeechEnd)
      vapi.removeListener('message', onMessage)
      vapi.removeListener('error', onError)
    }
  }, [status]) // Re-bind when vapi instance changes

  const startCall = useCallback(async () => {
    const vapi = await getVapi()
    if (!vapi) return
    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID
    if (!assistantId) {
      console.error('CRUZ Voice: NEXT_PUBLIC_VAPI_ASSISTANT_ID not set')
      return
    }
    setTranscripts([])
    setStatus('connecting')
    try {
      await vapi.start(assistantId)
    } catch (err) {
      console.error('CRUZ Voice: Failed to start call:', err)
      setStatus('idle')
    }
  }, [getVapi])

  const stopCall = useCallback(async () => {
    const vapi = vapiRef.current
    if (!vapi) return
    try {
      await vapi.stop()
    } catch {
      // Call may already be ended
    }
    setStatus('idle')
  }, [])

  return { status, transcripts, isActive, startCall, stopCall }
}
