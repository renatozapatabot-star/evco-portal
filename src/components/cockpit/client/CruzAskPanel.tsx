'use client'

import { useState } from 'react'

export function AduanaAskPanel() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)
  const [loading, setLoading] = useState(false)

  const examples = [
    '¿Cuál es el estatus de mi último embarque?',
    '¿Cuántos pedimentos tengo este mes?',
    '¿Qué documentos me faltan?',
    '¿Cuánto pagué en aranceles este mes?',
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || loading) return

    setLoading(true)
    setAnswer(null)
    setIsFallback(false)
    try {
      const res = await fetch('/api/cruz-ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      })
      const data = await res.json()
      setAnswer(data.answer || 'Sin respuesta')
      setIsFallback(Boolean(data.is_fallback))
    } catch {
      // Network failure — same calm muted card contract as upstream 5xx.
      setAnswer(
        'El asistente PORTAL estará disponible muy pronto. Mientras tanto, tu operación sigue al corriente. ' +
        'Para preguntas urgentes, contacta a tu agente aduanal.'
      )
      setIsFallback(true)
    } finally {
      setLoading(false)
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
        letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
      }}>
        Pregúntale a PORTAL
      </div>

      {/* Example prompts */}
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
              color: '#8B949E',
              cursor: 'pointer',
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Input */}
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
            color: '#E6EDF3',
            outline: 'none',
            minHeight: 48,
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            background: '#E8EAED',
            color: '#05070B',
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

      {/* Answer */}
      {answer && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 12,
            padding: '12px 16px',
            background: isFallback ? 'rgba(251,191,36,0.06)' : 'rgba(192,197,206,0.06)',
            borderRadius: 10,
            border: `1px solid ${isFallback ? 'rgba(251,191,36,0.25)' : 'rgba(192,197,206,0.15)'}`,
            fontSize: 'var(--aguila-fs-section)',
            color: '#E6EDF3',
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
    </div>
  )
}
