'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Send, ArrowRight, Mic, Volume2, ThumbsUp, ThumbsDown, ChevronRight, Square, X, AlertTriangle, Clock, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { GOLD, GOLD_GRADIENT } from '@/lib/design-system'
import { CLIENT_CLAVE, COMPANY_ID } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { getMostActionableChips, PriorityChip } from '@/lib/cruz-priority'

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

// Warm cream theme — AI bubbles dark, everything else light
const D = {
  bg: '#F7F6F3',
  surface: '#FFFFFF',
  border: '#E8E5E0',
  text: '#1A1A18',
  textMuted: '#9C9890',
  textSub: '#6B6B6B',
  userBubble: 'rgba(184,149,63,0.08)',
  userBorder: 'rgba(184,149,63,0.20)',
  aiBubble: '#1A1A18',
  aiBorder: '#2A2A28',
  aiText: '#E8E5DF',
}

interface BriefingData {
  enProceso: number
  urgent: number
  alertTitle: string | null
}

export default function CruzChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const traficoContext = searchParams.get('trafico')
  const isMobile = useIsMobile()
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS)
  const [priorityChips, setPriorityChips] = useState<PriorityChip[]>([])
  const [cruzAlerts, setCruzAlerts] = useState<{ icon: string; title: string; action: string; prompt: string }[]>([])

  // Briefing state
  const [briefing, setBriefing] = useState<string>('Cargando resumen operativo...')
  const [panelData, setPanelData] = useState<{ enProceso: any[]; urgent: any[]; alertTitle: string | null }>({
    enProceso: [], urgent: [], alertTitle: null,
  })

  useEffect(() => {
    fetch('/api/status-summary').then(r => r.json())
      .then(data => setSuggestions(buildDynamicPrompts(data)))
      .catch(() => {})
    fetch('/api/cruz-alerts').then(r => r.json())
      .then(data => setCruzAlerts(data.alerts ?? []))
      .catch(() => {})
  }, [])

  // Proactive briefing fetch
  useEffect(() => {
    Promise.all([
      fetch(`/api/data?table=traficos&company_id=${COMPANY_ID}&trafico_prefix=${CLIENT_CLAVE}-&limit=1000`).then(r => r.json()),
      fetch('/api/cruz-alerts').then(r => r.json()).catch(() => ({ alerts: [] })),
    ]).then(([trafData, alertData]) => {
      const traficos = trafData.data ?? []
      const enProceso = traficos.filter((t: any) => !(t.estatus || '').toLowerCase().includes('cruz'))
      const urgent = enProceso.filter((t: any) => !t.pedimento)
      const hour = new Date().getHours()
      const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
      const lines = [`${greeting}.`]
      if (enProceso.length > 0) lines.push(`${enProceso.length} tráficos en proceso.`)
      if (urgent.length > 0) lines.push(`${urgent.length} requieren documentos.`)
      if (alertData.alerts?.length > 0) lines.push(alertData.alerts[0].title + '.')
      lines.push('\n¿En qué puedo ayudarte?')
      setBriefing(lines.join(' '))
      setPanelData({
        enProceso: enProceso.slice(0, 5),
        urgent: urgent.slice(0, 5),
        alertTitle: alertData.alerts?.[0]?.title ?? null,
      })
      // Compute priority chips from operational state
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000)
      const stale = enProceso.filter((tr: Record<string, unknown>) => {
        const updated = tr.updated_at || tr.fecha_llegada
        return updated && new Date(updated as string) < fourteenDaysAgo
      })
      const chips = getMostActionableChips({
        urgentCount: urgent.length,
        pendingSolicitudes: 0, // fetched separately if needed
        staleTraficos: stale.length,
      })
      setPriorityChips(chips)
    }).catch(() => setBriefing('Sistema operativo. ¿En qué puedo ayudarte?'))
  }, [])

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cruz-chat-history')
        if (saved) return (JSON.parse(saved) as Message[]).slice(-50)
      } catch { /* ignore parse errors */ }
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
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('cruz-chat-history', JSON.stringify(messages.slice(-50)))
    }
  }, [messages])

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

  const formatMessage = (text: string, isAi: boolean) => {
    const textColor = isAi ? D.aiText : D.text
    return text.split('\n').map((line, li) => {
      const nodes: React.ReactNode[] = []
      const boldParts = line.split(/(\*\*.*?\*\*)/g)
      boldParts.forEach((seg, si) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          nodes.push(<strong key={`${li}-b-${si}`} style={{ color: textColor, fontWeight: 700 }}>{seg.slice(2, -2)}</strong>)
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

  return (
    <div style={{ background: D.bg, color: D.text, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${D.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: D.surface }}>
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
              {traficoContext ? `Contexto: ${traficoContext}` : 'Tu asistente aduanal \u00b7 Respuesta en tiempo real'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {messages.length > 0 && (
            <span style={{ fontSize: 10, color: D.textMuted, opacity: 0.6 }}>Historial guardado</span>
          )}
          <button onClick={() => { setMessages([]); localStorage.removeItem('cruz-chat-history') }}
            style={{ fontSize: 12, color: D.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            Nueva conversación
          </button>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.textMuted, padding: 8 }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main content: chat + optional desktop panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Chat column */}
        <div style={{ flex: isMobile ? 1 : 0.65, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16, WebkitOverflowScrolling: 'touch' }}>
            {/* Briefing card when no messages */}
            {messages.length === 0 && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 24 }}>
                <div style={{
                  background: D.surface, borderLeft: '3px solid #B8953F',
                  borderRadius: 8, padding: '14px 16px', marginBottom: 16,
                  maxWidth: 500,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#B8953F', marginBottom: 6,
                                letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                    CRUZ Briefing
                  </div>
                  <div style={{ fontSize: 13, color: D.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' as const }}>
                    {briefing}
                  </div>
                </div>

                {/* Priority chips — urgency-based styling */}
                <div style={{
                  display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
                  padding: '8px 0',
                }} className="pill-scroll">
                  {(priorityChips.length > 0 ? priorityChips : suggestions.slice(0, 4).map(s => ({ label: s, query: s, urgency: 'info' as const }))).map(chip => {
                    const borderColor = chip.urgency === 'critical' ? '#C23B22'
                      : chip.urgency === 'warning' ? '#C47F17'
                      : D.border
                    const bgColor = chip.urgency === 'critical' ? 'rgba(194,59,34,0.06)'
                      : chip.urgency === 'warning' ? 'rgba(196,127,23,0.06)'
                      : D.surface
                    const textColor = chip.urgency === 'critical' ? '#C23B22'
                      : chip.urgency === 'warning' ? '#C47F17'
                      : D.textSub
                    return (
                      <button key={chip.label} onClick={() => sendMessage(chip.query)} style={{
                        flexShrink: 0, padding: '8px 14px', borderRadius: 9999,
                        border: `1px solid ${borderColor}`, background: bgColor,
                        fontSize: 12, fontWeight: 600, color: textColor,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        {chip.label}
                      </button>
                    )
                  })}
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
                  color: msg.role === 'user' ? D.text : D.aiText,
                }}>
                  {msg.role === 'user' ? msg.content : (
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: D.aiText }}>
                      <ReactMarkdown
                        components={{
                          h2: ({ children }) => <h2 style={{ fontSize: '1em', fontWeight: 700, color: 'inherit', marginBottom: 6, marginTop: 10 }}>{children}</h2>,
                          strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                          li: ({ children }) => <li style={{ marginLeft: 16, marginBottom: 3 }}>{children}</li>,
                          ul: ({ children }) => <ul style={{ marginBottom: 8, paddingLeft: 0 }}>{children}</ul>,
                          p: ({ children }) => <p style={{ marginBottom: 8 }}>{children}</p>,
                          code: ({ children }) => <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85em', background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: 4 }}>{children}</code>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
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
                      <button onClick={() => speak(msg.content)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.aiText, padding: 4 }}><Volume2 size={13} /></button>
                      <button onClick={() => saveFeedback(msg.id, true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.feedback === true ? '#16A34A' : D.aiText, padding: 4 }}><ThumbsUp size={13} /></button>
                      <button onClick={() => saveFeedback(msg.id, false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.feedback === false ? '#DC2626' : D.aiText, padding: 4 }}><ThumbsDown size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ padding: '12px 18px', background: D.aiBubble, border: `1px solid ${D.aiBorder}`, borderRadius: '2px 16px 16px 16px', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: D.aiText, animation: `typing-dot 1.2s infinite ${i * 0.15}s` }} />
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

          {/* Input bar — white card */}
          <div style={{ padding: '12px 24px 16px', borderTop: `1px solid ${D.border}`, flexShrink: 0, background: D.surface }}>
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
                  background: D.bg, lineHeight: 1.5,
                }}
              />
              <button
                onClick={listening ? stopVoice : startVoice}
                style={{
                  width: 48, height: 48, borderRadius: 14, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: listening ? GOLD : D.bg, color: listening ? '#1A1710' : D.textMuted,
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
        </div>

        {/* Desktop context panel — right 35% */}
        {!isMobile && (
          <aside style={{
            width: '35%', borderLeft: `1px solid ${D.border}`,
            padding: 20, overflowY: 'auto', background: D.bg,
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>
            {/* Críticos ahora */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#B8953F', marginBottom: 10,
                            letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                Críticos ahora
              </div>
              {panelData.urgent.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {panelData.urgent.map((t: any, i: number) => (
                    <div key={i} style={{
                      background: D.surface, border: `1px solid ${D.border}`,
                      borderRadius: 8, padding: '10px 12px',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <AlertTriangle size={14} style={{ color: '#C47F17', flexShrink: 0 }} />
                      <div style={{ fontSize: 12, color: D.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.trafico_number || t.id || 'Sin número'}
                      </div>
                      <div style={{ fontSize: 11, color: D.textMuted, marginLeft: 'auto', flexShrink: 0 }}>
                        Sin pedimento
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: D.textMuted, padding: '8px 0' }}>
                  Sin tráficos críticos
                </div>
              )}
            </div>

            {/* En proceso */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#B8953F', marginBottom: 10,
                            letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                En proceso ({panelData.enProceso.length})
              </div>
              {panelData.enProceso.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {panelData.enProceso.map((t: any, i: number) => (
                    <div key={i} style={{
                      background: D.surface, border: `1px solid ${D.border}`,
                      borderRadius: 8, padding: '10px 12px',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Clock size={14} style={{ color: D.textMuted, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, color: D.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.trafico_number || t.id || 'Sin número'}
                      </div>
                      <div style={{ fontSize: 11, color: D.textMuted, marginLeft: 'auto', flexShrink: 0 }}>
                        {t.estatus || 'En proceso'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: D.textMuted, padding: '8px 0' }}>
                  Sin tráficos en proceso
                </div>
              )}
            </div>

            {/* Alertas */}
            {panelData.alertTitle && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#B8953F', marginBottom: 10,
                              letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                  Alerta activa
                </div>
                <div style={{
                  background: D.surface, border: `1px solid ${D.border}`,
                  borderRadius: 8, padding: '10px 12px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <FileText size={14} style={{ color: '#C47F17', flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: D.text }}>
                    {panelData.alertTitle}
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        .pill-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
