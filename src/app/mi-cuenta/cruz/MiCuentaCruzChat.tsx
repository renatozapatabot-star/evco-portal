'use client'

/**
 * PORTAL · /mi-cuenta/cruz · client chat component.
 *
 * Streams to /api/cruz-chat with `mode: 'mi-cuenta-safe'`, which the
 * route honors to filter tools to SAFE_CLIENT_TOOL_NAMES and swap the
 * system prompt to the calm-tone variant. See
 * `src/lib/mi-cuenta/cruz-safe.ts` for the contract.
 *
 * History persistence is namespaced so it never collides with the
 * regular /cruz operator surface (`cruz-chat-history` vs
 * `mi-cuenta-cruz-history`). Company-scoped: switching tenants clears
 * history to avoid cross-tenant memory bleed.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { AguilaMark } from '@/components/brand/AguilaMark'
import ChatMessageList, { type Message } from '@/components/aguila/ChatMessageList'
import ChatInputBar from '@/components/aguila/ChatInputBar'
import { getCompanyIdCookie } from '@/lib/client-config'
import { MI_CUENTA_CRUZ_MODE } from '@/lib/mi-cuenta/cruz-safe'

const HISTORY_KEY = 'mi-cuenta-cruz-history'
const COMPANY_KEY = 'mi-cuenta-cruz-company'

export default function MiCuentaCruzChat({ isClient }: { isClient: boolean }) {
  // Session id is only used by the API for rate-limit keys + audit.
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'ssr'
    let id = sessionStorage.getItem('mi-cuenta-cruz-session')
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem('mi-cuenta-cruz-session', id)
    }
    return id
  })

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const currentCompany = getCompanyIdCookie()
      const savedCompany = localStorage.getItem(COMPANY_KEY)
      if (savedCompany && savedCompany !== currentCompany) {
        localStorage.removeItem(HISTORY_KEY)
        localStorage.setItem(COMPANY_KEY, currentCompany)
        return []
      }
      localStorage.setItem(COMPANY_KEY, currentCompany)
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) return (JSON.parse(saved) as Message[]).slice(-50)
    } catch {
      /* ignore parse errors */
    }
    return []
  })

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<InstanceType<NonNullable<typeof window.SpeechRecognition>> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-50)))
    }
  }, [messages])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return
      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setLoading(true)

      const controller = new AbortController()
      abortRef.current = controller

      const aiMsgId = crypto.randomUUID()
      setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', feedback: null }])

      try {
        const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.content }))
        const res = await fetch('/api/cruz-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            context: { page: '/mi-cuenta/cruz', timestamp: new Date().toISOString() },
            sessionId,
            mode: MI_CUENTA_CRUZ_MODE,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ message: 'No disponible en este momento.' }))
          const serverMsg = errData.message || 'No disponible en este momento.'
          setMessages(prev => prev.map(m => (m.id === aiMsgId ? { ...m, content: serverMsg } : m)))
          setLoading(false)
          return
        }

        const navigate = res.headers.get('X-Navigate') || undefined
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let aiText = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          aiText += decoder.decode(value, { stream: true })
          const current = aiText
          setMessages(prev => prev.map(m => (m.id === aiMsgId ? { ...m, content: current, navigate: navigate || undefined } : m)))
        }

        if (!aiText) aiText = 'Sin respuesta. ¿Quieres que le avisemos a Anabel por Mensajería?'
        setMessages(prev => prev.map(m => (m.id === aiMsgId ? { ...m, content: aiText, navigate: navigate || undefined } : m)))
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setMessages(prev =>
            prev.map(m =>
              m.id === aiMsgId
                ? { ...m, content: 'No pudimos procesar tu pregunta. Intenta reformularla o escríbele a Anabel por Mensajería.' }
                : m,
            ),
          )
        }
      } finally {
        setLoading(false)
      }
    },
    [messages, loading, sessionId],
  )

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'es-MX'
    recognition.interimResults = true
    recognition.continuous = false
    recognitionRef.current = recognition
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results).map((r: SpeechRecognitionResult) => r[0].transcript).join('')
      setInput(transcript)
      if (event.results[0]?.isFinal) {
        recognition.stop()
        setListening(false)
        sendMessage(transcript)
      }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
    setListening(true)
    setTimeout(() => {
      try {
        recognition.stop()
      } catch {
        /* ignore */
      }
      setListening(false)
    }, 10000)
  }
  const stopVoice = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, '').replace(/`/g, ''))
    u.lang = 'es-MX'
    u.rate = 1.1
    const voices = speechSynthesis.getVoices()
    const spanish = voices.find(v => v.lang.includes('es'))
    if (spanish) u.voice = spanish
    speechSynthesis.speak(u)
  }

  const saveFeedback = async (msgId: string, helpful: boolean) => {
    setMessages(prev => prev.map(m => (m.id === msgId ? { ...m, feedback: helpful } : m)))
    try {
      await fetch('/api/cruz-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, helpful }),
      })
    } catch {
      /* best-effort */
    }
  }

  const handleAbort = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  const clearHistory = () => {
    setMessages([])
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      style={{
        background: 'var(--aguila-bg-deep)',
        color: 'var(--aguila-text-primary)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 56px)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--portal-ink-0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: 'drop-shadow(0 0 10px rgba(192,197,206,0.2))',
            }}
          >
            <AguilaMark size={40} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--aguila-fs-body, 13px)',
                color: 'var(--aguila-text-primary)',
                fontWeight: 600,
              }}
            >
              Asistente — tu cuenta
            </div>
            <div
              style={{
                fontSize: 'var(--aguila-fs-compact, 11px)',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              {isClient ? 'Respuestas sobre tu operación · Anabel te responde por Mensajería' : 'Vista interna · superficie cliente'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={clearHistory}
            style={{
              fontSize: 'var(--aguila-fs-compact, 11px)',
              color: 'rgba(255,255,255,0.45)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              minHeight: 60,
            }}
          >
            Nueva conversación
          </button>
          <Link
            href="/mi-cuenta"
            style={{
              fontSize: 'var(--aguila-fs-compact, 11px)',
              color: 'rgba(255,255,255,0.45)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 60,
            }}
          >
            <ArrowLeft size={14} />
            Volver a tu cuenta
          </Link>
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ChatMessageList
          messages={messages}
          loading={loading}
          sendMessage={sendMessage}
          saveFeedback={saveFeedback}
          speak={speak}
          onAbort={handleAbort}
        />
        <ChatInputBar
          input={input}
          setInput={setInput}
          loading={loading}
          listening={listening}
          onSend={sendMessage}
          onStartVoice={startVoice}
          onStopVoice={stopVoice}
          onAbort={handleAbort}
        />
      </div>

      {/* Paired Mensajería CTA — every A/R answer should land here.
          Rendered inside the shell so the client can escalate to a
          human without leaving the chat. */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          ¿Dudas de cobranza, montos o trámites? Anabel te responde.
        </div>
        <Link
          href="/mensajeria?to=anabel&topic=cuenta"
          style={{
            padding: '8px 14px',
            borderRadius: 12,
            border: '1px solid rgba(192,197,206,0.18)',
            background: 'rgba(192,197,206,0.06)',
            color: 'var(--aguila-text-primary)',
            fontSize: 'var(--aguila-fs-compact, 11px)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
            whiteSpace: 'nowrap',
          }}
        >
          <MessageSquare size={12} />
          Abrir Mensajería
        </Link>
      </div>
    </div>
  )
}
