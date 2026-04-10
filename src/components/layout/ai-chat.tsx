'use client'

import { useState, useRef, useEffect } from 'react'
import { getClientNameCookie, PATENTE } from '@/lib/client-config'

const T = { surface: 'var(--card-bg)', surfaceAlt: '#F5F3EF', border: 'var(--border)', text: 'var(--text-primary)', textSub: 'var(--text-secondary)', textMuted: '#999999', navy: 'var(--text-primary)', gold: 'var(--gold-dark)', shadow: '0 8px 32px rgba(0,0,0,0.12)' }
type Message = { role: 'user' | 'assistant'; content: string; ts: string }
const SUGGESTIONS = ['Mostrar tráficos con faltantes o daños', '¿Cuál es el valor total importado este mes?', '¿Qué tráficos están vencidos más de 7 días?', '¿Hay oportunidades T-MEC sin certificado?', 'Resumen de incidencias últimas 4 semanas']

export function AIChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setTimeout(() => inputRef.current?.focus(), 100); if (messages.length === 0) setMessages([{ role: 'assistant', content: `Hola, soy CRUZ. Puedo consultar datos ${getClientNameCookie().split(' ')[0]} en tiempo real. ¿Qué necesitas?`, ts: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }]) } }, [open])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(text?: string) {
    const content = (text || input).trim(); if (!content || loading) return; setInput('')
    const userMsg: Message = { role: 'user', content, ts: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }
    setMessages(prev => [...prev, userMsg]); setLoading(true)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })) }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'Sin respuesta.', ts: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }])
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión.', ts: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }]) }
    setLoading(false)
  }

  const ZAvatar = () => (
    <div style={{ width: 28, height: 28, background: 'var(--amber-600, #BA7517)', borderRadius: 6, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" strokeLinecap="round"><path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"/></svg>
    </div>
  )

  return (
    <>
      {/* Z Button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="ADUANA Intelligence"
        aria-label="Abrir ADUANA AI"
        style={{
          position: 'fixed', bottom: 24, right: 24, width: 48, height: 48,
          background: 'var(--amber-600, #BA7517)', border: 'none',
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          transition: 'all 0.2s ease', color: 'rgba(255,255,255,0.04)',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)' }}
      >
        {open ? (
          <span style={{ fontSize: 18, fontWeight: 600 }}>&times;</span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"/>
            <path d="M19 18L19.5 20.5L22 21L19.5 21.5L19 24L18.5 21.5L16 21L18.5 20.5L19 18Z" opacity="0.6"/>
          </svg>
        )}
      </button>

      {open && (
        <div style={{ position: 'fixed', bottom: 80, right: 24, width: 380, height: 520, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.shadow, zIndex: 199, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-geist-sans)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--amber-600, #BA7517)', padding: '14px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" strokeLinecap="round"><path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"/></svg>
              <div><div style={{ color: 'rgba(255,255,255,0.04)', fontSize: 14, fontWeight: 700 }}>ADUANA Intelligence</div><div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{getClientNameCookie().split(' ')[0]} Plastics &middot; Patente {PATENTE}</div></div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                {m.role === 'assistant' && <ZAvatar />}
                <div style={{ maxWidth: '75%', padding: '9px 12px', borderRadius: 12, borderBottomLeftRadius: m.role === 'assistant' ? 4 : 12, borderBottomRightRadius: m.role === 'user' ? 4 : 12, background: m.role === 'user' ? 'var(--amber-600, #BA7517)' : T.surfaceAlt, color: m.role === 'user' ? 'rgba(255,255,255,0.04)' : T.text, fontSize: 13, lineHeight: 1.5 }}>
                  {m.content}<div style={{ color: m.role === 'user' ? 'rgba(255,255,255,0.4)' : T.textMuted, fontSize: 9, marginTop: 4, textAlign: 'right' }}>{m.ts}</div>
                </div>
              </div>
            ))}
            {loading && <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}><ZAvatar /><div style={{ background: T.surfaceAlt, borderRadius: 12, borderBottomLeftRadius: 4, padding: '10px 14px', color: T.textMuted, fontSize: 12 }}>Consultando datos...</div></div>}
            {messages.length === 1 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>{SUGGESTIONS.map((s, i) => <button key={i} onClick={() => sendMessage(s)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 10px', textAlign: 'left', cursor: 'pointer', color: T.textSub, fontSize: 11, fontFamily: 'inherit' }}>{s}</button>)}</div>}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Pregunta sobre tus operaciones..." style={{ flex: 1, height: 38, border: `1px solid ${T.border}`, borderRadius: 8, padding: '0 12px', fontSize: 13, color: T.text, background: T.surfaceAlt, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{ width: 38, height: 38, background: input.trim() && !loading ? 'var(--amber-600, #BA7517)' : T.border, border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.04)', fontSize: 16, cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&rarr;</button>
          </div>
        </div>
      )}
    </>
  )
}
