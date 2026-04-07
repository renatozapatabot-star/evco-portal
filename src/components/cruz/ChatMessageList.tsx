'use client'

import { useRef, useEffect, RefObject } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Volume2, ThumbsUp, ThumbsDown, Square } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import DOMPurify from 'dompurify'
import { GOLD, GOLD_GRADIENT } from '@/lib/design-system'
import { getClientClaveCookie } from '@/lib/client-config'
import { PriorityChip } from '@/lib/cruz-priority'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  navigate?: string
  feedback?: boolean | null
}

// Warm cream theme tokens
export const D = {
  bg: '#F7F6F3',
  surface: 'var(--card-bg)',
  border: 'var(--border)',
  text: '#1A1A18',
  textMuted: '#9C9890',
  textSub: 'var(--text-secondary)',
  userBubble: 'rgba(184,149,63,0.08)',
  userBorder: 'rgba(184,149,63,0.20)',
  aiBubble: '#1A1A18',
  aiBorder: '#2A2A28',
  aiText: '#E8E5DF',
}

interface ChatMessageListProps {
  messages: Message[]
  loading: boolean
  briefing: string
  priorityChips: PriorityChip[]
  suggestions: string[]
  sendMessage: (text: string) => void
  saveFeedback: (msgId: string, helpful: boolean) => void
  speak: (text: string) => void
  onAbort: () => void
}

export default function ChatMessageList({
  messages,
  loading,
  briefing,
  priorityChips,
  suggestions,
  sendMessage,
  saveFeedback,
  speak,
  onAbort,
}: ChatMessageListProps) {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const linkifyEntities = (text: string): React.ReactNode[] => {
    const clave = getClientClaveCookie()
    const traficoPattern = new RegExp(`(${clave}-[A-Z]\\d{4}|[67]\\d{6})`, 'g')
    const traficoTest = new RegExp(`^${clave}-[A-Z]\\d{4}$`)
    const parts = text.split(traficoPattern)
    return parts.map((part, i) => {
      if (traficoTest.test(part))
        return <Link key={i} href={`/traficos/${part}`} style={{ color: GOLD, fontWeight: 700, fontFamily: 'var(--font-data)', textDecoration: 'none', borderBottom: `1px solid rgba(201,168,76,0.4)`, whiteSpace: 'nowrap' }}>{part}</Link>
      if (/^[67]\d{6}$/.test(part))
        return <Link key={i} href={`/pedimentos?search=${part}`} style={{ color: GOLD, fontWeight: 700, fontFamily: 'var(--font-data)', textDecoration: 'none', whiteSpace: 'nowrap' }}>{part}</Link>
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16, WebkitOverflowScrolling: 'touch' }}>
      {/* Briefing card when no messages */}
      {messages.length === 0 && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 24 }}>
          <div style={{
            background: D.surface, borderLeft: '3px solid #C9A84C',
            borderRadius: 8, padding: '14px 16px', marginBottom: 16,
            maxWidth: 500,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 6,
                          letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
              CRUZ Briefing
            </div>
            <div style={{ fontSize: 13, color: D.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' as const }}>
              {briefing}
            </div>
          </div>

          {/* Priority chips */}
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
                  {typeof window !== 'undefined' ? DOMPurify.sanitize(msg.content) : msg.content}
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
            {/* Retry button on error */}
            {msg.role === 'assistant' && !loading && (msg.content.includes('No pude procesar') || msg.content.includes('Error del servidor') || msg.content.includes('no está disponible') || msg.content.includes('Error de API')) && (
              <button
                onClick={() => { const lastUser = messages.filter(m => m.role === 'user').pop(); if (lastUser) sendMessage(lastUser.content) }}
                style={{
                  marginTop: 8, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'transparent', border: `1px solid ${D.border}`, color: D.textMuted,
                  cursor: 'pointer',
                }}
              >
                Reintentar
              </button>
            )}
            {/* Action confirmation buttons */}
            {msg.role === 'assistant' && !loading && (msg.content.includes('¿Procedo?') || msg.content.includes('¿Procedemos?') || msg.content.includes('¿Confirma?')) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => sendMessage('Si, procede')}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: GOLD, color: 'var(--bg-card)', border: 'none', cursor: 'pointer',
                    minHeight: 36,
                  }}
                >
                  Proceder
                </button>
                <button
                  onClick={() => sendMessage('No, cancelar')}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: 'transparent', color: D.textMuted,
                    border: `1px solid ${D.border}`, cursor: 'pointer',
                    minHeight: 36,
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}
            {msg.role === 'assistant' && (
              <div style={{ display: 'flex', gap: 4, marginTop: 8, opacity: 0.4 }}>
                <button onClick={() => speak(msg.content)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.aiText, padding: 4 }}><Volume2 size={13} /></button>
                <button onClick={() => saveFeedback(msg.id, true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.feedback === true ? 'var(--success)' : D.aiText, padding: 4 }}><ThumbsUp size={13} /></button>
                <button onClick={() => saveFeedback(msg.id, false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.feedback === false ? 'var(--danger-500)' : D.aiText, padding: 4 }}><ThumbsDown size={13} /></button>
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
          <button onClick={onAbort}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', border: `1px solid ${D.border}`, borderRadius: 8, background: 'transparent', fontSize: 11, fontWeight: 600, color: D.textMuted, cursor: 'pointer' }}>
            <Square size={8} fill="currentColor" /> Detener
          </button>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
