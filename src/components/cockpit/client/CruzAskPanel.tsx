'use client'

import { useRef, useState } from 'react'

interface DataRefs {
  traficos: string[]
  pedimentos: string[]
  fracciones: string[]
  amounts: Array<{ value: number; currency: string; raw: string }>
}

export function AduanaAskPanel() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [dataRefs, setDataRefs] = useState<DataRefs | null>(null)

  // Persist the conversation + session ids between turns so the route
  // can load prior history. Survives re-renders; resets on page reload.
  const conversationIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const FALLBACK = (
    'El asistente PORTAL estará disponible muy pronto. Mientras tanto, tu operación sigue al corriente. ' +
    'Para preguntas urgentes, contacta a tu agente aduanal.'
  )

  const examples = [
    '¿Cuál es el estatus de mi último embarque?',
    '¿Cuántos pedimentos tengo este mes?',
    '¿Qué documentos me faltan?',
    '¿Cuánto pagué en aranceles este mes?',
  ]

  async function handleSubmit(e?: React.FormEvent, overrideText?: string) {
    e?.preventDefault()
    const text = (overrideText ?? question).trim()
    if (!text || loading) return

    setLoading(true)
    setAnswer(null)
    setIsFallback(false)
    setStatusLabel('Analizando tu pregunta...')
    setSuggestions([])
    setDataRefs(null)

    try {
      const res = await fetch('/api/cruz-ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          stream: true,
          sessionId: sessionIdRef.current,
          conversationId: conversationIdRef.current,
        }),
      })

      if (!res.body) throw new Error('no_body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let streamedAnswer = ''
      let doneSignaled = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const raw = buffer.slice(0, idx).trim()
          buffer = buffer.slice(idx + 1)
          if (!raw) continue
          let evt: Record<string, unknown>
          try { evt = JSON.parse(raw) as Record<string, unknown> } catch { continue }
          const type = String(evt.type ?? '')
          if (type === 'meta') {
            if (typeof evt.conversationId === 'string') conversationIdRef.current = evt.conversationId
            if (typeof evt.sessionId === 'string') sessionIdRef.current = evt.sessionId
            setStatusLabel('Consultando tu operación...')
          } else if (type === 'tool') {
            setStatusLabel(labelForTool(String(evt.name ?? '')))
          } else if (type === 'delta') {
            streamedAnswer += String(evt.text ?? '')
            setAnswer(streamedAnswer)
            setStatusLabel(null)
          } else if (type === 'suggestions') {
            setSuggestions(Array.isArray(evt.items) ? (evt.items as string[]) : [])
          } else if (type === 'data') {
            setDataRefs(evt.refs as DataRefs)
          } else if (type === 'done') {
            doneSignaled = true
            setIsFallback(Boolean(evt.fallback))
            if (typeof evt.answer === 'string' && evt.answer) setAnswer(evt.answer)
            if (typeof evt.conversationId === 'string') conversationIdRef.current = evt.conversationId
            if (typeof evt.sessionId === 'string') sessionIdRef.current = evt.sessionId
          }
        }
      }

      if (!doneSignaled) {
        setAnswer(FALLBACK)
        setIsFallback(true)
      }
    } catch {
      setAnswer(FALLBACK)
      setIsFallback(true)
    } finally {
      setStatusLabel(null)
      setLoading(false)
      setQuestion('')
    }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.045)', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '3px solid rgba(192,197,206,0.4)',
      padding: 16,
    }}>
      <div style={{
        fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--portal-fg-5)', marginBottom: 12,
      }}>
        Pregúntale a PORTAL
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {examples.map(ex => (
          <button
            key={ex}
            onClick={() => setQuestion(ex)}
            style={{
              background: 'rgba(255,255,255,0.045)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 'var(--aguila-fs-compact)',
              color: 'var(--portal-fg-4)',
              cursor: 'pointer',
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Escribe tu pregunta..."
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.045)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '14px 16px',
            fontSize: 'var(--aguila-fs-section)',
            color: 'var(--portal-fg-1)',
            outline: 'none',
            minHeight: 48,
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            background: 'var(--portal-fg-1)',
            color: 'var(--portal-ink-0)',
            border: 'none',
            borderRadius: 10,
            padding: '0 20px',
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading || !question.trim() ? 0.5 : 1,
            minHeight: 48,
            minWidth: 60,
          }}
        >
          {loading ? '...' : '→'}
        </button>
      </form>

      {statusLabel && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 12,
            fontSize: 'var(--aguila-fs-compact)',
            color: 'var(--portal-fg-4)',
            fontStyle: 'italic',
          }}
        >
          {statusLabel}
        </div>
      )}

      {answer && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 12,
            padding: '12px 16px',
            background: isFallback ? 'rgba(251,191,36,0.06)' : 'rgba(192,197,206,0.06)',
            borderRadius: 10,
            border: `1px solid ${isFallback ? 'var(--portal-status-amber-ring)' : 'rgba(192,197,206,0.15)'}`,
            fontSize: 'var(--aguila-fs-section)',
            color: 'var(--portal-fg-1)',
            lineHeight: 1.5,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          {isFallback && (
            <span aria-hidden style={{ fontSize: 16, lineHeight: '20px', opacity: 0.9 }}>⏳</span>
          )}
          <span style={{ flex: 1 }}>{answer}</span>
        </div>
      )}

      {dataRefs && hasAnyRef(dataRefs) && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {dataRefs.traficos.map(t => (
            <span key={`t-${t}`} style={chipStyle}>Tráfico {t}</span>
          ))}
          {dataRefs.pedimentos.map(p => (
            <span key={`p-${p}`} style={chipStyle}>Pedimento {p}</span>
          ))}
          {dataRefs.fracciones.map(f => (
            <span key={`f-${f}`} style={chipStyle}>Fracción {f}</span>
          ))}
        </div>
      )}

      {suggestions.length > 0 && !loading && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => handleSubmit(undefined, s)}
              style={{
                background: 'rgba(192,197,206,0.1)',
                border: '1px solid rgba(192,197,206,0.25)',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 'var(--aguila-fs-compact)',
                color: 'var(--portal-fg-2)',
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const chipStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '4px 10px',
  fontSize: 'var(--aguila-fs-compact)',
  color: 'var(--portal-fg-3)',
  fontFamily: 'var(--font-jetbrains-mono), monospace',
}

function hasAnyRef(r: DataRefs): boolean {
  return r.traficos.length > 0 || r.pedimentos.length > 0 || r.fracciones.length > 0
}

function labelForTool(name: string): string {
  switch (name) {
    case 'query_traficos': return 'Revisando embarques...'
    case 'query_pedimentos': return 'Revisando pedimentos...'
    case 'query_catalogo': return 'Revisando catálogo...'
    case 'query_financiero': return 'Revisando estado financiero...'
    case 'query_expedientes': return 'Revisando expedientes...'
    case 'analyze_trafico': return 'Analizando embarque...'
    case 'analyze_pedimento': return 'Analizando pedimento...'
    case 'validate_pedimento': return 'Validando cifras del pedimento...'
    case 'suggest_clasificacion': return 'Buscando fracción en tu historial...'
    case 'check_tmec_eligibility': return 'Verificando elegibilidad T-MEC...'
    case 'search_supplier_history': return 'Revisando historial del proveedor...'
    case 'find_missing_documents': return 'Revisando documentos del expediente...'
    case 'tenant_anomalies': return 'Revisando anomalías...'
    case 'intelligence_scan': return 'Analizando la operación...'
    case 'draft_mensajeria': return 'Redactando borrador...'
    case 'learning_report': return 'Generando reporte de aprendizaje...'
    case 'route_mention': return 'Resolviendo mención...'
    default: return 'Consultando...'
  }
}
