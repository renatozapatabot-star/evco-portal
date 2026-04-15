'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { getCompanyIdCookie } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { playSound } from '@/lib/sounds'
import ChatMessageList, { Message, D } from '@/components/aguila/ChatMessageList'
import ChatInputBar from '@/components/aguila/ChatInputBar'
import ChatContextPanel from '@/components/aguila/ChatContextPanel'

export default function CruzChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const traficoContext = searchParams.get('trafico')
  // V1 · role-aware greeting passed via AsistenteButton (ctx=role, hello=message)
  const helloMessage = searchParams.get('hello')
  const roleCtx = searchParams.get('ctx')
  const isMobile = useIsMobile()
  const [panelData, setPanelData] = useState<{ enProceso: { trafico_number?: string; id?: string; estatus?: string }[]; urgent: { trafico_number?: string; id?: string }[]; alertTitle: string | null }>({
    enProceso: [], urgent: [], alertTitle: null,
  })

  // Fetch context panel data
  useEffect(() => {
    const companyId = getCompanyIdCookie()
    Promise.all([
      fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01`).then(r => r.json()),
      fetch('/api/cruz-alerts').then(r => r.json()).catch(() => ({ alerts: [] })),
    ]).then(([trafData, alertData]) => {
      const traficos = trafData.data ?? []
      const enProceso = traficos.filter((t: { estatus?: string | null }) => !(t.estatus || '').toLowerCase().includes('cruz'))
      const urgent = enProceso.filter((t: { pedimento?: string | null }) => !t.pedimento)
      setPanelData({
        enProceso: enProceso.slice(0, 5),
        urgent: urgent.slice(0, 5),
        alertTitle: alertData.alerts?.[0]?.title ?? null,
      })
    }).catch(() => { /* panel data unavailable — non-blocking */ })
  }, [])

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
      } catch { /* ignore parse errors */ }
    }
    return []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<InstanceType<NonNullable<typeof window.SpeechRecognition>> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'ssr'
    let id = sessionStorage.getItem('cruz-session')
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('cruz-session', id) }
    return id
  })

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('cruz-chat-history', JSON.stringify(messages.slice(-50)))
    }
  }, [messages])

  // Trafico context injection
  useEffect(() => {
    if (traficoContext && messages.length === 0) {
      const contextMsg = `Estoy viendo el embarque ${traficoContext}. ¿Cuál es su estatus actual?`
      sendMessage(contextMsg)
    }
  }, [traficoContext]) // eslint-disable-line react-hooks/exhaustive-deps

  // V1 · role-aware greeting: when the AsistenteButton sends a `hello`
  // query param, render it as the assistant's opening message so every
  // role (client/operator/owner/trafico/contabilidad/warehouse) gets a
  // tailored first line. No API call — purely client-side seed.
  useEffect(() => {
    if (helloMessage && messages.length === 0 && !traficoContext) {
      const greeting: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: helloMessage,
      }
      setMessages([greeting])
    }
  }, [helloMessage, traficoContext]) // eslint-disable-line react-hooks/exhaustive-deps
  void roleCtx

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    const aiMsgId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', feedback: null }])

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
      const contextInfo = traficoContext
        ? `User is asking about embarque ${traficoContext}. Include specific data for this embarque.`
        : `User is in the ZAPATA AI chat interface.`

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
        const errData = await res.json().catch(() => ({ message: 'Error del servidor' }))
        const serverMsg = errData.message || 'Error del servidor'
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        let suggestion = 'Intenta reformular tu pregunta.'
        if (text.includes('Y') || /^\d{4}/.test(text)) suggestion = 'Verifica el número completo del embarque.'
        else if (text.length < 5) suggestion = 'Intenta con una pregunta más específica.'
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: `No pude procesar esa consulta. ${suggestion}` } : m
        ))
      }
    } finally { setLoading(false) }
  }, [messages, loading, sessionId, traficoContext])

  // Voice
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'es-MX'; recognition.interimResults = true; recognition.continuous = false
    recognitionRef.current = recognition
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results).map((r: SpeechRecognitionResult) => r[0].transcript).join('')
      setInput(transcript)
      if (event.results[0]?.isFinal) { recognition.stop(); setListening(false); sendMessage(transcript) }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start(); setListening(true)
    setTimeout(() => { try { recognition.stop() } catch (e) { console.error('[cruz] recognition stop:', (e as Error).message) } setListening(false) }, 10000)
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
    try { await fetch('/api/cruz-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, helpful }) }) } catch (e) { console.error('[cruz] feedback failed:', (e as Error).message) }
  }

  const handleAbort = () => { abortRef.current?.abort(); setLoading(false) }

  return (
    <div style={{ background: D.bg, color: D.text, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Header — dark navy to match sidebar */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#05070B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            filter: 'drop-shadow(0 0 10px rgba(192,197,206,0.2))',
          }}>
            <AguilaMark size={40} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              {traficoContext ? `Contexto: ${traficoContext}` : 'Asistente aduanal'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setMessages([]); localStorage.removeItem('cruz-chat-history') }}
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            Nueva conversación
          </button>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', padding: 8 }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main content: chat + optional desktop panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Chat column */}
        <div style={{ flex: isMobile ? 1 : 0.65, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

        {/* Desktop context panel */}
        {!isMobile && <ChatContextPanel panelData={panelData} />}
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
