'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { GOLD, GOLD_GRADIENT } from '@/lib/design-system'
import { getClientClaveCookie, getCompanyIdCookie } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { useStatusSentence } from '@/hooks/use-status-sentence'
import { getMostActionableChips, PriorityChip } from '@/lib/cruz-priority'
import { playSound } from '@/lib/sounds'
import ChatMessageList, { Message, D } from '@/components/cruz/ChatMessageList'
import ChatInputBar from '@/components/cruz/ChatInputBar'
import ChatContextPanel from '@/components/cruz/ChatContextPanel'

const DEFAULT_SUGGESTIONS = [
  '¿Cuántos tráficos en proceso?',
  '¿Qué puente me recomiendas?',
  'Clasifica: polipropileno virgen',
  'Calcula impuestos $50K USD',
  'Resumen ejecutivo del día',
  '¿Cuánto ahorramos en T-MEC?',
]

function buildDynamicPrompts(statusData: { urgentes: number; enProceso: number; loading: boolean }): string[] {
  const prompts: string[] = []
  if (statusData?.urgentes > 0) prompts.push(`${statusData.urgentes} en seguimiento — ¿qué hago primero?`)
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
  const [panelData, setPanelData] = useState<{ enProceso: { trafico_number?: string; id?: string; estatus?: string }[]; urgent: { trafico_number?: string; id?: string }[]; alertTitle: string | null }>({
    enProceso: [], urgent: [], alertTitle: null,
  })

  const statusData = useStatusSentence()
  useEffect(() => {
    if (!statusData.loading) setSuggestions(buildDynamicPrompts(statusData))
  }, [statusData.loading, statusData.urgentes, statusData.enProceso])
  useEffect(() => {
    fetch('/api/cruz-alerts').then(r => r.json())
      .then(data => setCruzAlerts(data.alerts ?? []))
      .catch((err: unknown) => { void 0 })
  }, [])

  // Proactive briefing fetch
  useEffect(() => {
    const companyId = getCompanyIdCookie()
    const clientClave = getClientClaveCookie()
    Promise.all([
      fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01`).then(r => r.json()),
      fetch('/api/cruz-alerts').then(r => r.json()).catch(() => ({ alerts: [] })),
    ]).then(([trafData, alertData]) => {
      const traficos = trafData.data ?? []
      const enProceso = traficos.filter((t: { estatus?: string | null }) => !(t.estatus || '').toLowerCase().includes('cruz'))
      const urgent = enProceso.filter((t: { pedimento?: string | null }) => !t.pedimento)
      const hour = new Date().getHours()
      const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
      const lines = [`${greeting}.`]
      if (enProceso.length > 0) lines.push(`${enProceso.length} tráficos en proceso.`)
      const nextCrossing = enProceso
        .filter((t: { pedimento?: string | null; fecha_llegada?: string | null }) => t.pedimento && t.fecha_llegada)
        .sort((a: { fecha_llegada?: string | null }, b: { fecha_llegada?: string | null }) => (a.fecha_llegada || '').localeCompare(b.fecha_llegada || ''))
      if (nextCrossing.length > 0) {
        const next = nextCrossing[0] as { trafico?: string }
        lines.push(`${next.trafico || 'Un tráfico'} debería cruzar pronto — le avisamos cuando suceda.`)
      } else if (urgent.length > 0) {
        lines.push(`${urgent.length} requieren documentos.`)
      }
      if (alertData.alerts?.length > 0) lines.push(alertData.alerts[0].title + '.')
      lines.push('\n¿Necesita algo más?')
      setBriefing(lines.join(' '))
      setPanelData({
        enProceso: enProceso.slice(0, 5),
        urgent: urgent.slice(0, 5),
        alertTitle: alertData.alerts?.[0]?.title ?? null,
      })
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000)
      const stale = enProceso.filter((tr: Record<string, unknown>) => {
        const updated = tr.updated_at || tr.fecha_llegada
        return updated && new Date(updated as string) < fourteenDaysAgo
      })
      const chips = getMostActionableChips({
        urgentCount: urgent.length,
        pendingSolicitudes: 0,
        staleTraficos: stale.length,
      })
      setPriorityChips(chips)
    }).catch(() => setBriefing('Sistema operativo. ¿En qué puedo ayudarte?'))
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
        if (text.includes('Y') || /^\d{4}/.test(text)) suggestion = 'Verifica el número completo del tráfico.'
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
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('')
      setInput(transcript)
      if (event.results[0]?.isFinal) { recognition.stop(); setListening(false); sendMessage(transcript) }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start(); setListening(true)
    setTimeout(() => { try { recognition.stop() } catch {} setListening(false) }, 10000)
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

  const handleAbort = () => { abortRef.current?.abort(); setLoading(false) }

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
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Z</span>
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
          <ChatMessageList
            messages={messages}
            loading={loading}
            briefing={briefing}
            priorityChips={priorityChips}
            suggestions={suggestions}
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
