'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Send, ArrowRight, Mic, Volume2, ThumbsUp, ThumbsDown, Sun, ChevronRight, Square } from 'lucide-react'

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

const getPageContext = (): string => {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  const contexts: Record<string, string> = {
    '/': 'User is on the main dashboard',
    '/traficos': 'User is viewing the shipments list',
    '/entradas': 'User is viewing warehouse entries',
    '/pedimentos': 'User is viewing customs declarations',
    '/expedientes': 'User is viewing digital document files',
    '/reportes': 'User is viewing analytics and reports',
    '/cuentas': 'User is viewing financial accounts',
    '/anexo24': 'User is viewing Anexo 24 IMMEX reconciliation',
    '/cruz': 'User is in the CRUZ AI chat interface',
  }
  return contexts[path] || 'User is on the portal'
}

export default function CruzChatPage() {
  const router = useRouter()
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
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingExpanded, setBriefingExpanded] = useState(false)
  const [briefingDismissed, setBriefingDismissed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'ssr'
    let id = sessionStorage.getItem('cruz-session')
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('cruz-session', id) }
    return id
  })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { if (messages.length > 0) sessionStorage.setItem('cruz-chat', JSON.stringify(messages)) }, [messages])

  // Proactive briefing on first load
  useEffect(() => {
    if (messages.length > 0) return
    setBriefingLoading(true)
    fetch('/api/cruz-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Dame un resumen ejecutivo rapido de hoy. Incluye: traficos pendientes, valor total, MVE status, y la accion mas urgente. Se conciso, maximo 4 lineas.' }],
        context: { page: 'Proactive briefing on page load', auto: true }, sessionId,
      }),
    }).then(r => r.json()).then(data => setBriefing(data.message)).catch(() => {}).finally(() => setBriefingLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/cruz-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, context: { page: getPageContext(), timestamp: new Date().toISOString() }, sessionId }),
        signal: controller.signal,
      })
      const data = await res.json()
      const aiMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: data.message || 'Sin respuesta.', navigate: data.navigate || undefined, feedback: null }
      setMessages(prev => [...prev, aiMsg])
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const lastInput = text.trim()
        let suggestion = 'Intenta reformular tu pregunta o usa una de las sugerencias.'
        if (lastInput.includes('Y') || /^\d{4}/.test(lastInput)) {
          suggestion = 'Verifica el número completo del tráfico. Ej: CLAVE-Y4466'
        } else if (lastInput.length < 5) {
          suggestion = 'Intenta con una pregunta más específica. Ej: "¿Cuántos tráficos están en proceso?"'
        }
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `No pude procesar esa consulta. ${suggestion}`, feedback: null }])
      }
    } finally { setLoading(false) }
  }, [messages, loading, sessionId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  // Voice input
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

  // Voice output
  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, '').replace(/`/g, ''))
    u.lang = 'es-MX'; u.rate = 1.1
    const voices = speechSynthesis.getVoices()
    const spanish = voices.find(v => v.lang.includes('es'))
    if (spanish) u.voice = spanish
    speechSynthesis.speak(u)
  }

  // Feedback
  const saveFeedback = async (msgId: string, helpful: boolean) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedback: helpful } : m))
    try { await fetch('/api/cruz-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, helpful }) }) } catch {}
  }

  const linkifyEntities = (text: string): React.ReactNode[] => {
    const parts = text.split(/(9254-Y\d{4}|[67]\d{6})/g)
    return parts.map((part, i) => {
      if (/^9254-Y\d{4}$/.test(part))
        return <Link key={i} href={`/traficos/${part}`} className="cruz-entity">{part}</Link>
      if (/^[67]\d{6}$/.test(part))
        return <Link key={i} href={`/pedimentos?search=${part}`} className="cruz-entity">{part}</Link>
      return <span key={i}>{part}</span>
    })
  }

  const formatMessage = (text: string) => {
    return text.split('\n').map((line, li) => {
      const nodes: React.ReactNode[] = []
      // Bold
      const boldParts = line.split(/(\*\*.*?\*\*)/g)
      boldParts.forEach((seg, si) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          nodes.push(<strong key={`${li}-b-${si}`}>{seg.slice(2, -2)}</strong>)
        } else if (seg.startsWith('`') && seg.endsWith('`')) {
          nodes.push(<code key={`${li}-c-${si}`}>{seg.slice(1, -1)}</code>)
        } else {
          // Entity link inside text
          const codeParts = seg.split(/(`.*?`)/g)
          codeParts.forEach((cp, ci) => {
            if (cp.startsWith('`') && cp.endsWith('`')) {
              nodes.push(<code key={`${li}-cd-${ci}`}>{cp.slice(1, -1)}</code>)
            } else {
              nodes.push(...linkifyEntities(cp))
            }
          })
        }
      })
      const isBullet = line.startsWith('- ') || line.startsWith('* ')
      return (
        <span key={li} style={{ display: 'block', marginBottom: 2 }}>
          {isBullet && <span style={{ display: 'inline-block', width: 12, color: 'var(--gold-500)' }}>•</span>}
          {isBullet ? nodes.map((n, i) => i === 0 && typeof n === 'object' ? null : n) : nodes}
          {isBullet ? linkifyEntities(line.slice(2)) : null}
        </span>
      )
    })
  }

  const greeting = new Date().getHours() < 12 ? 'Buenos dias' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="cruz-chat">
      <div className="cruz-chat-header">
        <div className="cruz-chat-icon"><span>Z</span></div>
        <div>
          <div className="cruz-chat-title">CRUZ Intelligence</div>
          <div className="cruz-chat-sub">17 herramientas &middot; Voz &middot; Contexto en tiempo real</div>
        </div>
      </div>

      <div className="cruz-messages">
        {messages.length === 0 && !loading && (
          <div className="cruz-suggestions">
            {/* Collapsed briefing strip */}
            {!briefingDismissed && (briefing || briefingLoading) && (
              <div className={`cruz-briefing-strip ${briefingExpanded ? 'cruz-briefing-strip--expanded' : ''}`}>
                <div className="cruz-briefing-strip-bar" onClick={() => !briefingLoading && setBriefingExpanded(prev => !prev)}>
                  <div className="cruz-briefing-strip-summary">
                    {briefingLoading ? (
                      <span className="cruz-briefing-strip-text">☀️ Cargando resumen...</span>
                    ) : (
                      <span className="cruz-briefing-strip-text">☀️ {(() => {
                        const text = briefing || ''
                        const enProcesoMatch = text.match(/(\d+)\s*(?:tráficos?\s*)?(?:en\s*proceso|pendientes?|activos?)/i)
                        const mveMatch = text.match(/MVE[:\s]*(\d+)\s*d/i) || text.match(/(\d+)\s*días?\s*(?:para\s*)?MVE/i)
                        const enProceso = enProcesoMatch ? enProcesoMatch[1] : '—'
                        const mveDays = mveMatch ? mveMatch[1] : '—'
                        return `${enProceso} en proceso · MVE ${mveDays}d · Haz clic para detalles`
                      })()}</span>
                    )}
                  </div>
                  <ChevronRight size={14} className="cruz-briefing-strip-chevron" />
                </div>
                {briefingExpanded && briefing && (
                  <div className="cruz-briefing-strip-detail">
                    {formatMessage(briefing)}
                  </div>
                )}
              </div>
            )}

            <div className="cruz-ai-hero">
              <div className="cruz-chat-icon"><span>Z</span></div>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: 'var(--n-900)', marginTop: 16, letterSpacing: '-0.02em' }}>
                CRUZ Intelligence
              </h2>
              <p style={{ fontSize: 15, color: 'var(--n-400)', marginTop: 6 }}>
                17 herramientas &middot; Voz &middot; Contexto en tiempo real
              </p>
            </div>
            <div className="cruz-prompts-grid">
              {suggestions.map(s => (
                <button key={s} className="cruz-suggestion" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`cruz-msg cruz-msg-${msg.role === 'user' ? 'user' : 'ai'}`}>
            <div className={`cruz-bubble cruz-bubble-${msg.role === 'user' ? 'user' : 'ai'}`}>
              {msg.role === 'user' ? msg.content : formatMessage(msg.content)}
              {msg.navigate && (
                <div className="cruz-nav-card" onClick={() => router.push(msg.navigate!)}>
                  <ArrowRight size={14} /> Ir a {msg.navigate}
                </div>
              )}
              {msg.role === 'assistant' && (
                <div className="cruz-feedback">
                  <button className="cruz-speak" onClick={() => speak(msg.content)} aria-label="Escuchar"><Volume2 size={13} /></button>
                  <button className={`cruz-fb-btn ${msg.feedback === true ? 'cruz-fb-active' : ''}`} onClick={() => saveFeedback(msg.id, true)} aria-label="Util"><ThumbsUp size={13} /></button>
                  <button className={`cruz-fb-btn ${msg.feedback === false ? 'cruz-fb-active-bad' : ''}`} onClick={() => saveFeedback(msg.id, false)} aria-label="No util"><ThumbsDown size={13} /></button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <>
            <div className="cruz-msg cruz-msg-ai">
              <div className="cruz-bubble cruz-bubble-ai">
                <div className="cruz-typing">
                  <div className="cruz-typing-dot" /><div className="cruz-typing-dot" /><div className="cruz-typing-dot" />
                </div>
              </div>
            </div>
            <button onClick={() => { abortRef.current?.abort(); setLoading(false) }}
              style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 14px',border:'var(--b-default)',borderRadius:'var(--r-md)',background:'var(--bg-card)',fontSize:12,fontWeight:600,color:'var(--n-500)',cursor:'pointer',margin:'8px auto' }}>
              <Square size={10} fill="currentColor" /> Detener
            </button>
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="cruz-input-area">
        {listening && <div className="cruz-listening-text">Escuchando...</div>}
        <div className="cruz-input-row">
          <textarea ref={inputRef} className="cruz-input" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown} placeholder="Pregunta sobre traficos, pedimentos, puentes, impuestos..."
            rows={1} disabled={loading} />
          <button className={`cruz-mic ${listening ? 'cruz-mic-active' : ''}`}
            onClick={listening ? stopVoice : startVoice} aria-label={listening ? 'Dejar de escuchar' : 'Hablar'}>
            <Mic size={20} />
          </button>
          <button className="cruz-send" onClick={() => sendMessage(input)} disabled={loading || !input.trim()} aria-label="Enviar">
            <Send size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
