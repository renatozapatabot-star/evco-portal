'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Send, ArrowRight, Mic, Volume2, ThumbsUp, ThumbsDown, ChevronRight, Square, X } from 'lucide-react'
import { GOLD, GOLD_GRADIENT } from '@/lib/design-system'
import { CLIENT_CLAVE } from '@/lib/client-config'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  navigate?: string
  feedback?: boolean | null
}

const DEFAULT_SUGGESTIONS = [
  '¿Cuántos tráficos en proceso?',
  '¿Qué puente me recomiendas?',
  'Clasifica: polipropileno virgen',
  'Calcula impuestos $50K USD',
  'Resumen ejecutivo del día',
  '¿Cuánto ahorramos en T-MEC?',
]

function buildDynamicPrompts(statusData: any): string[] {
  const prompts: string[] = []
  if (statusData?.urgentes > 0) prompts.push(`${statusData.urgentes} urgentes — ¿qué hago primero?`)
  const hour = new Date().getHours()
  if (hour < 10) prompts.push('Resumen ejecutivo de hoy')
  else if (hour < 15) prompts.push('¿Cómo van los cruces de hoy?')
  else prompts.push('¿Qué queda pendiente para mañana?')
  prompts.push('¿Cuánto podemos ahorrar en T-MEC?')
  prompts.push('Clasifica un producto nuevo')
  prompts.push('¿Qué puente me recomiendas?')
  if (statusData?.enProceso > 0) prompts.push(`${statusData.enProceso} en proceso — resumen`)
  return prompts.slice(0, 6)
}

// Dark theme tokens
const D = {
  bg: '#0D0D0C',
  surface: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F3EE',
  textMuted: 'rgba(245,243,238,0.40)',
  textSub: 'rgba(245,243,238,0.60)',
  userBubble: `rgba(201,168,76,0.15)`,
  userBorder: `rgba(201,168,76,0.25)`,
  aiBubble: 'rgba(255,255,255,0.05)',
  aiBorder: 'rgba(255,255,255,0.08)',
}

export default function CruzChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const traficoContext = searchParams.get('trafico')
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS)

  useEffect(() => {
    fetch('/api/status-summary').then(r => r.json())
      .then(data => setSuggestions(buildDynamicPrompts(data)))
      .catch(() => {})
  }, [])

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try { const saved = sessionStorage.getItem('cruz-chat'); if (saved) return JSON.parse(saved) } catch {}
    }
    return []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'ssr'
    let id = sessionStorage.getItem('cruz-session')
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('cruz-session', id) }
    return id
  })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { if (messages.length > 0) sessionStorage.setItem('cruz-chat', JSON.stringify(messages)) }, [messages])

  // Tráfico context injection
  useEffect(() => {
    if (traficoContext && messages.length === 0) {
      const contextMsg = `Estoy viendo el tráfico ${traficoContext}. ¿Cuál es su estatus actual?`
      sendMessage(contextMsg)
    }
  }, [traficoContext]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    // Add placeholder AI message for streaming
    const aiMsgId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', feedback: null }])

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
      const contextInfo = traficoContext
        ? `User is asking about tráfico ${traficoContext}. Include specific data for this tráfico.`
        : `User is in the CRUZ AI chat interface.`

      const res = await fetch('/api/cruz-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          context: { page: contextInfo, timestamp: new Date().toISOString() },
          sessionId,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || 'Error del servidor')
      }

      const navigate = res.headers.get('X-Navigate') || undefined
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let aiText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        aiText += decoder.decode(value, { stream: true })
        const currentText = aiText
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: currentText, navigate: navigate || undefined } : m
        ))
      }

      // Final update with complete text
      if (!aiText) aiText = 'Sin respuesta.'
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, content: aiText, navigate: navigate || undefined } : m
      ))
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        let suggestion = 'Intenta reformular tu pregunta.'
        if (text.includes('Y') || /^\d{4}/.test(text)) suggestion = 'Verifica el número completo del tráfico.'
        else if (text.length < 5) suggestion = 'Intenta con una pregunta más específica.'
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: `No pude procesar esa consulta. ${suggestion}` } : m
        ))
      }
    } finally { setLoading(false) }
  }, [messages, loading, sessionId, traficoContext])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  // Voice
  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'es-MX'; recognition.interimResults = true; recognition.continuous = false
    recognitionRef.current = recognition
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('')
      setInput(transcript)
      if (event.results[0]?.isFinal) { recognition.stop(); setListening(false); sendMessage(transcript) }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start(); setListening(true)
  }
  const stopVoice = () => { recognitionRef.current?.stop(); setListening(false) }

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, '').replace(/`/g, ''))
    u.lang = 'es-MX'; u.rate = 1.1
    const voices = speechSynthesis.getVoices()
    const spanish = voices.find(v => v.lang.includes('es'))
    if (spanish) u.voice = spanish
    speechSynthesis.speak(u)
  }

  const saveFeedback = async (msgId: string, helpful: boolean) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedback: helpful } : m))
    try { await fetch('/api/cruz-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, helpful }) }) } catch {}
  }

  const linkifyEntities = (text: string): React.ReactNode[] => {
    const traficoPattern = new RegExp(`(${CLIENT_CLAVE}-[A-Z]\\d{4}|[67]\\d{6})`, 'g')
    const traficoTest = new RegExp(`^${CLIENT_CLAVE}-[A-Z]\\d{4}$`)
    const parts = text.split(traficoPattern)
    return parts.map((part, i) => {
      if (traficoTest.test(part))
        return <Link key={i} href={`/traficos/${part}`} style={{ color: GOLD, fontWeight: 700, fontFamily: 'var(--font-data)', textDecoration: 'none', borderBottom: `1px solid rgba(201,168,76,0.4)` }}>{part}</Link>
      if (/^[67]\d{6}$/.test(part))
        return <Link key={i} href={`/pedimentos?search=${part}`} style={{ color: GOLD, fontWeight: 700, fontFamily: 'var(--font-data)', textDecoration: 'none' }}>{part}</Link>
      return <span key={i}>{part}</span>
    })
  }

  const formatMessage = (text: string) => {
    return text.split('\n').map((line, li) => {
      const nodes: React.ReactNode[] = []
      const boldParts = line.split(/(\*\*.*?\*\*)/g)
      boldParts.forEach((seg, si) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          nodes.push(<strong key={`${li}-b-${si}`} style={{ color: D.text, fontWeight: 700 }}>{seg.slice(2, -2)}</strong>)
        } else {
          const codeParts = seg.split(/(`.*?`)/g)
          codeParts.forEach((cp, ci) => {
            if (cp.startsWith('`') && cp.endsWith('`')) {
              nodes.push(<code key={`${li}-cd-${ci}`} style={{ fontFamily: 'var(--font-data)', fontSize: 13, background: 'rgba(201,168,76,0.1)', padding: '1px 5px', borderRadius: 3, color: GOLD }}>{cp.slice(1, -1)}</code>)
            } else {
              nodes.push(...linkifyEntities(cp))
            }
          })
        }
      })
      const isBullet = line.startsWith('- ') || line.startsWith('* ')
      return (
        <span key={li} style={{ display: 'block', marginBottom: 2 }}>
          {isBullet && <span style={{ display: 'inline-block', width: 12, color: GOLD }}>•</span>}
          {isBullet ? linkifyEntities(line.slice(2)) : nodes}
        </span>
      )
    })
  }

  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div style={{ background: D.bg, color: D.text, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${D.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: GOLD_GRADIENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(201,168,76,0.35)',
          }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1710' }}>Z</span>
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: D.text, letterSpacing: '-0.02em', margin: 0 }}>CRUZ</h1>
            <div style={{ fontSize: 12, color: D.textMuted }}>
              {traficoContext ? `Contexto: ${traficoContext}` : '6 herramientas · Voz · Streaming'}
            </div>
          </div>
        </div>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.textMuted, padding: 8 }}>
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16, WebkitOverflowScrolling: 'touch' }}>
        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, paddingTop: 60 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: GOLD_GRADIENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(201,168,76,0.3)',
              marginBottom: 16,
            }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, color: '#1A1710' }}>Z</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: D.text, letterSpacing: '-0.02em' }}>
              {greeting}
            </h2>
            <p style={{ fontSize: 14, color: D.textMuted, marginBottom: 24 }}>
              6 herramientas · Voz · Contexto en tiempo real
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 480, width: '100%' }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{
                  padding: '14px 16px', border: `1px solid ${D.border}`, borderRadius: 12,
                  fontSize: 13, fontWeight: 600, color: D.textSub, cursor: 'pointer',
                  transition: 'all 0.15s', background: 'transparent', textAlign: 'left', lineHeight: 1.4,
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; e.currentTarget.style.color = GOLD }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.textSub }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: 12, maxWidth: msg.role === 'user' ? '75%' : '85%', marginLeft: msg.role === 'user' ? 'auto' : 0, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{
              padding: '12px 18px', borderRadius: msg.role === 'user' ? '16px 16px 2px 16px' : '2px 16px 16px 16px',
              background: msg.role === 'user' ? D.userBubble : D.aiBubble,
              border: `1px solid ${msg.role === 'user' ? D.userBorder : D.aiBorder}`,
              fontSize: 14, lineHeight: 1.6, fontWeight: msg.role === 'user' ? 600 : 400,
              color: D.text,
            }}>
              {msg.role === 'user' ? msg.content : formatMessage(msg.content)}
              {msg.navigate && (
                <div onClick={() => router.push(msg.navigate!)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '8px 12px',
                  background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)',
                  borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: GOLD,
                }}>
                  <ArrowRight size={14} /> Ir a {msg.navigate}
                </div>
              )}
              {msg.role === 'assistant' && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, opacity: 0.4 }}>
                  <button onClick={() => speak(msg.content)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.textMuted, padding: 4 }}><Volume2 size={13} /></button>
                  <button onClick={() => saveFeedback(msg.id, true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.feedback === true ? '#16A34A' : D.textMuted, padding: 4 }}><ThumbsUp size={13} /></button>
                  <button onClick={() => saveFeedback(msg.id, false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.feedback === false ? '#DC2626' : D.textMuted, padding: 4 }}><ThumbsDown size={13} /></button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ padding: '12px 18px', background: D.aiBubble, border: `1px solid ${D.aiBorder}`, borderRadius: '2px 16px 16px 16px', display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: D.textMuted, animation: `typing-dot 1.2s infinite ${i * 0.15}s` }} />
              ))}
            </div>
            <button onClick={() => { abortRef.current?.abort(); setLoading(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', border: `1px solid ${D.border}`, borderRadius: 8, background: 'transparent', fontSize: 11, fontWeight: 600, color: D.textMuted, cursor: 'pointer' }}>
              <Square size={8} fill="currentColor" /> Detener
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '12px 24px 16px', borderTop: `1px solid ${D.border}`, flexShrink: 0, background: D.bg }}>
        {listening && <div style={{ fontSize: 12, color: GOLD, fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>Escuchando...</div>}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <textarea
            ref={inputRef}
            className="cruz-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta sobre tráficos, puentes, impuestos..."
            rows={1}
            disabled={loading}
            style={{
              flex: 1, minHeight: 48, maxHeight: 120, padding: '12px 16px',
              border: `1px solid ${D.border}`, borderRadius: 14,
              fontSize: 15, fontFamily: 'var(--font-ui)', fontWeight: 450,
              color: D.text, resize: 'none', outline: 'none',
              background: D.surface, lineHeight: 1.5,
            }}
          />
          <button
            onClick={listening ? stopVoice : startVoice}
            style={{
              width: 48, height: 48, borderRadius: 14, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: listening ? GOLD : D.surface, color: listening ? '#1A1710' : D.textMuted,
              transition: 'all 0.15s',
            }}
          >
            <Mic size={20} />
          </button>
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              width: 48, height: 48, borderRadius: 14, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: GOLD_GRADIENT, color: '#1A1710',
              opacity: loading || !input.trim() ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <Send size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
