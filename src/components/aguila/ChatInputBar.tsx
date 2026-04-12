'use client'

import { useRef, useEffect } from 'react'
import { Send, Mic, Square } from 'lucide-react'
import { GOLD, GOLD_GRADIENT } from '@/lib/design-system'
import { D } from './ChatMessageList'

interface ChatInputBarProps {
  input: string
  setInput: (value: string) => void
  loading: boolean
  listening: boolean
  onSend: (text: string) => void
  onStartVoice: () => void
  onStopVoice: () => void
  onAbort?: () => void
}

export default function ChatInputBar({
  input,
  setInput,
  loading,
  listening,
  onSend,
  onStartVoice,
  onStopVoice,
  onAbort,
}: ChatInputBarProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend(input)
    }
  }

  return (
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
          onClick={() => {
            if (listening) {
              onStopVoice()
            } else {
              if ('vibrate' in navigator) navigator.vibrate(50)
              onStartVoice()
            }
          }}
          style={{
            width: 60, height: 60, borderRadius: 14, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: listening ? GOLD : D.bg, color: listening ? 'var(--text-primary)' : D.textMuted,
            transition: 'all 0.15s',
          }}
        >
          <Mic size={20} />
        </button>
        {loading && onAbort ? (
          <button
            onClick={onAbort}
            style={{
              width: 60, height: 60, borderRadius: 14, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: 'var(--danger-500, #DC2626)', color: 'rgba(9,9,11,0.75)',
              transition: 'opacity 0.15s',
            }}
            title="Detener"
          >
            <Square size={18} strokeWidth={2} />
          </button>
        ) : (
          <button
            onClick={() => onSend(input)}
            disabled={loading || !input.trim()}
            style={{
              width: 60, height: 60, borderRadius: 14, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: GOLD_GRADIENT, color: 'var(--text-primary)',
              opacity: loading || !input.trim() ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <Send size={18} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  )
}
