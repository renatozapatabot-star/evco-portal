'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Send, Mic, Volume2, ThumbsUp, ThumbsDown, ArrowRight, Square, X, Upload, Search, Phone } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import DOMPurify from 'dompurify'
import { GOLD, GOLD_GRADIENT } from '@/lib/design-system'
import { getCompanyIdCookie, getClientClaveCookie, csrfFetch } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { playSound } from '@/lib/sounds'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  navigate?: string
  feedback?: boolean | null
}

const SUGGESTIONS = [
  '¿Cuántos tráficos en proceso?',
  '¿Qué puente me recomiendas?',
  'Resumen ejecutivo del día',
  'Calcula impuestos $50K USD',
]

// Dark cockpit theme — matches the dark portal
const D = {
  bg: '#111111',
  surface: '#1A1A1A',
  border: 'rgba(255,255,255,0.08)',
  text: '#E6EDF3',
  textMuted: '#6E7681',
  textSub: '#8B949E',
  userBubble: 'rgba(201,168,76,0.12)',
  userBorder: 'rgba(201,168,76,0.25)',
  aiBubble: '#1A1A1A',
  aiBorder: 'rgba(255,255,255,0.06)',
  aiText: '#E6EDF3',
}

export function CruzChatBubble() {
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)

  // Listen for global open event (from shortcuts, command palette, FAB, etc.)
  useEffect(() => {
    const handleOpen = () => { setOpen(true); setHasUnread(false) }
    document.addEventListener('cruz:open-chat', handleOpen)
    return () => document.removeEventListener('cruz:open-chat', handleOpen)
  }, [])

  // Chat state
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const currentCompany = getCompanyIdCookie()
        const savedCompany = localStorage.getItem('cruz-chat-company')
        if (savedCompany && savedCompany !== currentCompany) {
          localStorage.removeItem('cruz-chat-history')
          localStorage.setItem('cruz-chat-company', currentCompany)
          return []
        }
        localStorage.setItem('cruz-chat-company', currentCompany)
        const saved = localStorage.getItem('cruz-chat-history')
        if (saved) return (JSON.parse(saved) as Message[]).slice(-50)
      } catch { /* ignore */ }
    }
    return []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<InstanceType<NonNullable<typeof window.SpeechRecognition>> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'ssr'
    let id = sessionStorage.getItem('cruz-session')
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('cruz-session', id) }
    return id
  })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])
  useEffect(() => {
    if (messages.length > 0) localStorage.setItem('cruz-chat-history', JSON.stringify(messages.slice(-50)))
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    if (!open) setOpen(true)

    const controller = new AbortController()
    abortRef.current = controller

    const aiMsgId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', feedback: null }])

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
      const contextInfo = `User is on page: ${pathname}`

      const res = await csrfFetch('/api/cruz-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          context: { page: contextInfo, timestamp: new Date().toISOString() },
          sessionId,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Error del servidor' }))
        const serverMsg = errData.message || errData.error || 'Error del servidor'
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: serverMsg } : m
        ))
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
        const currentText = aiText
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: currentText, navigate: navigate || undefined } : m
        ))
      }

      if (!aiText) aiText = 'Sin respuesta.'
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, content: aiText, navigate: navigate || undefined } : m
      ))
      playSound('send')
      if (!open) setHasUnread(true)
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        let suggestion = 'Intenta reformular tu pregunta.'
        if (text.includes('Y') || /^\d{4}/.test(text)) suggestion = 'Verifica el número completo del tráfico.'
        else if (text.length < 5) suggestion = 'Intenta con una pregunta más específica.'
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: `No pude procesar esa consulta. ${suggestion}` } : m
        ))
      }
    } finally { setLoading(false) }
  }, [messages, loading, sessionId, pathname, open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  // Voice
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'es-MX'; recognition.interimResults = true; recognition.continuous = false
    recognitionRef.current = recognition
    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      const transcript = Array.from(event.results).map((r: SpeechRecognitionResult) => r[0].transcript).join('')
      setInput(transcript)
      if (event.results[0]?.isFinal) { recognition.stop(); setListening(false); sendMessage(transcript) }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start(); setListening(true)
    setTimeout(() => { try { recognition.stop() } catch (e) { console.error('[chat-bubble] recognition stop:', (e as Error).message) } setListening(false) }, 10000)
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
    try { await csrfFetch('/api/cruz-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, helpful }) }) } catch (e) { console.error('[chat-bubble] feedback failed:', (e as Error).message) }
  }

  const linkifyEntities = (text: string): React.ReactNode[] => {
    const clave = getClientClaveCookie()
    if (!clave) return [<span key={0}>{text}</span>]
    const traficoPattern = new RegExp(`(${clave}-[A-Z]\\d{4}|[67]\\d{6})`, 'g')
    const traficoTest = new RegExp(`^${clave}-[A-Z]\\d{4}$`)
    const parts = text.split(traficoPattern)
    return parts.map((part, i) => {
      if (traficoTest.test(part))
        return <Link key={i} href={`/traficos/${part}`} onClick={() => setOpen(false)} style={{ color: GOLD, fontWeight: 700, fontFamily: 'var(--font-data)', textDecoration: 'none', borderBottom: '1px solid rgba(201,168,76,0.4)' }}>{part}</Link>
      if (/^[67]\d{6}$/.test(part))
        return <Link key={i} href={`/pedimentos?search=${part}`} onClick={() => setOpen(false)} style={{ color: GOLD, fontWeight: 700, fontFamily: 'var(--font-data)', textDecoration: 'none' }}>{part}</Link>
      return <span key={i}>{part}</span>
    })
  }

  // Quick actions in header
  const quickActions = [
    { icon: Search, label: 'Buscar', action: () => { setOpen(false); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true })) } },
    { icon: Upload, label: 'Subir', action: () => { setOpen(false); router.push('/documentos/subir') } },
    { icon: Phone, label: 'Llamar', action: () => { window.location.href = 'tel:+19568277000' } },
  ]

  const handleOpen = () => {
    setOpen(true)
    setHasUnread(false)
  }

  // Don't render on login page
  if (pathname === '/login') return null

  return (
    <>
      {/* Backdrop — mobile only when expanded */}
      {open && isMobile && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,0.3)' }} />
      )}

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed',
          ...(isMobile
            ? { inset: 0, top: 0, zIndex: 60, borderRadius: 0 }
            : { bottom: 24, right: 24, width: 400, height: 560, zIndex: 60, borderRadius: 16 }
          ),
          background: D.surface,
          border: isMobile ? 'none' : `1px solid ${D.border}`,
          boxShadow: isMobile ? 'none' : '0 8px 32px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${D.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: D.surface, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="cruz-brand-z" style={{ width: 32, height: 32 }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="12" y1="3" x2="12" y2="21" stroke="#0B1623" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="12" x2="21" y2="12" stroke="#0B1623" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 8.5L15.5 12L12 15.5L8.5 12Z" fill="#0B1623" />
                  <path d="M12 3L14 6H10Z" fill="#0B1623" />
                  <path d="M21 12L18 10V14Z" fill="#0B1623" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>CRUZ</div>
                <div style={{ fontSize: 11, color: D.textMuted }}>Asistente aduanal</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {quickActions.map((a, i) => (
                <button key={i} onClick={a.action} title={a.label} style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: 'transparent', cursor: 'pointer', color: D.textMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <a.icon size={15} />
                </button>
              ))}
              <button onClick={() => { setMessages([]); localStorage.removeItem('cruz-chat-history') }}
                title="Nueva conversación"
                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: D.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                +
              </button>
              <button onClick={() => setOpen(false)} style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: 'transparent', cursor: 'pointer', color: D.textMuted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, WebkitOverflowScrolling: 'touch' }}>
            {/* Suggestions when empty */}
            {messages.length === 0 && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: D.textSub, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
                  Pregunta sobre tráficos, impuestos, puentes, documentos...
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => sendMessage(s)} style={{
                      padding: '7px 12px', borderRadius: 9999,
                      border: `1px solid ${D.border}`, background: D.surface,
                      fontSize: 12, fontWeight: 500, color: D.textSub,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex', gap: 8,
                maxWidth: msg.role === 'user' ? '80%' : '90%',
                marginLeft: msg.role === 'user' ? 'auto' : 0,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '2px 14px 14px 14px',
                  background: msg.role === 'user' ? D.userBubble : D.aiBubble,
                  border: `1px solid ${msg.role === 'user' ? D.userBorder : D.aiBorder}`,
                  fontSize: 13, lineHeight: 1.6,
                  fontWeight: msg.role === 'user' ? 600 : 400,
                  color: msg.role === 'user' ? D.text : D.aiText,
                }}>
                  {msg.role === 'user' ? msg.content : (
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: D.aiText }}>
                      <ReactMarkdown
                        components={{
                          h2: ({ children }) => <h2 style={{ fontSize: '0.95em', fontWeight: 700, color: 'inherit', marginBottom: 4, marginTop: 8 }}>{children}</h2>,
                          strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                          li: ({ children }) => <li style={{ marginLeft: 14, marginBottom: 2 }}>{children}</li>,
                          ul: ({ children }) => <ul style={{ marginBottom: 6, paddingLeft: 0 }}>{children}</ul>,
                          p: ({ children }) => <p style={{ marginBottom: 6 }}>{children}</p>,
                          code: ({ children }) => <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85em', background: 'rgba(196,150,60,0.08)', padding: '1px 4px', borderRadius: 3, color: GOLD }}>{children}</code>,
                        }}
                      >
                        {typeof window !== 'undefined' ? DOMPurify.sanitize(msg.content) : msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {/* Navigate button */}
                  {msg.navigate && (
                    <div onClick={() => { router.push(msg.navigate!); setOpen(false) }} style={{
                      display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '6px 10px',
                      background: 'rgba(196,150,60,0.08)', border: '1px solid rgba(196,150,60,0.2)',
                      borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: GOLD,
                    }}>
                      <ArrowRight size={12} /> Ir a {msg.navigate}
                    </div>
                  )}
                  {/* Retry on error */}
                  {msg.role === 'assistant' && !loading && (msg.content.includes('No pude procesar') || msg.content.includes('Error del servidor') || msg.content.includes('no está disponible') || msg.content.includes('Error de API') || msg.content.includes('Token CSRF')) && (
                    <button
                      onClick={() => { const lastUser = messages.filter(m => m.role === 'user').pop(); if (lastUser) sendMessage(lastUser.content) }}
                      style={{
                        marginTop: 6, padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'transparent', border: `1px solid ${D.border}`, color: D.textMuted, cursor: 'pointer',
                      }}
                    >
                      Reintentar
                    </button>
                  )}
                  {/* Action confirmation */}
                  {msg.role === 'assistant' && !loading && (msg.content.includes('¿Procedo?') || msg.content.includes('¿Procedemos?') || msg.content.includes('¿Confirma?')) && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={() => sendMessage('Sí, procede')} style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        background: GOLD, color: D.surface, border: 'none', cursor: 'pointer', minHeight: 32,
                      }}>Proceder</button>
                      <button onClick={() => sendMessage('No, cancelar')} style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: 'transparent', color: D.textMuted, border: `1px solid ${D.border}`, cursor: 'pointer', minHeight: 32,
                      }}>Cancelar</button>
                    </div>
                  )}
                  {/* Feedback */}
                  {msg.role === 'assistant' && msg.content && !msg.content.includes('Error') && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, opacity: 0.4 }}>
                      <button onClick={() => speak(msg.content)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.aiText, padding: 2 }}><Volume2 size={12} /></button>
                      <button onClick={() => saveFeedback(msg.id, true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.feedback === true ? '#16A34A' : D.aiText, padding: 2 }}><ThumbsUp size={12} /></button>
                      <button onClick={() => saveFeedback(msg.id, false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.feedback === false ? '#DC2626' : D.aiText, padding: 2 }}><ThumbsDown size={12} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <div style={{ padding: '10px 14px', background: D.aiBubble, border: `1px solid ${D.aiBorder}`, borderRadius: '2px 14px 14px 14px', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: D.textMuted, animation: `cruz-typing-dot 1.2s infinite ${i * 0.15}s` }} />
                  ))}
                </div>
                <button onClick={() => { abortRef.current?.abort(); setLoading(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', border: `1px solid ${D.border}`, borderRadius: 6, background: 'transparent', fontSize: 10, fontWeight: 600, color: D.textMuted, cursor: 'pointer' }}>
                  <Square size={7} fill="currentColor" /> Detener
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${D.border}`, flexShrink: 0, background: D.surface }}>
            {listening && <div style={{ fontSize: 11, color: GOLD, fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>Escuchando...</div>}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta sobre tráficos, puentes, impuestos..."
                rows={1}
                disabled={loading}
                style={{
                  flex: 1, minHeight: 42, maxHeight: 100, padding: '10px 14px',
                  border: `1px solid ${D.border}`, borderRadius: 12,
                  fontSize: 14, fontFamily: 'var(--font-ui)', fontWeight: 450,
                  color: D.text, resize: 'none', outline: 'none',
                  background: D.bg, lineHeight: 1.5,
                }}
              />
              <button
                onClick={listening ? stopVoice : startVoice}
                style={{
                  width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: listening ? GOLD : D.bg, color: listening ? D.text : D.textMuted,
                  transition: 'all 0.15s',
                }}
              >
                <Mic size={18} />
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                style={{
                  width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: GOLD_GRADIENT, color: D.text,
                  opacity: loading || !input.trim() ? 0.4 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <Send size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed bubble — hidden on mobile (Z tab in bottom nav replaces it) */}
      {!open && !isMobile && (
        <button
          onClick={handleOpen}
          aria-label="Abrir CRUZ AI"
          className="cruz-thought-bubble"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 60,
            width: 120, height: 64, borderRadius: 32,
            background: GOLD_GRADIENT,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: '0 4px 20px rgba(196,150,60,0.4)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(196,150,60,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(196,150,60,0.4)' }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>&#10022;</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: D.text, letterSpacing: '0.06em' }}>CRUZ AI</span>
          {/* Unread indicator */}
          {hasUnread && (
            <div style={{
              position: 'absolute', top: -2, right: -2,
              width: 12, height: 12, borderRadius: '50%',
              background: '#DC2626', border: '2px solid #FFFFFF',
            }} />
          )}
        </button>
      )}

      <style>{`
        @keyframes cruz-typing-dot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        .cruz-thought-bubble { position: relative; }
        .cruz-thought-bubble::before {
          content: '';
          position: absolute;
          bottom: -8px;
          right: 10px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: linear-gradient(135deg, #C9A84C, #8B6914);
          box-shadow: 0 2px 8px rgba(196,150,60,0.25);
        }
        .cruz-thought-bubble::after {
          content: '';
          position: absolute;
          bottom: -18px;
          right: 2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: linear-gradient(135deg, #C9A84C, #8B6914);
          box-shadow: 0 2px 6px rgba(196,150,60,0.2);
        }
      `}</style>
    </>
  )
}
