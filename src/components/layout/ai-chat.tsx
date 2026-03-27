'use client'

import { useState, useRef, useEffect } from 'react'

const T = { surface: '#FFFFFF', surfaceAlt: '#F5F3EF', border: '#E8E6E0', text: '#1A1A1A', textSub: '#6B6B6B', textMuted: '#999999', navy: '#1A1A1A', gold: '#BA7517', shadow: '0 8px 32px rgba(0,0,0,0.12)' }
type Message = { role: 'user' | 'assistant'; content: string; ts: string }
const SUGGESTIONS = ['Show me traficos with faltantes', 'Total value imported this month?', 'Which traficos are detenidos?', 'Top 5 suppliers by value']

export function AIChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setTimeout(() => inputRef.current?.focus(), 100); if (messages.length === 0) setMessages([{ role: 'assistant', content: 'Hola, soy CRUZ. Puedo consultar datos EVCO en tiempo real. Que necesitas?', ts: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }]) } }, [open])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(text?: string) {
    const content = (text || input).trim(); if (!content || loading) return; setInput('')
    const userMsg: Message = { role: 'user', content, ts: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }
    setMessages(prev => [...prev, userMsg]); setLoading(true)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })) }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'Sin respuesta.', ts: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }])
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexion.', ts: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }]) }
    setLoading(false)
  }

  const ZAvatar = () => (
    <div style={{ width: 28, height: 28, background: '#BA7517', borderRadius: 6, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Z</span>
    </div>
  )

  return (
    <>
      {/* Z Button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="CRUZ - Zapata AI"
        style={{
          position: 'fixed', bottom: 24, right: 24, width: 44, height: 44,
          background: T.navy, border: '1px solid rgba(201,168,76,0.4)',
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
      >
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: T.gold, letterSpacing: '-0.5px' }}>
          {open ? 'x' : 'Z'}
        </span>
      </button>

      {open && (
        <div style={{ position: 'fixed', bottom: 80, right: 24, width: 380, height: 520, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.shadow, zIndex: 199, display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>
          <div style={{ background: T.navy, padding: '14px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: T.gold, fontSize: 14, fontWeight: 700 }}>Z</span>
              <div><div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>CRUZ Intelligence</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>EVCO Plastics &middot; Patente 3596</div></div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                {m.role === 'assistant' && <ZAvatar />}
                <div style={{ maxWidth: '75%', padding: '9px 12px', borderRadius: 12, borderBottomLeftRadius: m.role === 'assistant' ? 4 : 12, borderBottomRightRadius: m.role === 'user' ? 4 : 12, background: m.role === 'user' ? T.navy : T.surfaceAlt, color: m.role === 'user' ? '#fff' : T.text, fontSize: 13, lineHeight: 1.5 }}>
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
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{ width: 38, height: 38, background: input.trim() && !loading ? T.navy : T.border, border: 'none', borderRadius: 8, color: '#fff', fontSize: 16, cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-&gt;</button>
          </div>
        </div>
      )}
    </>
  )
}
