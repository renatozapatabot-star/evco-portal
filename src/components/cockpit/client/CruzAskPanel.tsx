'use client'

import { useState } from 'react'

export function AduanaAskPanel() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const examples = [
    '¿Cuál es el estatus de mi último tráfico?',
    '¿Cuántos pedimentos tengo este mes?',
    '¿Qué documentos me faltan?',
    '¿Cuánto pagué en aranceles este mes?',
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || loading) return

    setLoading(true)
    setAnswer(null)
    try {
      const res = await fetch('/api/cruz-ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      })
      const data = await res.json()
      setAnswer(data.answer || data.error || 'Sin respuesta')
    } catch {
      setAnswer('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '3px solid rgba(201,168,76,0.4)',
      padding: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
      }}>
        Pregúntale a CRUZ
      </div>

      {/* Example prompts */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {examples.map(ex => (
          <button
            key={ex}
            onClick={() => setQuestion(ex)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
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
            background: '#1A1A1A',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '14px 16px',
            fontSize: 14,
            color: '#E6EDF3',
            outline: 'none',
            minHeight: 48,
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            background: '#eab308',
            color: '#05070B',
            border: 'none',
            borderRadius: 10,
            padding: '0 20px',
            fontSize: 14,
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
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          background: 'rgba(201,168,76,0.06)',
          borderRadius: 10,
          border: '1px solid rgba(201,168,76,0.15)',
          fontSize: 14,
          color: '#E6EDF3',
          lineHeight: 1.5,
        }}>
          {answer}
        </div>
      )}
    </div>
  )
}
